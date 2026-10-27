// Importe le nichoir de C:/projet/testLowPoly dans `models/nichoir.model.json` (format cnc-model) : les plaques de BOIS seulement (pas de `special` :
// ni électronique, ni isolant, ni cure-dents), aux réglages par défaut de l'app testLowPoly (NEST_DEFAULT, t = 3, fit = 0). À relancer après un changement du nichoir.
// Les pièces d'hiver (bloc isolant du ventilateur, bloc d'aération) sont gardées à leur position « rangée à côté » (summerLayout, l'état par défaut de testLowPoly) ;
// deux actions les mettent en place (vecteurs mesurés avec setCassetteMode / setAirPlug) et cachent ce qui n'est pas en place : elles sont découpées quand même.
//   node scripts/models/nichoir-from-testLowPoly.mjs [--dump]     (--dump : liste toutes les plaques de la scène)
// Vite et three sont ceux de testLowPoly (son vite.config.ts et ses plugins sont faits pour sa version de Vite).
import { writeFileSync } from 'node:fs'

const ROOT = 'C:/projet/testLowPoly'
const OUT = new URL('../../models/nichoir.model.json', import.meta.url)
const dump = process.argv.includes('--dump')
const { createServer } = await import(`file:///${ROOT}/node_modules/vite/dist/node/index.js`)
const THREE = await import(`file:///${ROOT}/node_modules/three/build/three.module.js`)

const server = await createServer({ configFile: `${ROOT}/vite.config.ts`, root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { makeNest } = await server.ssrLoadModule('/src/birdhouse/model/nest/makeNest.ts')
  const { NEST_DEFAULT, DEFAULT_SCENE } = await server.ssrLoadModule('/src/birdhouse/model/constants.ts')
  const { outline } = await server.ssrLoadModule('/src/birdhouse/model/geometry/outline.ts')
  const { holeOutline } = await server.ssrLoadModule('/src/birdhouse/model/geometry/holes.ts')
  const { fromEulerDeg, rotate } = await server.ssrLoadModule('/src/birdhouse/model/math/rotation.ts')
  const { setCassetteMode, setAirPlug, winterState } = await server.ssrLoadModule('/src/birdhouse/model/nest/winter.ts')

  // mêmes appels que l'app (Planks.tsx) : scène vide → t = 3, fit = 0, start = 1
  const t = DEFAULT_SCENE.t
  const nest = makeNest(NEST_DEFAULT, t, DEFAULT_SCENE.fit, 1)
  const groupName = (p) => (p.group && nest.groupNames[p.group]) || ''

  if (dump) {
    console.log(['name', 'group', 'special', 'material', 'depth', 'w', 'h', 'spare', 'rot', 'holes'].join('\t'))
    for (const p of nest.planks) console.log([p.name, groupName(p), p.special ?? '', p.material ?? '', p.depth ?? '', p.w, p.h, p.spareOf ? 'spare' : '', p.rot.join('/'), p.holes.length].join('\t'))
  }

  // ----- conversion de repère -----
  // testLowPoly : Z = hauteur, −y = avant, contour local (x droite, y haut), extrudé sur z, Euler XYZ comme three.js.
  // cnc : Y = hauteur, +z = avant, contour (u droite, v BAS) extrudé sur z, Euler XYZ. Le repère local d'une plaque est le même dans les deux projets
  // (u = x, v = −y), seul le monde change : M = Rx(−90°) : (x, y, z) → (x, z, −y). D'où R_cnc = M · R_t et position = M · (pos_t + R_t · centre du contour).
  const M = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
  const mapV = (v) => new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(M)
  const r3 = (v) => Math.round(v * 1000) / 1000
  const deg = (r) => r3(THREE.MathUtils.radToDeg(r))

  // catégorie lisible et préfixe de famille, d'après le groupe de la plaque
  const CATS = {
    Corps: ['Corps', 'CO'], Toit: ['Toit', 'TO'], Couvercle: ['Couvercle', 'CV'], Entrée: ['Entrée', 'EN'], Habillage: ['Habillage', 'HA'],
    Ventilation: ['Ventilation', 'VE'], 'Aération du corps': ['Aération', 'AE'], "Pièces d'hiver (rechange)": ['Hiver', 'HI'], 'Baguettes de cale (à couper)': ['Cales', 'CA'],
    Isolant: ['Isolant', 'IS'], Électronique: ['Électronique', 'EL'], 'Réseau (hors nichoir)': ['Réseau', 'RS'],
  }
  // les deux blocs d'hiver : même catégorie (même couleur), mais une famille chacun pour que les actions les visent séparément
  const WINTER = [[/^Bloc isolant d'hiver|^Poignée bloc d'hiver/, ['Hiver', 'HB']], [/^Bouchon-boîte prise d'air|^Poignée bouchon prise d'air/, ['Hiver', 'HP']]]
  const byId = new Map(nest.planks.map((p) => [p.id, p]))
  const catOf = (p) => {
    const src = p.spareOf && byId.get(p.spareOf) ? byId.get(p.spareOf) : p // une pièce de rechange prend la famille de son original (même numéro, comptée en qty)
    const g = groupName(src)
    const w = g === "Pièces d'hiver (rechange)" && WINTER.find(([re]) => re.test(src.name))
    if (w) return w[1]
    if (CATS[g]) return CATS[g]
    if (!g) return ['Divers', 'DV']
    return [g, g.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'XX']
  }

  // le nichoir lui-même : pas d'électronique (special), pas de pièce de rechange (spareOf), ni les pièces d'hiver et les baguettes de cale posées à côté
  const ASIDE = new Set(['Baguettes de cale (à couper)']) // les pièces d'hiver restent : elles forment les deux blocs isolants posés à côté
  const isAside = (p) => !!p.spareOf || ASIDE.has(groupName(p))
  const wood = nest.planks.filter((p) => !p.special && !isAside(p))
  const excluded = nest.planks.filter((p) => p.special || isAside(p))
  const stats = { spares: wood.filter((p) => p.spareOf).length, byMaterial: {}, excluded: {} }
  for (const p of excluded) stats.excluded[p.special ?? (p.spareOf ? 'rechange' : groupName(p))] = (stats.excluded[p.special ?? (p.spareOf ? 'rechange' : groupName(p))] ?? 0) + 1

  const panels = []
  const checks = []
  let worst = 0
  for (const p of wood) {
    const thickness = p.material === 'okoume' || p.material === 'mdf' ? p.depth ?? t : t
    stats.byMaterial[p.material ?? 'contreplaque'] = (stats.byMaterial[p.material ?? 'contreplaque'] ?? 0) + 1
    const o = outline(p)
    const xs = o.map((q) => q[0]), ys = o.map((q) => q[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const outer = o.map(([x, y]) => [r3(x), r3(-y)])
    const holes = p.holes.map((h) => holeOutline(h).map(([x, y]) => [r3(x), r3(-y)]))
    const Rt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...p.rot.map((d) => THREE.MathUtils.degToRad(d)), 'XYZ'))
    const Rc = new THREE.Matrix4().multiplyMatrices(M, Rt)
    const ec = new THREE.Euler().setFromRotationMatrix(Rc, 'XYZ')
    const centreT = new THREE.Vector3(cx, cy, 0).applyMatrix4(Rt).add(new THREE.Vector3(...p.pos))
    const pc = mapV(centreT.toArray())
    const [category, id] = catOf(p)
    // snugDepths: [] : testLowPoly serre déjà ses crans (CRENEL_SNUG = −0,2) ; le serrage de cnc (0,4) ne doit pas s'ajouter
    const panel = { id, category, thickness, outer, holes, position: [r3(pc.x), r3(pc.y), r3(pc.z)], rotation: [deg(ec.x), deg(ec.y), deg(ec.z)], snugDepths: [] }
    if (p.material) panel.material = p.material
    panels.push(panel)

    // contrôle : chaque coin (contour + trous, deux faces) reconstruit comme viewer3d.ts de cnc = le coin de testLowPoly (rotate maison) passé par M
    const cxs = outer.map((q) => q[0]), cys = outer.map((q) => q[1])
    const ccx = (Math.min(...cxs) + Math.max(...cxs)) / 2, ccy = (Math.min(...cys) + Math.max(...cys)) / 2
    const Ec = new THREE.Euler(...panel.rotation.map((d) => THREE.MathUtils.degToRad(d)), 'XYZ')
    const qT = fromEulerDeg(p.rot)
    let err = 0
    const rings = [[o, outer], ...p.holes.map((h, i) => [holeOutline(h), holes[i]])]
    for (const [src, dst] of rings) for (let i = 0; i < src.length; i++) for (const z of [-thickness / 2, thickness / 2]) {
      const a = new THREE.Vector3(dst[i][0] - ccx, -(dst[i][1] - ccy), z).applyEuler(Ec).add(new THREE.Vector3(...panel.position))
      const wt = rotate([src[i][0], src[i][1], z], qT).map((v, k) => v + p.pos[k])
      err = Math.max(err, a.distanceTo(mapV(wt)))
    }
    worst = Math.max(worst, err)
    checks.push({ name: p.name, group: groupName(p), rotT: p.rot, rotC: panel.rotation, posT: p.pos, posC: panel.position, err })
  }

  const show = (re) => {
    const c = checks.find((k) => re.test(k.name))
    if (!c) return console.log(`  (pas de plaque ${re})`)
    console.log(`  ${c.name} [${c.group}] : rot ${c.rotT.join('/')} → ${c.rotC.join('/')} ; pos ${c.posT.join('/')} → ${c.posC.join('/')} ; écart max coins ${c.err.toExponential(2)} mm`)
  }
  console.log('Contrôle de la conversion de repère (coins monde, cnc vs testLowPoly) :')
  show(/^Plancher int$/)
  show(/^Face avant ext$/)
  show(/^Côté droit ext$/)
  console.log(`  écart max sur les ${panels.length} plaques : ${worst.toExponential(2)} mm`)
  if (worst > 0.01) throw new Error('conversion de repère fausse : coins différents')

  const big = panels.map((q, i) => {
    const xs = q.outer.map((v) => v[0]), ys = q.outer.map((v) => v[1])
    return { name: wood[i].name, w: r3(Math.max(...xs) - Math.min(...xs)), h: r3(Math.max(...ys) - Math.min(...ys)), id: q.id }
  }).filter((b) => Math.max(b.w, b.h) > 290)
  console.log(`\nPlaques de bois : ${panels.length} (dont ${stats.spares} rechanges spareOf), matériaux ${JSON.stringify(stats.byMaterial)}`)
  console.log(`Exclues (special) : ${excluded.length} ${JSON.stringify(stats.excluded)}`)
  console.log(`Catégories : ${[...new Set(panels.map((q) => `${q.category} (${q.id})`))].join(', ')}`)
  console.log(`Plus grandes que 290 mm : ${big.length}`)
  for (const b of big) console.log(`  ${b.id} ${b.name} : ${b.w} × ${b.h}`)

  // ----- actions : mise en place des pièces d'hiver -----
  // La scène de testLowPoly est en été (cassette ventilateur dans son siège, bloc isolant d'hiver rangé à côté, prise d'air ouverte, bloc d'aération rangé à côté) :
  // c'est l'état du fichier. Le vecteur « rangé → en place » de chaque bloc est mesuré en demandant l'hiver à testLowPoly, puis passé dans le repère cnc (M est une rotation).
  const scene = { t, fit: DEFAULT_SCENE.fit, planks: nest.planks }
  const st = winterState(scene)
  if (st.cassette !== 'summer' || st.plug !== 'open') throw new Error(`scène attendue en été, prise d'air ouverte : ${JSON.stringify(st)}`)
  const shiftOf = (after, id) => {
    const idx = panels.flatMap((q, i) => (q.id === id ? [i] : []))
    const vs = idx.map((i) => { const a = wood[i].pos, b = after.planks.find((q) => q.id === wood[i].id).pos; const d = mapV([b[0] - a[0], b[1] - a[1], b[2] - a[2]]); return [r3(d.x), r3(d.y), r3(d.z)] })
    if (!vs.length || vs.some((v) => v.join() !== vs[0].join())) throw new Error(`famille ${id} : les plaques ne bougent pas toutes du même vecteur (${vs.map((v) => v.join('/')).join(' ; ')})`)
    if (vs[0].every((v) => v === 0)) throw new Error(`famille ${id} : aucun déplacement mesuré`)
    return { n: idx.length, by: vs[0] }
  }
  const block = shiftOf(setCassetteMode(scene, 'winter'), 'HB') // le bloc isolant du ventilateur prend la place de la cassette (et de son conduit de sortie)
  const plug = shiftOf(setAirPlug(scene, true), 'HP') // le bloc d'aération entre dans le conduit de la prise d'air basse
  const nVE = panels.filter((q) => q.id === 'VE').length
  const actions = [
    { key: 'seat', label: 'Siège du ventilateur', default: 'cassette', type: 'choice', options: [
      { value: 'cassette', label: 'Cassette ventilateur', show: 'VE', hide: 'HB' },
      { value: 'block', label: 'Bloc isolant', show: 'HB', hide: 'VE', move: [{ panels: 'HB', by: block.by }] },
      { value: 'none', label: 'Rien', hide: ['VE', 'HB'] },
    ] },
    { key: 'plug', label: "Bloc d'aération posé", default: false, type: 'move', panels: 'HP', by: plug.by, show: 'HP' },
  ]
  console.log(`\nActions : siège du ventilateur (cassette VE : ${nVE} plaques, bloc HB : ${block.n} plaques décalées de ${block.by.join('/')}) ; bloc d'aération HP : ${plug.n} plaques décalées de ${plug.by.join('/')}`)

  const file = { format: 'cnc-model', colors: { Habillage: '#ffffff', Couvercle: '#c8a165' }, version: 1, id: 'nichoir', name: 'Nichoir', description: 'Nichoir high tech de testLowPoly : planches de bois seulement (sans électronique).', actions, panels }
  writeFileSync(OUT, JSON.stringify(file, null, 1).replace(/\r?\n/g, '\r\n') + '\r\n')
  console.log(`\nÉcrit ${OUT.pathname}`)
} finally {
  await server.close()
}
