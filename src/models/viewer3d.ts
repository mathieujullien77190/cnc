import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { markPiece } from '../core/marking'
import type { Panel } from './types'

const PALETTE = [0xd9b98a, 0xa9c4a0, 0x9fb4d6, 0xd6a5b8, 0xd8d08a, 0xb6a4d6]

/** Planche → maillage extrudé, centré sur sa boîte englobante. Repère : voir `Panel`. */
const panelObject = (p: Panel, color: number): THREE.Group => {
  const xs = p.outer.map((q) => q[0])
  const ys = p.outer.map((q) => q[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const path = <T extends THREE.Path>(target: T, pts: [number, number][]): T => {
    pts.forEach(([u, v], i) => (i ? target.lineTo(u - cx, -(v - cy)) : target.moveTo(u - cx, -(v - cy))))
    target.closePath()
    return target
  }
  const shape = path(new THREE.Shape(), p.outer)
  for (const h of p.holes ?? []) shape.holes.push(path(new THREE.Path(), h))
  const geo = new THREE.ExtrudeGeometry(shape, { depth: p.thickness, bevelEnabled: false })
  geo.translate(0, 0, -p.thickness / 2)
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }))
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0x3a2e1f }))
  const g = new THREE.Group()
  g.add(mesh, edges)
  // numéro gravé : les mêmes rectangles que ceux de la découpe (markPiece), posés sur la face avant
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  const rects = markPiece({ x: Math.min(...xs), y: Math.min(...ys), w, h, outer: p.outer, holes: p.holes ?? [] }, p.id)
  if (rects.length) {
    const parts = rects.map((r) => new THREE.ShapeGeometry(path(new THREE.Shape(), r)))
    const mark = new THREE.Mesh(
      mergeGeometries(parts),
      new THREE.MeshBasicMaterial({ color: 0x2b1a0c, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    )
    mark.position.z = p.thickness / 2 + 0.02
    // même numéro sur la face arrière, retourné pour se lire de ce côté
    const back = mark.clone()
    back.position.z = -(p.thickness / 2 + 0.02)
    back.rotation.y = Math.PI
    g.add(mark, back)
    parts.forEach((x) => x.dispose())
  }
  g.position.set(...p.position)
  const [rx, ry, rz] = (p.rotation ?? [0, 0, 0]).map((d) => THREE.MathUtils.degToRad(d))
  g.rotation.set(rx, ry, rz, 'XYZ')
  return g
}

/** Coins d'une planche (contour et trous, sur les deux faces), dans le repère local du groupe de `panelObject`. */
const cornersOf = (p: Panel): THREE.Vector3[] => {
  const xs = p.outer.map((q) => q[0])
  const ys = p.outer.map((q) => q[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const out: THREE.Vector3[] = []
  for (const poly of [p.outer, ...(p.holes ?? [])]) for (const [u, v] of poly) for (const z of [-p.thickness / 2, p.thickness / 2]) out.push(new THREE.Vector3(u - cx, -(v - cy), z))
  return out
}

/** Mesure entre deux coins, en mm. */
export interface Measure {
  d: number
  dx: number
  dy: number
  dz: number
}

const SNAP_PX = 16

/** Vue 3D d'un modèle : orbite, éclairage, éclaté, sélection d'une planche. Aucune interface ici. */
export class Viewer3D {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(40, 1, 1, 20000)
  private controls: OrbitControls
  private root = new THREE.Group()
  private objects: { group: THREE.Group; origin: THREE.Vector3; material: THREE.MeshStandardMaterial }[] = []
  private selected = -1
  private explode = 0
  private raf = 0
  private ro: ResizeObserver
  private down: [number, number] | null = null
  private hidden = new Set<number>()
  private headlight = new THREE.DirectionalLight(0xffffff, 1.4)
  private corners: THREE.Vector3[][] = []
  private measuring = false
  private pts: THREE.Vector3[] = []
  private hover = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), new THREE.PointsMaterial({ color: 0xea580c, size: 14, sizeAttenuation: false, depthTest: false, transparent: true }))
  private mark = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xdc2626, size: 9, sizeAttenuation: false, depthTest: false, transparent: true }))
  private ruler = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xdc2626, depthTest: false, transparent: true }))
  private tag: THREE.Sprite | null = null
  private keydown = (e: KeyboardEvent) => e.key === 'Escape' && this.measuring && this.clearMeasure()
  onMeasure: (m: Measure | null) => void = () => {}
  private rightDrag = false
  private rightStart: [number, number] | null = null
  onSelect: (index: number) => void = () => {}
  /** Clic droit sans glisser : planche visée (-1 si le vide) et position écran. */
  onMenu: (index: number, x: number, y: number) => void = () => {}
  onHidden: (count: number) => void = () => {}

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.appendChild(this.renderer.domElement)
    this.scene.background = new THREE.Color(0xf5f5f4)
    // éclairage qui suit la caméra : un même ombrage quel que soit l'angle de vue, dessus comme dessous
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5))
    this.scene.add(this.headlight, this.headlight.target)
    const grid = new THREE.GridHelper(2000, 40, 0xa8a29e, 0xd6d3d1)
    grid.position.y = -0.1
    this.scene.add(grid, this.root)
    for (const o of [this.hover, this.mark, this.ruler]) {
      o.renderOrder = 20
      o.visible = false
      o.frustumCulled = false
      this.scene.add(o)
    }
    window.addEventListener('keydown', this.keydown)
    this.camera.position.set(350, 300, 450)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    // clic molette glissé = tourner autour du modèle (comme le clic gauche) ; la molette seule zoome, clic droit déplace
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }
    this.renderer.domElement.addEventListener('mousedown', (e) => e.button === 1 && e.preventDefault()) // pas de défilement automatique
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    const el = this.renderer.domElement
    el.addEventListener('pointerdown', (e) => (this.down = [e.clientX, e.clientY]))
    el.addEventListener('pointerup', (e) => {
      if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 4) this.measuring ? this.measureClick(e) : this.pick(e)
      this.down = null
    })
    el.addEventListener('pointermove', (e) => this.measuring && this.snapHover(e))
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (this.down === null && this.rightDrag) return
      if (!this.measuring) this.onMenu(this.hit(e), e.clientX, e.clientY)
    })
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 2) this.rightDrag = false
      this.rightStart = [e.clientX, e.clientY]
    })
    el.addEventListener('pointermove', (e) => {
      if (this.rightStart && Math.hypot(e.clientX - this.rightStart[0], e.clientY - this.rightStart[1]) > 4) this.rightDrag = true
    })
    this.resize()
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      this.controls.update()
      this.headlight.position.copy(this.camera.position)
      this.headlight.target.position.copy(this.controls.target)
      if (this.tag) {
        const s = this.camera.position.distanceTo(this.tag.position) * 0.028
        this.tag.scale.set(s * (256 / 96), s, 1)
      }
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Indice de la planche visible sous le curseur, -1 sinon. */
  private hit(e: MouseEvent): number {
    const r = this.renderer.domElement.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera)
    const meshes = this.objects.filter((_, i) => !this.hidden.has(i)).map((o) => o.group.children[0])
    const h = ray.intersectObjects(meshes)[0]
    return h ? this.objects.findIndex((o) => o.group.children[0] === h.object) : -1
  }

  private pick(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return
    this.select(this.hit(e))
    this.onSelect(this.selected)
  }

  /** Mode mesure : les clics visent les coins des planches (aimant), deux coins donnent une distance en mm. */
  setMeasure(on: boolean) {
    this.measuring = on
    this.renderer.domElement.style.cursor = on ? 'crosshair' : ''
    if (!on) this.clearMeasure()
  }

  clearMeasure() {
    this.pts = []
    this.hover.visible = this.mark.visible = this.ruler.visible = false
    if (this.tag) {
      this.scene.remove(this.tag)
      ;(this.tag.material.map as THREE.Texture | null)?.dispose()
      this.tag.material.dispose()
      this.tag = null
    }
    this.onMeasure(null)
  }

  /** Coin visible le plus proche du curseur (à SNAP_PX près), en coordonnées monde. */
  private snap(e: MouseEvent): THREE.Vector3 | null {
    const r = this.renderer.domElement.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    let best: THREE.Vector3 | null = null
    let bd = SNAP_PX
    const w = new THREE.Vector3()
    this.root.updateMatrixWorld(true)
    this.objects.forEach((o, i) => {
      if (this.hidden.has(i)) return
      for (const c of this.corners[i]) {
        w.copy(c).applyMatrix4(o.group.matrixWorld)
        const p = w.clone().project(this.camera)
        if (p.z > 1) continue
        const d = Math.hypot(((p.x + 1) / 2) * r.width - mx, ((1 - p.y) / 2) * r.height - my)
        if (d < bd) {
          bd = d
          best = w.clone()
        }
      }
    })
    return best
  }

  private snapHover(e: PointerEvent) {
    if (this.down) return
    const p = this.snap(e)
    this.hover.visible = !!p
    if (p) this.hover.geometry.setFromPoints([p])
  }

  private measureClick(e: PointerEvent) {
    if (e.button !== 0) return
    const p = this.snap(e)
    if (!p) return
    if (this.pts.length >= 2) this.clearMeasure()
    this.pts.push(p)
    this.mark.geometry.setFromPoints(this.pts)
    this.mark.visible = true
    if (this.pts.length < 2) return
    const [a, b] = this.pts
    this.ruler.geometry.setFromPoints([a, b])
    this.ruler.visible = true
    const m: Measure = { d: a.distanceTo(b), dx: Math.abs(b.x - a.x), dy: Math.abs(b.y - a.y), dz: Math.abs(b.z - a.z) }
    const text = `${m.d.toFixed(2)} mm`
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const x = c.getContext('2d')!
    // étiquette blanche, contour noir, texte noir
    x.fillStyle = '#ffffff'
    x.strokeStyle = '#000000'
    x.lineWidth = 3
    x.beginPath()
    x.roundRect(4, 20, 248, 56, 10)
    x.fill()
    x.stroke()
    x.font = 'bold 44px system-ui, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillStyle = '#000000'
    x.fillText(text, 128, 49)
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }))
    this.tag.position.copy(a).add(b).multiplyScalar(0.5)
    this.tag.renderOrder = 21
    this.scene.add(this.tag)
    this.onMeasure(m)
  }

  /** Cache une planche (vue seulement : la découpe ne change pas). */
  hide(i: number) {
    if (i < 0 || i >= this.objects.length) return
    this.hidden.add(i)
    if (this.selected === i) this.select(-1)
    this.applyHidden()
  }

  showAll() {
    this.hidden.clear()
    this.applyHidden()
  }

  private applyHidden() {
    this.objects.forEach((o, i) => (o.group.visible = !this.hidden.has(i)))
    this.onHidden(this.hidden.size)
  }

  select(i: number) {
    this.selected = i
    this.objects.forEach((o, k) => o.material.emissive.setHex(k === i ? 0x2a6f4b : 0x000000))
  }

  setPanels(panels: Panel[], keepView = true, reset = !keepView) {
    for (const o of this.objects) this.disposeGroup(o.group)
    this.root.clear()
    this.corners = panels.map(cornersOf)
    this.clearMeasure()
    const cats = [...new Set(panels.map((p) => p.category ?? ''))]
    this.objects = panels.map((p) => {
      const group = panelObject(p, PALETTE[cats.indexOf(p.category ?? '') % PALETTE.length])
      this.root.add(group)
      return { group, origin: group.position.clone(), material: (group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial }
    })
    this.selected = -1
    this.hidden = new Set([...this.hidden].filter((i) => i < panels.length && !reset))
    this.applyHidden()
    this.applyExplode()
    if (!keepView) this.fit()
  }

  private disposeGroup(g: THREE.Group) {
    g.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      ;(m.material as THREE.Material | undefined)?.dispose()
    })
  }

  setExplode(k: number) {
    this.explode = k
    this.applyExplode()
  }

  private applyExplode() {
    const box = new THREE.Box3()
    for (const o of this.objects) box.expandByPoint(o.origin)
    const c = box.getCenter(new THREE.Vector3())
    for (const o of this.objects) o.group.position.copy(o.origin).sub(c).multiplyScalar(1 + this.explode).add(c)
  }

  /** Cadre le modèle entier. */
  fit() {
    const box = new THREE.Box3().setFromObject(this.root)
    if (box.isEmpty()) return
    const c = box.getCenter(new THREE.Vector3())
    const r = box.getSize(new THREE.Vector3()).length() / 2
    const d = r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))
    this.camera.position.copy(c).add(new THREE.Vector3(0.7, 0.55, 0.9).normalize().multiplyScalar(d))
    this.camera.near = Math.max(0.5, d / 100)
    this.camera.far = d * 20
    this.camera.updateProjectionMatrix()
    this.controls.target.copy(c)
    this.controls.update()
  }

  /** Image PNG de la vue courante (data URL). */
  screenshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.keydown)
    this.ro.disconnect()
    this.controls.dispose()
    for (const o of this.objects) this.disposeGroup(o.group)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
