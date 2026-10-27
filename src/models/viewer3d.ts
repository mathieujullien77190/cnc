import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { categoryHex } from '../core/colors'
import { digitRects, markPiece } from '../core/marking'
import { ruleRect } from './toCutParts'
import { contourEdges } from './edges'
import type { Panel } from './types'

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
  // faces (avant / arrière) à la couleur de la famille, tranche (le tour de la planche) légèrement plus foncée : ExtrudeGeometry range les faces en groupe 0, la tranche en groupe 1
  const faceMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  const sideMat = faceMat.clone()
  sideMat.color.multiplyScalar(EDGE_SHADE)
  // la paroi d'un trou sort de ExtrudeGeometry tournée vers le bois : sans double face elle est cachée et on voit à travers
  sideMat.side = THREE.DoubleSide
  const mesh = new THREE.Mesh(geo, [faceMat, sideMat])
  // arêtes tracées depuis les contours (voir edges.ts : jamais EdgesGeometry)
  const lines = contourEdges(p, cx, cy)
  const edgeGeo = new THREE.BufferGeometry()
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
  const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x3a2e1f }))
  const g = new THREE.Group()
  g.add(mesh, edges)
  // numéro gravé : les mêmes rectangles que ceux de la découpe (markPiece), posés sur la face avant
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  // les textes gravés en plus du nom (labels) sont aussi des obstacles pour le nom
  const words = [...(p.labels ?? []).map((l) => digitRects(l.text, l.x, l.y, l.h)), ...(p.rules ?? []).map((r) => [ruleRect(r)])]
  const rects = markPiece({ x: Math.min(...xs), y: Math.min(...ys), w, h, outer: p.outer, holes: [...(p.holes ?? []), ...words.flat()] }, p.id)
  if (rects.length || words.length) {
    const markMat = new THREE.MeshBasicMaterial({ color: 0x2b1a0c, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    const build = (list: [number, number][][], z: number) => {
      const parts = list.map((r) => new THREE.ShapeGeometry(path(new THREE.Shape(), r)))
      const mesh = new THREE.Mesh(mergeGeometries(parts), markMat)
      mesh.position.z = z
      parts.forEach((x) => x.dispose())
      return mesh
    }
    // face arrière : le même nom au MÊME endroit (jamais un reflet de la planche, qui le poserait dans un trou), glyphes retournés autour du centre du nom pour se lire de ce côté
    const mx = rects.flat().map((q) => q[0])
    const flipX = Math.min(...mx) + Math.max(...mx)
    const front = p.thickness / 2 + 0.02
    // chaque texte est retourné autour de son propre centre sur la face arrière
    const flipped = (list: [number, number][][]) => {
      const fx = Math.min(...list.flat().map((q) => q[0])) + Math.max(...list.flat().map((q) => q[0]))
      return list.map((r) => r.map(([x, y]): [number, number] => [fx - x, y]))
    }
    if (rects.length) g.add(build(rects, front), build(rects.map((r) => r.map(([x, y]): [number, number] => [flipX - x, y])), -front))
    for (const wd of words) g.add(build(wd, front), build(flipped(wd), -front))
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

/** Part de la couleur de la face gardée pour la tranche (0,8 = 20 % plus foncée). */
export const EDGE_SHADE = 0.8
/** Couleur unique quand les couleurs par famille sont désactivées : contreplaqué clair, uni. */
export const PLAIN_WOOD = 0xd4b07a

/** Vue 3D d'un modèle : orbite, éclairage, éclaté, sélection d'une planche. Aucune interface ici. */
export class Viewer3D {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(40, 1, 1, 20000)
  private controls: OrbitControls
  private root = new THREE.Group()
  private objects: { group: THREE.Group; origin: THREE.Vector3; materials: THREE.MeshStandardMaterial[]; hex: number; shown: boolean }[] = []
  private colored = true
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
  /** Point du dernier clic droit : le menu ne s'ouvre que si la souris n'a presque pas bougé (sinon c'était un déplacement de la vue). */
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
      const start = this.rightStart
      this.rightStart = null
      if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 4) return // c'était un déplacement de la vue
      if (!this.measuring) this.onMenu(this.hit(e), e.clientX, e.clientY)
    })
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 2) this.rightStart = [e.clientX, e.clientY]
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
    const meshes = this.objects.filter((o, i) => !this.hidden.has(i) && o.shown).map((o) => o.group.children[0])
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

  /** Cache plusieurs planches d'un coup (un groupe). */
  hideMany(indices: number[]) {
    for (const i of indices) if (i >= 0 && i < this.objects.length) this.hidden.add(i)
    if (this.hidden.has(this.selected)) this.select(-1)
    this.applyHidden()
  }

  showMany(indices: number[]) {
    for (const i of indices) this.hidden.delete(i)
    this.applyHidden()
  }

  showAll() {
    this.hidden.clear()
    this.applyHidden()
  }

  /** Couleurs par famille (vrai) ou bois uni (faux). */
  setColors(on: boolean) {
    this.colored = on
    this.applyColors()
  }

  private applyColors() {
    for (const o of this.objects) {
      const hex = this.colored ? o.hex : PLAIN_WOOD
      o.materials[0].color.setHex(hex)
      o.materials[1].color.setHex(hex).multiplyScalar(EDGE_SHADE)
    }
  }

  private applyHidden() {
    this.objects.forEach((o, i) => (o.group.visible = !this.hidden.has(i) && o.shown))
    this.onHidden(this.hidden.size)
  }

  select(i: number) {
    this.selected = i
    this.objects.forEach((o, k) => o.materials.forEach((m) => m.emissive.setHex(k === i ? 0x2a6f4b : 0x000000)))
  }

  setPanels(panels: Panel[], keepView = true, reset = !keepView) {
    for (const o of this.objects) this.disposeGroup(o.group)
    this.root.clear()
    this.corners = panels.map(cornersOf)
    this.clearMeasure()
    this.objects = panels.map((p) => {
      const group = panelObject(p, categoryHex(p.category ?? ''))
      this.root.add(group)
      return { group, origin: group.position.clone(), materials: (group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial[], hex: categoryHex(p.category ?? ''), shown: p.visible !== false }
    })
    this.applyColors()
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
      for (const mat of [m.material].flat()) (mat as THREE.Material | undefined)?.dispose()
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
