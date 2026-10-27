// Vérifie le cœur : `npm run check` (charge les modules via Vite, sans navigateur)
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let failed = 0
const check = (ok, msg) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok   ' : 'ECHEC'} ${msg}`)
}

try {
  const { parseCutParts } = await server.ssrLoadModule('/src/core/format.ts')
  const { buildAutoSheets, buildCustomSheet, conflicts, turnTo, angleOf, marksOf, marksFor } = await server.ssrLoadModule('/src/core/sheets.ts')
  const { sheetToJob, sheetGcode, travelOf } = await server.ssrLoadModule('/src/core/job.ts')
  const { sheetSvg } = await server.ssrLoadModule('/src/core/svg.ts')

  const text = readFileSync(new URL('../examples/exemple.cutparts.json', import.meta.url), 'utf8')
  const { parts, errors, project } = parseCutParts(text)
  check(!errors.length, `exemple lu sans erreur (${errors.join(' | ')})`)
  check(parts.length > 0 && project === 'exemple', `${parts.length} pièces dans le projet « ${project} »`)
  check(parts.every((p) => Math.min(...p.outer.map((q) => q[0])) === 0 && Math.min(...p.outer.map((q) => q[1])) === 0), 'contours recalés sur 0, 0')

  const bad = parseCutParts('{"format":"cnc-parts","version":1,"parts":[{"id":"X","thickness":3,"outer":[[0,0]]},{"id":"Y","thickness":0,"outer":[[0,0],[1,0],[1,1]]}]}')
  check(bad.errors.length === 2 && !bad.parts.length, 'pièces invalides refusées avec un message chacune')
  check(parseCutParts('pas du json').errors.length === 1, 'JSON illisible signalé')
  check(parseCutParts('{"format":"autre"}').errors.length === 1, 'mauvais format signalé')

  const settings = { width: 300, height: 300, margin: 5, gap: 1 }
  const sheets = buildAutoSheets(parts, settings)
  const wanted = parts.reduce((s, p) => s + p.qty, 0)
  const placed = sheets.reduce((s, sh) => s + sh.items.length, 0)
  const lost = sheets.reduce((s, sh) => s + sh.rejected.length, 0)
  check(placed + lost === wanted, `${placed}/${wanted} exemplaires rangés sur ${sheets.length} planches (${lost} rejetés)`)
  check(sheets.every((sh) => new Set(sh.items.map((i) => i.part.thickness)).size <= 1), 'jamais deux épaisseurs sur une planche')
  check(new Set(sheets.map((s) => s.thickness)).size > 1, 'plusieurs épaisseurs dans l’exemple')
  for (const sh of sheets) {
    const c = conflicts(sh)
    check(c.size === 0, `${sh.label} : aucun chevauchement ni sortie de planche`)
    const m = Math.min(...sh.items.flatMap((i) => [...i.outer, ...i.holes.flat()].map((p) => Math.min(p[0], p[1], settings.width - p[0], settings.height - p[1]))))
    check(!sh.items.length || m >= settings.margin - 1e-6, `${sh.label} : marge de ${settings.margin} mm respectée (min ${m.toFixed(2)})`)
  }

  const sheet = sheets[0]
  const both = sheetToJob(sheet, { names: true, frame: true })
  const none = sheetToJob(sheet, { names: false, frame: false })
  const onlyFrame = sheetToJob(sheet, { names: false, frame: true })
  const onlyNames = sheetToJob(sheet, { names: true, frame: false })
  check(!none.layers.engrave, 'sans case cochée : aucune gravure')
  check(onlyFrame.layers.engrave?.length === 1, 'contour seul : 1 tracé gravé')
  check((onlyNames.layers.engrave?.length ?? 0) > 0 && onlyNames.layers.engrave.length === [...marksFor(sheet).values()].reduce((s, m) => s + m.length, 0), 'noms seuls : un rectangle par trait')
  check(both.layers.engrave.length === onlyFrame.layers.engrave.length + onlyNames.layers.engrave.length, 'les deux cases : contour + noms')
  check(both.layers.cut.length === none.layers.cut.length && both.layers.cut.length > 0, 'la coupe ne dépend pas des cases')

  const g = sheetGcode(sheet, { names: true, frame: true })
  const firstCut = g.text.split('\n').findIndex((l) => /^G1/.test(l))
  check(g.text.includes('contours gravés avant la coupe'), 'G-code : en-tête gravure')
  check(firstCut > 0 && g.job.stats.bounds.maxX <= settings.width + 1e-6, 'G-code : dans la planche')
  const gNone = sheetGcode(sheet, { names: false, frame: false })
  check(gNone.text.includes('ne sont pas gravés'), 'G-code sans cases : mention « pas gravés »')

  const svg = sheetSvg(sheet, { marking: { names: true, frame: true }, preview: true })
  check(svg.includes('id="coupe"') && svg.includes('id="gravure"'), 'SVG : calques coupe et gravure')

  const board = { id: 't1', name: 'Essai', thickness: 3, width: 150, height: 150, qty: { [parts[0].key]: 2 }, overrides: {}, marking: { names: true, frame: true } }
  const b1 = buildCustomSheet(board, parts, 5, 1)
  check(b1.items.length === 2 && !b1.rejected.length, 'planche perso : 2 exemplaires posés')
  const moved = buildCustomSheet({ ...board, overrides: { [b1.items[0].uid]: { x: 85, y: 85, rot: false } } }, parts, 5, 1)
  const it0 = moved.items.find((i) => i.uid === b1.items[0].uid)
  check(it0 && Math.abs(it0.x - 85) < 1e-6 && Math.abs(it0.y - 85) < 1e-6, 'planche perso : pièce déplacée à la main reste où on l’a mise')
  check(conflicts(moved).size === 0, 'planche perso : pas de chevauchement après déplacement')
  const over = buildCustomSheet({ ...board, overrides: { [b1.items[0].uid]: { x: 5, y: 5, rot: false }, [b1.items[1].uid]: { x: 6, y: 6, rot: false } } }, parts, 5, 1)
  check(conflicts(over).size === 2, 'planche perso : chevauchement détecté')
  const p0 = b1.items[0]
  const turned = buildCustomSheet({ ...board, overrides: { [p0.uid]: { ...turnTo({ ...p0, x: 50, y: 50 }, 45) } } }, parts, 5, 1)
  const tr0 = turned.items.find((i) => i.uid === p0.uid)
  check(tr0 && angleOf(tr0) === 45 && Math.abs(tr0.w + tr0.h - (p0.w + p0.h) * Math.SQRT2) < 0.2 && turned.items.length === 2, 'rotation libre : 45° donne une boîte plus grande, centre gardé')
  const t90 = buildCustomSheet({ ...board, overrides: { [p0.uid]: turnTo(p0, 90) } }, parts, 5, 1).items.find((i) => i.uid === p0.uid)
  check(t90 && Math.abs(t90.w - p0.h) < 0.01 && Math.abs(t90.h - p0.w) < 0.01, 'rotation libre : 90° échange largeur et hauteur')
  const tiny = buildCustomSheet({ ...board, width: 30, height: 30, qty: { [parts[0].key]: 50 } }, parts, 5, 1)
  check(tiny.rejected.length === 0 && tiny.items.length === 50 && conflicts(tiny).size > 0, 'planche perso trop petite : les pièces en trop sont posées par-dessus une autre, signalées en conflit')
  const other = buildCustomSheet({ ...board, thickness: 99 }, parts, 5, 1)
  check(other.items.length === 2, 'planche perso : accepte des pièces de toute épaisseur')

  // export depuis un projet 3D : aller-retour avec la lecture
  const { toCutParts } = await server.ssrLoadModule('/export/exportParts.js')
  const sq = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]]
  const out = toCutParts([{ code: 'A-01', cat: 'X', outer: sq(10, 20), holes: [] }, { code: 'A-01', cat: 'X', outer: sq(10, 20), holes: [] }, { code: 'B-01', outer: sq(5, 5), holes: [sq(1, 1)] }], { project: 'essai', thickness: 3 })
  const back = parseCutParts(JSON.stringify(out.file))
  check(!out.warnings.length && !back.errors.length && back.parts.length === 2 && back.parts[0].qty === 2, 'export → lecture : doublons regroupés avec qty')
  const clash = toCutParts([{ code: 'A-01', outer: sq(10, 20) }, { code: 'A-01', outer: sq(11, 20) }], { project: 'essai', thickness: 3 })
  check(clash.warnings.length === 1, 'export : deux contours sous le même id signalés')

  // desserrer les petites pièces : pas de planche en plus, pas de chevauchement, petites pièces plus espacées
  const big = parseCutParts(readFileSync(new URL('../examples/exemple.cutparts.json', import.meta.url), 'utf8')).parts
  const tight = buildAutoSheets(big, settings)
  const loose = buildAutoSheets(big, { ...settings, spread: true })
  check(loose.length <= tight.length, `desserrer : ${loose.length} planches contre ${tight.length} (jamais plus)`)
  check(loose.every((sh) => conflicts(sh).size === 0), 'desserrer : aucun chevauchement')
  check(loose.reduce((n, sh) => n + sh.items.length, 0) === tight.reduce((n, sh) => n + sh.items.length, 0), 'desserrer : toutes les pièces sont rangées')
  const nearest = (shs) => {
    const gaps = []
    for (const sh of shs) for (const a of sh.items) {
      if (Math.max(a.w, a.h) > 75) continue
      let m = Infinity
      for (const b of sh.items) if (b !== a) m = Math.min(m, Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h)))
      if (Number.isFinite(m)) gaps.push(m)
    }
    return gaps.reduce((s, v) => s + v, 0) / gaps.length
  }
  const g0 = nearest(tight)
  const g1 = nearest(loose)
  check(g1 > g0 + 0.3, `desserrer : écart moyen entre petites pièces ${g0.toFixed(2)} → ${g1.toFixed(2)} mm`)
  const looseBoard = buildCustomSheet({ ...board, qty: { [parts[0].key]: 4 } }, parts, 5, 1, true)
  check(looseBoard.items.length === 4 && conflicts(looseBoard).size === 0, 'desserrer : planche perso')

  // pièces dans des pièces : toujours coupées avant la pièce qui les entoure
  const inPoly = (p, poly) => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]
      const [xj, yj] = poly[j]
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  let pairs = 0
  let wrong = 0
  for (const sh of [...sheets, ...tight, ...loose]) {
    const order = sheetToJob(sh, { names: false, frame: false }).pieces
    order.forEach((outerPiece, oi) => {
      const holes = outerPiece.contours.slice(1)
      order.forEach((other, ii) => {
        if (ii === oi || !holes.some((h) => inPoly(other.contours[0][0], h))) return
        pairs++
        if (ii > oi) wrong++
      })
    })
  }
  check(pairs > 0, `${pairs} pièces rangées dans le trou d'une autre (cas testé)`)
  check(wrong === 0, 'pièces à l’intérieur toujours coupées avant la pièce qui les entoure')

  // noms des toutes petites pièces : gravés à côté quand ils ne tiennent pas dessus, sans toucher une autre pièce ni un autre nom
  const ring = (r, n = 16) => Array.from({ length: n }, (_, i) => [r + r * Math.cos((2 * Math.PI * i) / n), r + r * Math.sin((2 * Math.PI * i) / n)])
  const minis = parseCutParts(JSON.stringify({ format: 'cnc-parts', version: 1, project: 'mini', parts: [
    { id: 'A-42', qty: 40, thickness: 3, outer: ring(4), holes: [ring(1, 8).map(([x, y]) => [x + 3, y + 3])] },
    { id: 'G-46', qty: 12, thickness: 3, outer: [[0, 0], [3.4, 0], [3.4, 24], [0, 24]] },
    { id: 'G-47', qty: 12, thickness: 3, outer: [[0, 0], [3.4, 0], [3.4, 9], [0, 9]] },
  ] })).parts
  const named = buildAutoSheets(minis.concat(parts), settings)
  // noms minuscules : toujours sur la pièce ; en un seul trait quand c'est vraiment petit
  const { digitRects } = await server.ssrLoadModule('/src/core/marking.ts')
  let outside = 0
  let missing = []
  let single = 0
  let double = 0
  for (const sh of named) {
    const marks = marksFor(sh)
    for (const it of sh.items) {
      const m = marks.get(it.uid) ?? []
      if (!m.length) { missing.push(it.part.id); continue }
      const pts = m.flat()
      const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]))
      if (x0 < it.x - 1e-6 || x1 > it.x + it.w + 1e-6 || y0 < it.y - 1e-6 || y1 > it.y + it.h + 1e-6) outside++
      if (m.length === digitRects(it.part.id, 0, 0, 1, 1).length) single++
      else if (m.length === digitRects(it.part.id, 0, 0, 1, 2).length) double++
    }
  }
  const sticks = named.flatMap((sh) => sh.items).filter((it) => it.part.id === 'G-46')
  check(outside === 0, 'noms toujours dans la pièce (jamais à côté)')
  check(sticks.length === 12 && sticks.every((it) => marksFor(named.find((sh) => sh.items.includes(it))).get(it.uid).length > 0), 'goujons de 3,4 mm : nom gravé quand même')
  check(single > 0 && double > 0, `${single} noms en un seul trait (minuscules), ${double} en trait double`)
  check(!missing.includes('G-46') && !missing.includes('G-47'), `pièces sans nom faute de place : ${[...new Set(missing)].join(', ') || 'aucune'}`)

  // parcours optimisé : déplacements à vide plus courts qu'au plus proche voisin, et le G-code les suit
  let sumNew = 0
  let sumOld = 0
  let worse = 0
  const t0 = Date.now()
  for (const sh of [...tight].slice(0, 12)) {
    const j = sheetToJob(sh, { names: true, frame: true })
    const t = travelOf(j)
    sumNew += t.mm
    sumOld += t.baselineMm
    if (t.mm > t.baselineMm + 1e-6) worse++
  }
  check(worse === 0, 'parcours : jamais plus long que le plus proche voisin')
  check(sumNew < sumOld, `parcours : ${(sumOld / 1000).toFixed(2)} m → ${(sumNew / 1000).toFixed(2)} m de déplacements à vide (${Math.round((1 - sumNew / sumOld) * 100)} % en moins) sur 12 planches, ${Date.now() - t0} ms`)
  const gj = sheetGcode(tight[0], { names: true, frame: true })
  const tj = travelOf(sheetToJob(tight[0], { names: true, frame: true }))
  check(Math.abs(gj.job.stats.rapidMm - tj.mm) < 1, `G-code : ${gj.job.stats.rapidMm.toFixed(0)} mm à vide = parcours calculé ${tj.mm.toFixed(0)} mm`)

  // statistiques : coupe, gravure et déplacements séparés, temps qui s'additionnent
  const sg = sheetGcode(sheets[0], { names: true, frame: true }).job.stats
  const sn = sheetGcode(sheets[0], { names: false, frame: false }).job.stats
  check(sg.engraveMm > 0 && sn.engraveMm === 0, `gravure comptée à part : ${sg.engraveMm.toFixed(0)} mm avec cases, ${sn.engraveMm} sans`)
  check(Math.abs(sg.cutMm - sn.cutMm) < 1e-6, `distance de coupe identique avec ou sans gravure (${sg.cutMm.toFixed(0)} mm)`)
  check(Math.abs(sg.cutSeconds + sg.engraveSeconds + sg.rapidSeconds - sg.seconds) < 0.01 * sg.seconds + 0.5, `temps : ${sg.cutSeconds.toFixed(0)} + ${sg.engraveSeconds.toFixed(0)} + ${sg.rapidSeconds.toFixed(0)} ≈ ${sg.seconds.toFixed(0)} s`)
  check(sg.rapidMm > 0 && sg.lines > 0 && sg.contours > 0, `${sg.lines} lignes, ${sg.contours} contours, ${sg.rapidMm.toFixed(0)} mm à vide`)

  // numéro de planche : unique (affiché dans l'app, jamais gravé)
  const nums = sheets.filter((sh) => sh.items.length).map((sh) => sh.mark)
  check(nums.length > 1 && new Set(nums).size === nums.length && nums.join() === nums.map((_, i) => i + 1).join(), `planches numérotées ${nums.join(' ')}`)
  const eng = sheetToJob(sheets[0], { names: true, frame: false }).layers.engrave.length
  const engNone = sheetToJob(sheets[0], { names: false, frame: false }).layers.engrave
  check(eng > 0 && !engNone, 'noms gravés avec la case « noms », absents sans (pas de numéro de planche gravé)')

  // crans : mêmes règles que testBrick (impair, 16 mm visés, serrage de 0,4 mm sur les fenêtres, languettes intactes)
  const { fingerCount, fingerSpans, plateOutline } = await server.ssrLoadModule('/src/models/helpers.ts')
  const { snugPanel } = await server.ssrLoadModule('/src/models/snug.ts')
  check([20, 60, 120, 200, 260].every((l) => fingerCount(l) % 2 === 1 && fingerCount(l) >= 3), 'nombre de crans impair, 3 au moins')
  check(fingerCount(120) === 7 && fingerCount(50) === 3 && fingerCount(260) === 17, 'nombre de crans comme testBrick (120 mm → 7, 50 → 3, 260 → 17)')
  const cr_win = [[10, 20], [27.1, 20], [27.1, 23], [10, 23]]
  const cr_sn = snugPanel({ id: 'X', thickness: 3, outer: [[0, 0], [100, 0], [100, 100], [0, 100]], holes: [cr_win], position: [0, 0, 0] })
  const cr_wx = cr_sn.holes[0].map((q) => q[0])
  check(Math.abs(Math.max(...cr_wx) - Math.min(...cr_wx) - (17.1 - 0.4)) < 1e-6, 'fenêtre de languette raccourcie de 0,4 mm')
  const cr_tong = plateOutline(100, 50, { right: { d: 3 } })
  const cr_ts = snugPanel({ id: 'X', thickness: 3, outer: cr_tong, position: [0, 0, 0] })
  const cr_sp = fingerSpans(50)
  check(cr_sp.length === 1 && Math.abs(cr_sp[0].u1 - cr_sp[0].u0 - 50 / 3) < 1e-9, 'une languette de 50 mm : 3 crans, languette au milieu')
  const cr_tw = cr_ts.outer.filter((q) => Math.abs(q[0] - 103) < 1e-6).map((q) => q[1])
  check(cr_tw.length === 2 && Math.abs(Math.abs(cr_tw[1] - cr_tw[0]) - 50 / 3) < 1e-6, 'languette gardée à sa largeur (pas de serrage)')
  const cr_notch = plateOutline(100, 50, { right: { d: -3 } })
  const cr_ns = snugPanel({ id: 'X', thickness: 3, outer: cr_notch, position: [0, 0, 0] })
  const cr_nw = cr_ns.outer.filter((q) => Math.abs(q[0] - 97) < 1e-6).map((q) => q[1])
  check(cr_nw.length === 2 && Math.abs(Math.abs(cr_nw[1] - cr_nw[0]) - (50 / 3 - 0.4)) < 1e-6, 'encoche resserrée de 0,4 mm')

  // essai de crantage : 2 plaques serrées dans le coin de l'origine machine (bas-gauche), sans conflit
  const { crenelTestSheet } = await server.ssrLoadModule('/src/models/crenelTest.ts')
  const ct = crenelTestSheet(3, 300, 300).sheet
  const cmax = Math.max(...ct.items.map((i) => i.x + i.w))
  const cmin = Math.min(...ct.items.map((i) => i.y))
  check(ct.items.length === 2 && conflicts(ct).size === 0 && ct.rejected.length === 0, 'essai de crantage : 2 plaques, sans conflit')
  const { goujonTestSheet } = await server.ssrLoadModule('/src/models/goujonTest.ts')
  const gt = goujonTestSheet(3, 300, 300).sheet
  const gw = gt.items.filter((i) => i.part.id.startsWith('GJ')).map((i) => i.w).sort((a, b) => a - b)
  check(gt.items.length === 6 && conflicts(gt).size === 0 && gt.rejected.length === 0 && gw.join() === '3,3.1,3.2,3.3,3.4' && gt.items.some((i) => i.part.id.startsWith('GT') && i.holes.length === 1), 'essai de goujons : 1 mini planche trouée + 5 goujons de 3 à 3,4 mm, sans conflit')
  check(cmax < 90 && cmin > 300 - 100, `essai de crantage : regroupé contre l'origine (x max ${cmax.toFixed(0)} mm, y haut ${cmin.toFixed(0)} mm sur 300)`)

  // planche d'essai puissance × vitesse
  const { buildTestCard, spread } = await server.ssrLoadModule('/src/laser/grbl/gcode.ts')
  const card = buildTestCard({ W: 300, H: 300, speeds: spread(300, 1200, 6), powers: spread(40, 100, 6), size: 10, gap: 5, passes: 1, sMax: 1000, capPct: 100, labels: { feed: 1500, powerPct: 20 } })
  check(card.cells.length === 36 && card.fits, `planche d'essai : ${card.cells.length} carrés dans la zone (${card.job.stats.lines} lignes, ${Math.round(card.job.stats.seconds)} s)`)
  check(new Set(card.cells.map((c) => `${c.speed}/${c.power}`)).size === 36, "planche d'essai : 36 couples vitesse / puissance distincts")

  // traits résiduels : aucun contour cranté ne doit avoir de segment en biais, minuscule, doublon, point inutile ou croisement ; le nom gravé reste hors des fenêtres
  const { panelIssues, markIssues } = await server.ssrLoadModule('/src/models/validate.ts')
  const { markPiece } = await server.ssrLoadModule('/src/core/marking.ts')
  const slanted = snugPanel({ id: 'X', thickness: 3, outer: plateOutline(100, 50, { right: { d: 3 }, left: { d: -3 } }), position: [0, 0, 0] })
  check(panelIssues(slanted).length === 0, 'serrage : languettes et encoches gardent des parois droites (aucun trait en biais)')
  check(panelIssues({ id: 'X', thickness: 3, outer: [[0, 0], [10, 0], [10, 5], [10.2, 5.3], [20, 5.3], [20, 10], [0, 10]], position: [0, 0, 0] }).some((i) => i.kind === 'biais'), 'contrôle : un segment en biais est repéré')

  // vue 3D : arêtes depuis les contours, jamais EdgesGeometry (faux traits noirs entre fenêtres alignées)
  const { readFileSync: e3_rf } = await import('node:fs')
  check(!/EdgesGeometry/.test(e3_rf(new URL('../src/models/viewer3d.ts', import.meta.url), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), 'vue 3D : pas de EdgesGeometry')
  check(/EDGE_SHADE = 0\.[0-9]+/.test(e3_rf(new URL('../src/models/viewer3d.ts', import.meta.url), 'utf8')) && /\[faceMat, sideMat\]/.test(e3_rf(new URL('../src/models/viewer3d.ts', import.meta.url), 'utf8')), 'vue 3D : tranche des planches plus foncée que les faces')
  const { contourEdges } = await server.ssrLoadModule('/src/models/edges.ts')
  const e3_sq = (x, y) => [[x, y], [x + 3, y], [x + 3, y + 3], [x, y + 3]]
  const e3_eg = contourEdges({ id: 'X', thickness: 3, outer: [[0, 0], [100, 0], [100, 50], [0, 50]], holes: [e3_sq(10, 10), e3_sq(40, 10), e3_sq(70, 10)], position: [0, 0, 0] }, 50, 25)
  const e3_segsN = e3_eg.length / 6
  const e3_ringsN = 4 + 3 * 4
  check(e3_segsN === e3_ringsN * 3, `arêtes 3D : ${e3_segsN} traits = 2 faces + 1 arête verticale par angle (aucun trait entre fenêtres)`)
  const e3_linked = []
  for (let i = 0; i < e3_eg.length; i += 6) if (Math.abs(e3_eg[i + 2] - e3_eg[i + 5]) < 1e-9) e3_linked.push(Math.hypot(e3_eg[i + 3] - e3_eg[i], e3_eg[i + 4] - e3_eg[i + 1]))
  check(e3_linked.every((l) => [3, 50, 100].some((c) => Math.abs(l - c) < 1e-9)), 'arêtes 3D : chaque trait de face est un côté de contour')

  // modèles 3D : chaque modèle de la bibliothèque donne des planches valides, aux réglages par défaut et aux bornes
  const { MODELS } = await server.ssrLoadModule('/src/models/registry.ts')
  const { panelsToCutParts, finishPanels, numberPanels } = await server.ssrLoadModule('/src/models/toCutParts.ts')
  const { inside: lbInside } = await server.ssrLoadModule('/src/laser/job/geometry.ts')
  const { defaultParams } = await server.ssrLoadModule('/src/models/types.ts')
  // mangeoire V3 : pièces de iris.js de testBrick sans la planche de plafond du bac ni les plaques du bas et du haut du boîtier avec 4 goujons carrés (49 planches, 37 pièces différentes), aux cotes de testBrick
  const v3 = MODELS.find((m) => m.id === 'mangeoire-v3')
  const v3p = v3 ? finishPanels(v3.build(defaultParams(v3)).panels) : []
  check(v3p.length === 49 && new Set(v3p.map((q) => q.id)).size === 37, `mangeoire V3 : ${v3p.length} planches, ${new Set(v3p.map((q) => q.id)).size} pièces différentes (testBrick : 52 et 39, moins la planche de plafond et 2 plaques du boîtier, plus 4 goujons)`)
  const v3box = v3p.find((q) => q.category === 'Boîtier')
  check(!!v3box && Math.abs(Math.max(...v3box.outer.map((q) => q[0])) - Math.min(...v3box.outer.map((q) => q[0])) - 143) < 0.01, 'mangeoire V3 : boîtier de 143 mm de côté')

  check(MODELS.length >= 1 && new Set(MODELS.map((m) => m.id)).size === MODELS.length, `${MODELS.length} modèles, ids uniques`)
  // ordre de coupe : une pièce posée dans une autre (trou, creux, boîte contenue) est toujours coupée avant son hôte
  {
    const sorted = [...parts].sort((a, b) => b.w * b.h - a.w * a.h)
    const host = sorted[0]
    const guest = sorted[sorted.length - 1]
    const bd = { id: 'in', name: 'in', thickness: host.thickness, width: 300, height: 300, qty: { [host.key]: 1, [guest.key]: 1 }, marking: { names: false, frame: false, drawings: false } }
    const placed = buildCustomSheet({ ...bd, overrides: { [`${host.key}#1`]: { x: 20, y: 20, rot: false }, [`${guest.key}#1`]: { x: 20 + host.w / 2 - guest.w / 2, y: 20 + host.h / 2 - guest.h / 2, rot: false } } }, parts, 5, 1)
    const order = sheetToJob(placed, bd.marking).pieces.map((p) => p.name)
    const gi = order.findIndex((n) => n.endsWith(` ${guest.id}`))
    const hi = order.findIndex((n) => n.endsWith(` ${host.id}`))
    check(gi >= 0 && hi >= 0 && gi < hi, `ordre de coupe : la pièce posée dans une autre (${guest.id} dans ${host.id}) est coupée avant son hôte`)
  }
  // une pièce plus grande que la planche choisie va sur une « grande planche » de la taille de la machine, pas à la poubelle
  const nich = MODELS.find((m) => m.id === 'nichoir')
  if (nich) {
    const np = parseCutParts(JSON.stringify(panelsToCutParts(finishPanels(nich.build({}).panels), 'nichoir').file)).parts
    const small = buildAutoSheets(np, { width: 300, height: 300, margin: 5, gap: 1 })
    // "Optimiser encore mieux" tient compte de l'épaisseur : chaque groupe a la sienne, jamais deux épaisseurs sur une planche, même avec un plan
    const { deepSearch: deepNich } = await server.ssrLoadModule('/src/core/deep.ts')
    const nset = { width: 400, height: 320, margin: 5, gap: 1, spread: false, byType: false }
    const nres = deepNich(np, nset, { budgetMs: 2500, maxSeeds: 3 })
    const nsheets = buildAutoSheets(np, nres.deep ? { ...nset, deep: nres.deep } : nset)
    check(nsheets.every((sh) => sh.items.every((i) => i.part.thickness === sh.thickness)) && nsheets.every((sh) => conflicts(sh).size === 0), 'nichoir : la recherche d’optimisation sépare les épaisseurs (3 mm et 5 mm), aucun chevauchement')
    check(small.every((sh) => sh.rejected.length === 0) && small.some((sh) => sh.width === 400 && sh.height === 320 && sh.items.length) && small.every((sh) => conflicts(sh).size === 0), 'nichoir sur 300 × 300 : les pièces trop grandes vont sur des planches 400 × 320, aucune perdue, aucun chevauchement')
  }
  // couleurs choisies par l'app : toujours pastel clair, et fixes (même catégorie, même couleur, quel que soit l'ordre)
  const { PALETTE, FIXED, categoryHex } = await server.ssrLoadModule('/src/core/colors.ts')
  const lum = (h) => (0.299 * ((h >> 16) & 255) + 0.587 * ((h >> 8) & 255) + 0.114 * (h & 255)) / 255
  check([...PALETTE, ...Object.values(FIXED)].every((h) => lum(h) >= 0.6), 'couleurs de l’app : toutes pastel clair (luminosité ≥ 0,6)')
  check(categoryHex('Zorglub') === categoryHex('Zorglub') && lum(categoryHex('Zorglub')) >= 0.6 && categoryHex('Plaque') === FIXED.Plaque, 'couleurs : fixes par nom de catégorie, pastel pour une catégorie inconnue')
  // modèle en JSON (sans code) : un modèle TS exporté puis relu donne exactement les mêmes pièces
  const { modelFromJson, modelToJson } = await server.ssrLoadModule('/src/models/json.ts')
  for (const m of MODELS) {
    const raw = m.build(defaultParams(m)).panels
    const again = modelFromJson(JSON.parse(JSON.stringify(modelToJson(m, raw))), m.id)
    const a = JSON.stringify(panelsToCutParts(finishPanels(raw), m.id).file)
    const b = JSON.stringify(panelsToCutParts(finishPanels(again.build({}).panels), m.id).file)
    check(again.id === m.id && again.params.length === 0 && a === b, `${m.id} : exporté en .model.json puis relu, mêmes pièces`)
  }
  // actions : un interrupteur (allumé ou éteint) et chaque option d'une liste ne changent que des positions et la visibilité (jamais la forme, le nombre de planches ni les pièces découpées)
  const cutOf = (m, panels) => JSON.stringify(panelsToCutParts(finishPanels(panels), m.id).file)
  const sameShape = (a, b) => a.length === b.length && a.every((p, i) => JSON.stringify([p.outer, p.holes ?? [], p.id, p.thickness]) === JSON.stringify([b[i].outer, b[i].holes ?? [], b[i].id, b[i].thickness]))
  const movedIn = (a, b) => a.filter((p, i) => JSON.stringify(p.position) !== JSON.stringify(b[i].position)).length
  for (const m of MODELS) {
    const off = Object.fromEntries(m.params.map((d) => [d.key, d.type === 'boolean' ? false : d.default]))
    const base = m.build(off).panels
    const baseCut = cutOf(m, base)
    for (const d of m.params) {
      if (d.type === 'boolean') {
        const on = m.build({ ...off, [d.key]: true }).panels
        const moved = movedIn(on, base)
        check(sameShape(on, base) && moved > 0 && cutOf(m, on) === baseCut, `${m.id} : action « ${d.label} » déplace ${moved} planche(s) sans changer la découpe`)
      } else if (d.type === 'select') {
        const states = d.options.map((o) => ({ o, panels: m.build({ ...off, [d.key]: o.value }).panels }))
        const ok = states.length >= 2 && states.every(({ panels }) => sameShape(panels, base) && cutOf(m, panels) === baseCut)
        const sum = states.map(({ o, panels }) => `« ${o.label} » : ${panels.filter((p) => p.visible === false).length} cachée(s), ${movedIn(panels, base)} déplacée(s)`).join(' ; ')
        check(ok, `${m.id} : liste « ${d.label} » : mêmes planches et même découpe pour ses ${states.length} options (${sum})`)
      }
    }
  }
  const tinyModel = { format: 'cnc-model', version: 1, name: 'x', panels: [{ id: 'P', thickness: 3, outer: [[0, 0], [10, 0], [10, 10], [0, 10]], position: [0, 0, 0] }, { id: 'Q', category: 'Q', thickness: 3, outer: [[0, 0], [10, 0], [10, 10], [0, 10]], position: [20, 0, 0] }] }
  const withAct = modelFromJson({ ...tinyModel, actions: [{ key: 'up', label: 'Levé', default: false, type: 'move', panels: 'Q', by: [0, 5, 0], show: 'Q' }, { key: 'tilt', label: 'Penché', default: true, type: 'turn', panels: [0], by: [0, 0, 15] }] }, 'x')
  const w = withAct.build({ up: true, tilt: true }).panels
  check(w[1].position[1] === 5 && w[0].position[1] === 0 && w[0].rotation?.[2] === 15 && withAct.params.length === 2 && withAct.params.every((d) => d.type === 'boolean'), 'actions move et turn : décalage et rotation appliqués aux bonnes planches')
  const wOff = withAct.build({ up: false, tilt: false }).panels, wDef = withAct.build({}).panels
  check(w[1].visible === true && wOff[1].visible === false && wOff[0].rotation === undefined && wDef[1].visible === false && wDef[0].rotation?.[2] === 15, 'interrupteur : « show » montre les planches allumé et les cache éteint ; réglage absent = défaut')
  // liste de choix : une option cache, une autre montre et décale, une troisième cache tout ; valeur inconnue = défaut
  const seatOpts = [{ value: 'p', label: 'Plaque P', show: [0], hide: 'Q' }, { value: 'q', label: 'Plaque Q', show: 'Q', hide: [0], move: [{ panels: 'Q', by: [-20, 0, 0] }] }, { value: 'none', label: 'Rien', hide: ['P', 'Q'] }]
  const seat = modelFromJson({ ...tinyModel, actions: [{ key: 'seat', label: 'Siège', default: 'p', type: 'choice', options: seatOpts }] }, 'x')
  const sP = seat.build({ seat: 'p' }).panels, sQ = seat.build({ seat: 'q' }).panels, sNone = seat.build({ seat: 'none' }).panels, sBad = seat.build({ seat: 'zzz' }).panels
  const sParam = seat.params[0]
  check(sParam.type === 'select' && sParam.default === 'p' && sParam.options.map((o) => o.label).join() === 'Plaque P,Plaque Q,Rien', 'action choice : réglage en liste (options = les labels, défaut = la value par défaut)')
  check(sP[0].visible === true && sP[1].visible === false && sP[1].position[0] === 20 && sQ[0].visible === false && sQ[1].visible === true && sQ[1].position[0] === 0 && sNone.every((p) => p.visible === false) && sNone[1].position[0] === 20 && JSON.stringify(sBad) === JSON.stringify(sP), 'action choice : chaque option montre, cache et décale ses planches ; valeur inconnue = défaut')
  const badJson = (raw) => { try { modelFromJson(raw, 'x'); return false } catch (e) { return /modèle|planche|action/.test(e.message) } }
  check(badJson({ ...tinyModel, actions: [{ key: 'a', label: 'a', default: 'x', type: 'choice', options: seatOpts }] }) && badJson({ ...tinyModel, actions: [{ key: 'a', label: 'a', default: 'p', type: 'choice', options: seatOpts.slice(0, 1) }] }) && badJson({ ...tinyModel, actions: [{ key: 'a', label: 'a', default: 'p', type: 'choice', options: [seatOpts[0], { value: 'z', label: 'z', show: 'Z' }] }] }) && badJson({ ...tinyModel, actions: [{ key: 'a', label: 'a', default: 'oui', type: 'move', panels: 'Q', by: [0, 0, 0] }] }), 'action choice invalide refusée (défaut hors options, une seule option, cible inconnue, défaut non booléen d’un interrupteur)')
  check(badJson({ ...tinyModel, actions: [{ key: 'a', label: 'a', default: false, type: 'fly', panels: 'Q' }] }) && badJson({ ...tinyModel, actions: [{ key: 'a', label: 'a', default: false, type: 'move', panels: 'Z', by: [0, 0, 0] }] }) && badJson({ format: 'cnc-model', version: 1, name: 'x', panels: [] }) && badJson({ format: 'cnc-model', version: 1, name: 'x', panels: [{ id: 'p-01', thickness: 3, outer: [[0, 0], [1, 0], [1, 1]], position: [0, 0, 0] }] }) && badJson({ format: 'autre' }), 'modèle JSON invalide refusé avec un message lisible')
  for (const m of MODELS) {
    const lo = Object.fromEntries(m.params.map((d) => [d.key, d.type === 'number' ? d.min : d.default]))
    const hi = Object.fromEntries(m.params.map((d) => [d.key, d.type === 'number' ? d.max : d.default]))
    for (const [label, p] of [['défaut', defaultParams(m)], ['minimum', lo], ['maximum', hi]]) {
      let res
      try {
        res = m.build(p)
        res = { ...res, panels: finishPanels(res.panels) }
      } catch (e) {
        check(false, `${m.id} (${label}) : plante : ${e.message}`)
        continue
      }
      check(res.panels.every((q) => /^[A-Z]+-\d\d+$/.test(q.id)), `${m.id} (${label}) : toutes les planches numérotées (${[...new Set(res.panels.map((q) => q.id))].join(' ')})`)
      const { file, warnings } = panelsToCutParts(res.panels, m.id)
      const back = parseCutParts(JSON.stringify(file))
      check(!warnings.length && !back.errors.length && back.parts.length === file.parts.length, `${m.id} (${label}) : ${res.panels.length} planches, ${file.parts.length} pièces, fichier cnc-parts valide (${[...warnings, ...back.errors].join(' | ')})`)
      const fin = finishPanels(res.panels)
      const issues = [...new Map(fin.map((q) => [q.id, q])).values()].flatMap((q) => {
        const xs = q.outer.map((v) => v[0])
        const ys = q.outer.map((v) => v[1])
        const marks = markPiece({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), outer: q.outer, holes: q.holes ?? [] }, q.id)
        return [...panelIssues(q), ...markIssues(q, marks)]
      })
      check(!issues.length, `${m.id} (${label}) : aucun trait résiduel${issues.length ? ' : ' + issues.slice(0, 3).map((i) => `${i.panel} ${i.kind} ${i.where}`).join(' ; ') : ''}`)
      const holesInside = back.parts.every((pt) => pt.holes.every((h) => h.every((q) => q[0] > 0 && q[1] > 0 && q[0] < pt.w && q[1] < pt.h)))
      check(holesInside, `${m.id} (${label}) : les trous restent à l’intérieur du contour`)
      // textes gravés (labels) : sur du bois plein, et le nom de la pièce ne les touche pas
      const labelBad = back.parts.filter((pt) => pt.labels?.length).flatMap((pt) => {
        const bad = pt.labels.filter((r) => r.some((q) => !lbInside(q, pt.outer) || pt.holes.some((h) => lbInside(q, h))))
        return bad.length ? [pt.id] : []
      })
      check(!labelBad.length, `${m.id} (${label}) : textes gravés sur du bois plein${labelBad.length ? ' : ' + labelBad.join(' ') : ''}`)
      const laid = buildAutoSheets(back.parts, { width: 300, height: 300, margin: 5, gap: 1 })
      const big = laid.flatMap((sh) => sh.rejected.map((r) => `${r.id} ${Math.round(r.w)}×${Math.round(r.h)}`))
      if (big.length) console.log(`note  ${m.id} (${label}) : ${big.length} pièce(s) plus grandes que 300 × 300 (${[...new Set(big)].slice(0, 4).join(', ')}${big.length > 4 ? '…' : ''}) : planche 400 × 320 nécessaire`)
      const machine = buildAutoSheets(back.parts, { width: 400, height: 320, margin: 5, gap: 1 })
      check(machine.every((sh) => sh.rejected.length === 0), `${m.id} (${label}) : toutes les pièces tiennent sur la machine (400 × 320)`)
    }
  }
  // --- « Optimiser mieux » : pièces rangées dans les trous (formes quelconques) d'autres pièces ---
  const { deepSearch } = await server.ssrLoadModule('/src/core/deep.ts')
  const { deepSignature, validDeep } = await server.ssrLoadModule('/src/core/sheets.ts')
  const mk = (id, outer, holes = [], extra = {}) => {
    const xs = outer.map((p) => p[0])
    const ys = outer.map((p) => p[1])
    const x0 = Math.min(...xs)
    const y0 = Math.min(...ys)
    const mv = (pts) => pts.map(([x, y]) => [x - x0, y - y0])
    return { key: `t/${id}`, id, category: 'T', project: 't', thickness: 3, material: 'ctp', outer: mv(outer), holes: holes.map(mv), qty: 1, rotate: 'any90', w: Math.max(...xs) - x0, h: Math.max(...ys) - y0, ...extra }
  }
  const rectPoly = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  const ellipse = (cx, cy, rx, ry, n = 48) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)])
  const ptSegDist = (p, a, b) => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1])
  }
  const edgeDist = (p, poly) => Math.min(...poly.map((a, i) => ptSegDist(p, a, poly[(i + 1) % poly.length])))
  const dset = { width: 300, height: 300, margin: 5, gap: 1 }
  const withDeep = (ps, s = dset, seeds = { 3: 0 }) => ({ ...s, deep: { sig: deepSignature(ps, s), seeds, before: 2, after: 1 } })

  // hôte 120 × 120 avec un grand trou ovale (90 × 60), petite pièce 40 × 20 qui y tient, pièce 80 × 50 qui tient dans la boîte du trou mais pas dans l'ovale
  const host = mk('H-01', rectPoly(0, 0, 120, 120), [ellipse(60, 60, 45, 30)])
  const little = mk('S-01', rectPoly(0, 0, 40, 20))
  const wide = mk('W-01', rectPoly(0, 0, 80, 50))
  const dpOne = [host, little]
  const dsOne = buildAutoSheets(dpOne, withDeep(dpOne))
  const dHost = dsOne[0]?.items.find((i) => i.part.id === 'H-01')
  const dLittle = dsOne[0]?.items.find((i) => i.part.id === 'S-01')
  const hole = dHost?.holes[0]
  check(dsOne.length === 1 && !!dHost && !!dLittle && dLittle.outer.every((p) => lbInside(p, hole)), 'optimiser mieux : la petite pièce est posée dans le trou ovale de l’hôte')
  check(dLittle.outer.every((p) => edgeDist(p, hole) >= 1 - 1e-6), 'optimiser mieux : au moins 1 mm de bois entre la petite pièce et le bord du trou')
  check(dsOne.every((sh) => conflicts(sh).size === 0), 'optimiser mieux : une pièce dans un trou n’est pas un conflit')
  const dJob = sheetToJob(dsOne[0], { names: false, frame: false })
  const dNames = dJob.pieces.map((p) => p.name)
  check(dNames.findIndex((n) => /S-01/.test(n)) < dNames.findIndex((n) => /H-01/.test(n)), 'optimiser mieux : la pièce du trou est coupée avant son hôte')
  const dsWide = buildAutoSheets([host, wide], withDeep([host, wide]))
  const dWide = dsWide.flatMap((sh) => sh.items).find((i) => i.part.id === 'W-01')
  const dWideHost = dsWide.flatMap((sh) => sh.items).find((i) => i.part.id === 'H-01')
  check(!!dWide && !dWide.outer.every((p) => lbInside(p, dWideHost.holes[0])), 'optimiser mieux : une pièce qui ne tient pas dans le trou n’y est pas posée')
  check(dsWide.every((sh) => conflicts(sh).size === 0), 'optimiser mieux : pièce hors trou sans conflit')

  // trou polygonal (triangle) et pièces tournées à 90°
  const tri = mk('TR-01', rectPoly(0, 0, 100, 100), [[[10, 90], [90, 90], [50, 20]]])
  const strip = mk('L-01', rectPoly(0, 0, 8, 30))
  const dsTri = buildAutoSheets([tri, strip], withDeep([tri, strip]))
  const triHole = dsTri[0].items.find((i) => i.part.id === 'TR-01').holes[0]
  const stripIn = dsTri[0].items.find((i) => i.part.id === 'L-01')
  check(dsTri.length === 1 && stripIn.outer.every((p) => lbInside(p, triHole) && edgeDist(p, triHole) >= 1 - 1e-6) && conflicts(dsTri[0]).size === 0, 'optimiser mieux : trou en triangle, pièce posée dedans à plus de 1 mm du bord')

  // un hôte tourné de 90° par le rangement de la planche emmène ses invitées
  const longHost = mk('LH-01', rectPoly(0, 0, 280, 60), [ellipse(140, 30, 100, 22)])
  const guest = mk('G-01', rectPoly(0, 0, 50, 20))
  const tallSettings = { width: 130, height: 300, margin: 5, gap: 1 }
  const dsTall = buildAutoSheets([longHost, guest], withDeep([longHost, guest], tallSettings))
  const tHost = dsTall.flatMap((sh) => sh.items).find((i) => i.part.id === 'LH-01')
  const tGuest = dsTall.flatMap((sh) => sh.items).find((i) => i.part.id === 'G-01')
  check(!!tHost && tHost.rot && tGuest.outer.every((p) => lbInside(p, tHost.holes[0])) && dsTall.every((sh) => conflicts(sh).size === 0), 'optimiser mieux : l’hôte tourné de 90° emmène la pièce de son trou')

  // reproductible : mêmes pièces et même solution, mêmes planches ; solution périmée ou absente : rangement normal inchangé
  const signature = (shs) => JSON.stringify(shs.map((sh) => sh.items.map((i) => [i.uid, i.x, i.y, i.rot, i.angle ?? null])))
  const again = buildAutoSheets(dpOne, withDeep(dpOne))
  check(signature(again) === signature(dsOne), 'optimiser mieux : deux calculs donnent exactement les mêmes planches')
  const plainOne = buildAutoSheets(dpOne, dset)
  const staleSet = { ...dset, deep: { sig: 'autre', seeds: { 3: 0 }, before: 2, after: 1 } }
  check(signature(buildAutoSheets(dpOne, staleSet)) === signature(plainOne) && !validDeep(dpOne, staleSet), 'optimiser mieux : solution périmée ignorée, rangement normal inchangé')
  check(!validDeep([host, wide], withDeep(dpOne)) && !!validDeep(dpOne, withDeep(dpOne)), 'optimiser mieux : un changement de pièces invalide la solution')
  check(!validDeep(dpOne, { ...withDeep(dpOne), gap: 2 }) && !validDeep(dpOne, { ...withDeep(dpOne), width: 310 }), 'optimiser mieux : un changement de réglage de planche invalide la solution')
  const sameBytes = JSON.parse(JSON.stringify(withDeep(dpOne)))
  check(signature(buildAutoSheets(dpOne, sameBytes)) === signature(dsOne), 'optimiser mieux : la solution relue depuis la sauvegarde redonne les mêmes planches')
  check(signature(buildAutoSheets(parts, settings)) === signature(buildAutoSheets(parts, { ...settings, deep: undefined })), 'optimiser mieux : sans solution, l’exemple est rangé comme avant')

  // mangeoire V3 : le rangement normal (sans plan) est exactement l'ancien ; la recherche polygonale gagne au moins une planche en 300 × 300
  // (6 au plus, ce que l'utilisateur obtient à la main), tout est posé, sans conflit, le jeu est respecté entre vrais contours, et le plan se rejoue vite et à l'identique
  const v3file = panelsToCutParts(finishPanels(v3.build(defaultParams(v3)).panels), v3.id).file
  const v3parts = parseCutParts(JSON.stringify(v3file)).parts
  const ringDist = (a, b) => {
    let m = Infinity
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) m = Math.min(m, ptSegDist(a[i], b[j], b[(j + 1) % b.length]), ptSegDist(b[j], a[i], a[(i + 1) % a.length]))
    return m
  }
  const minGap = (shs) => {
    let m = Infinity
    for (const sh of shs) for (let i = 0; i < sh.items.length; i++) for (let j = i + 1; j < sh.items.length; j++) {
      const a = sh.items[i]
      const b = sh.items[j]
      if (a.x > b.x + b.w + 5 || b.x > a.x + a.w + 5 || a.y > b.y + b.h + 5 || b.y > a.y + a.h + 5) continue
      for (const ra of [a.outer, ...a.holes]) for (const rb of [b.outer, ...b.holes]) m = Math.min(m, ringDist(ra, rb))
    }
    return m
  }
  const count = (shs) => shs.reduce((a, sh) => a + sh.items.length, 0)
  const v3plain = buildAutoSheets(v3parts, { width: 300, height: 300, margin: 5, gap: 1 })
  let opt300 = v3plain
  check(v3plain.map((sh) => sh.fill.toFixed(2)).join(' ') === '0.83 0.91 0.90 0.89 0.76 0.66 0.29', `mangeoire V3 300 × 300 sans plan : rangement inchangé (${v3plain.length} planches, remplissages ${v3plain.map((sh) => sh.fill.toFixed(2)).join(' ')})`)
  for (const [W, H, maxSeeds, atMost] of [[300, 300, 6, 6], [400, 320, 4, Infinity]]) {
    const s = { width: W, height: H, margin: 5, gap: 1 }
    const plain = buildAutoSheets(v3parts, s)
    const res = deepSearch(v3parts, s, { budgetMs: 15000, maxSeeds })
    const opt = buildAutoSheets(v3parts, res.plan ? { ...s, deep: res.plan } : s)
    if (W === 300) opt300 = opt
    check(opt.length <= plain.length - 1 && opt.length <= atMost && res.after.sheets === opt.length && res.before.sheets === plain.length && res.plan?.before === plain.length && res.plan?.after === opt.length, `mangeoire V3 ${W} × ${H} : ${plain.length} planches -> ${opt.length} planches après ${res.tried} essais en ${(res.ms / 1000).toFixed(1)} s (au plus ${Math.min(atMost, plain.length - 1)})`)
    check(count(opt) === count(plain) && opt.every((sh) => !sh.rejected.length && conflicts(sh).size === 0), `mangeoire V3 ${W} × ${H} : toutes les pièces posées, sans conflit`)
    check(minGap(opt) >= s.gap - 1e-6, `mangeoire V3 ${W} × ${H} : jeu de ${s.gap} mm respecté entre contours (min ${minGap(opt).toFixed(3)} mm)`)
    const tr0 = performance.now()
    const replay = buildAutoSheets(v3parts, JSON.parse(JSON.stringify(res.plan ? { ...s, deep: res.plan } : s)))
    const trMs = performance.now() - tr0
    check(signature(replay) === signature(opt) && trMs < 20, `mangeoire V3 ${W} × ${H} : le plan (${JSON.stringify(res.plan).length} octets) se rejoue à l’identique en ${trMs.toFixed(1)} ms`)
    const stalePlan = { ...s, deep: { ...res.plan, sig: 'autre' } }
    check(signature(buildAutoSheets(v3parts, stalePlan)) === signature(plain), `mangeoire V3 ${W} × ${H} : un plan à la signature périmée est ignoré`)
    const brokenPlan = { ...s, deep: { ...res.plan, places: Object.fromEntries(Object.entries(res.plan.places).map(([k, v]) => [k, v.map((p, i) => (i ? p : [p[0], p[1], p[2] + 2, p[3], p[4]]))])) } }
    check(signature(buildAutoSheets(v3parts, brokenPlan)) === signature(plain), `mangeoire V3 ${W} × ${H} : un plan dont une pièce chevauche une autre est ignoré (rangement normal)`)
    const pairs2 = []
    for (const sh of opt) {
      const order = sheetToJob(sh, { names: false, frame: false }).pieces
      order.forEach((outerPiece, oi) => order.forEach((other, ii) => { if (ii !== oi && outerPiece.contours.slice(1).some((h) => inPoly(other.contours[0][0], h))) pairs2.push(ii < oi) }))
    }
    check(pairs2.every(Boolean), `mangeoire V3 ${W} × ${H} : ${pairs2.length} pièces dans un trou, toutes coupées avant leur hôte`)
    check(opt.every((sh) => sh.items.every((it) => (marksFor(sh).get(it.uid) ?? []).flat().every((p) => p[0] >= it.x - 1e-6 && p[0] <= it.x + it.w + 1e-6 && p[1] >= it.y - 1e-6 && p[1] <= it.y + it.h + 1e-6))), `mangeoire V3 ${W} × ${H} : les noms gravés restent sur leur pièce`)
  }
  // rangement par type : la recherche se fait par famille et ne dégrade pas non plus
  const byTypeSet = { width: 300, height: 300, margin: 5, gap: 1, byType: true }
  const byTypeRes = deepSearch(v3parts, byTypeSet, { budgetMs: 8000, maxSeeds: 4 })
  const byTypePlain = buildAutoSheets(v3parts, byTypeSet)
  const byTypeOpt = buildAutoSheets(v3parts, byTypeRes.plan ? { ...byTypeSet, deep: byTypeRes.plan } : byTypeSet)
  check(byTypeOpt.length <= byTypePlain.length && byTypeOpt.every((sh) => conflicts(sh).size === 0) && count(byTypeOpt) === count(byTypePlain), `mangeoire V3 par type : ${byTypePlain.length} planches -> ${byTypeOpt.length}`)
  // « Modifier la planche » reprend les positions et angles du plan tels quels
  const { boardFromSheet } = await server.ssrLoadModule('/src/core/sheets.ts')
  const turnedSheet = opt300.find((sh) => sh.items.some((it) => it.angle !== undefined)) ?? opt300.reduce((a, b) => (b.items.length > a.items.length ? b : a))
  const bfs = boardFromSheet(turnedSheet, { names: true, frame: true })
  const bfsSheet = buildCustomSheet({ id: 'bfs', ...bfs }, v3parts, 5, 1)
  check(bfsSheet.items.length === turnedSheet.items.length && conflicts(bfsSheet).size === 0 && turnedSheet.items.every((it) => bfsSheet.items.some((o) => o.part.key === it.part.key && Math.abs(o.x - it.x) < 1e-6 && Math.abs(o.y - it.y) < 1e-6 && angleOf(o) === angleOf(it))), `modifier la planche : ${turnedSheet.items.length} pièces reprises aux mêmes positions et angles (${turnedSheet.items.filter((it) => it.angle !== undefined).length} à angle libre), sans conflit`)

  // deux L qui ne tiennent ensemble que par imbrication polygonale (boîtes 60 × 60 qui se chevauchent sur une zone utile de 80 × 80)
  const ell = (id) => mk(id, [[0, 0], [60, 0], [60, 10], [10, 10], [10, 60], [0, 60]])
  const ells = [ell('L-01'), ell('L-02')]
  const ellSet = { width: 90, height: 90, margin: 5, gap: 2 }
  const ellPlain = buildAutoSheets(ells, ellSet)
  const ellRes = deepSearch(ells, ellSet, { budgetMs: 5000, maxSeeds: 3 })
  const ellOpt = buildAutoSheets(ells, { ...ellSet, deep: ellRes.plan })
  const [la, lb] = ellOpt[0]?.items ?? []
  check(ellPlain.length === 2 && ellRes.plan && ellOpt.length === 1 && ellOpt[0].items.length === 2 && conflicts(ellOpt[0]).size === 0, `deux L : ${ellPlain.length} planches en rangement normal -> ${ellOpt.length} par imbrication`)
  check(la && lb && la.x < lb.x + lb.w && lb.x < la.x + la.w && la.y < lb.y + lb.h && lb.y < la.y + la.h, 'deux L : leurs boîtes se chevauchent (imbriquées), pas leurs contours')
  check(minGap(ellOpt) >= 2 - 1e-6, `deux L : jeu de 2 mm respecté (min ${minGap(ellOpt).toFixed(3)} mm)`)
  const ellNoRot = [ell('L-01'), { ...ell('L-02'), rotate: 'none' }]
  const ellNoRotOpt = buildAutoSheets(ellNoRot, { ...ellSet, deep: deepSearch(ellNoRot, ellSet, { budgetMs: 5000, maxSeeds: 3 }).plan ?? undefined })
  check(ellNoRotOpt.flatMap((sh) => sh.items).every((it) => it.part.rotate !== 'none' || angleOf(it) === 0), 'deux L : une pièce « sans rotation » reste à 0°')

  // --- store Redux : reducers purs, planches calculées, format de sauvegarde, persistance ---
  const mem = new Map()
  let writes = 0
  let failWrites = false
  const fakeStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      if (failWrites) throw new Error('plein')
      writes++
      mem.set(k, v)
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage, configurable: true, writable: true })
  const { createAppStore, persistStore, store: appStore } = await server.ssrLoadModule('/src/store/index.ts')
  const { projectActions, emptyProject, loadProject, serializeProject, importTexts, replaceTexts, ...sel } = await server.ssrLoadModule('/src/store/project/index.ts')
  const { modelsActions, loadModels, serializeModels } = await server.ssrLoadModule('/src/store/models/index.ts')
  const { uiActions } = await server.ssrLoadModule('/src/store/ui/index.ts')
  check(appStore.getState().project.parts.length === 0, 'store : le singleton se crée hors navigateur (projet vide)')

  const st = createAppStore()
  const rep = st.dispatch(importTexts([{ name: 'exemple.cutparts.json', text }]))
  check(rep[0].added === parts.length && rep[0].replaced === 0 && st.getState().project.parts.length === parts.length, 'store : import des pièces, bilan « ajoutées »')
  const rep2 = st.dispatch(importTexts([{ name: 'exemple.cutparts.json', text }]))
  check(rep2[0].added === 0 && rep2[0].replaced === parts.length, 'store : réimport = pièces remplacées, pas doublées')

  const k0 = parts[0].key
  const before = st.getState().project.parts
  st.dispatch(projectActions.qtySet({ key: k0, qty: 7.4 }))
  const after = st.getState().project.parts
  check(after.find((p) => p.key === k0).qty === 7 && after.length === before.length, 'store : quantité d’une pièce changée (arrondie)')
  check(after.filter((p) => p.key !== k0).every((p) => before.find((q) => q.key === p.key) === p), 'store : les autres pièces gardent leur référence (pas de re-rendu global)')
  st.dispatch(projectActions.qtySet({ key: k0, qty: -3 }))
  check(st.getState().project.parts.find((p) => p.key === k0).qty === 0, 'store : quantité jamais négative')
  st.dispatch(projectActions.qtySet({ key: k0, qty: parts[0].qty }))

  // planche perso : exemplaires en trop, déplacement puis retrait de la pièce
  const bAct = projectActions.boardAdded(3)
  st.dispatch(bAct)
  const bid = bAct.payload.id
  const B = () => st.getState().project.boards.find((b) => b.id === bid)
  check(B().width === 300 && B().marking.names && B().marking.frame, 'store : planche perso créée aux dimensions du projet')
  st.dispatch(projectActions.boardQtySet({ id: bid, key: k0, qty: 3 }))
  const uids = sel.selectBoardSheets(st.getState())[0].items.map((i) => i.uid)
  check(uids.length === 3 && uids.every((u) => u.startsWith(`${k0}#`)), 'store : 3 exemplaires sur la planche perso')
  for (const u of uids) st.dispatch(projectActions.overrideSet({ id: bid, instance: u, override: { x: 20, y: 20, rot: false } }))
  check(Object.keys(B().overrides).length === 3, 'store : 3 pièces déplacées à la main')
  st.dispatch(projectActions.boardQtySet({ id: bid, key: k0, qty: 1 }))
  check(Object.keys(B().overrides).join() === `${k0}#1` && B().qty[k0] === 1, 'store : exemplaires en trop perdent leur position manuelle')
  st.dispatch(projectActions.overrideSet({ id: bid, instance: `${k0}#1`, override: null }))
  check(Object.keys(B().overrides).length === 0, 'store : une position manuelle se retire')
  st.dispatch(projectActions.overrideSet({ id: bid, instance: `${k0}#1`, override: { x: 30, y: 30, rot: true } }))
  st.dispatch(projectActions.partRemoved(k0))
  check(!st.getState().project.parts.some((p) => p.key === k0) && !(k0 in B().qty) && Object.keys(B().overrides).length === 0, 'store : retirer une pièce vide ses quantités et positions en planche perso')

  // onglet, sélection, modèles : ne touchent jamais aux planches
  st.dispatch(projectActions.boardQtySet({ id: bid, key: parts[1].key, qty: 2 }))
  const s0 = st.getState()
  const auto0 = sel.selectAutoSheets(s0)
  const board0 = sel.selectBoardSheets(s0)
  const entries0 = sel.selectEntries(s0)
  st.dispatch(uiActions.tabSet('perso'))
  st.dispatch(uiActions.selectedPieceSet('x#1'))
  st.dispatch(modelsActions.modelPicked('autre'))
  st.dispatch(modelsActions.explodeSet(0.5))
  const s1 = st.getState()
  check(s1.ui.tab === 'perso' && s1.project === s0.project, 'store : changer d’onglet ne touche pas au projet')
  check(sel.selectAutoSheets(s1) === auto0 && sel.selectBoardSheets(s1) === board0 && sel.selectEntries(s1) === entries0, 'store : planches calculées gardées telles quelles (mémoïsées)')
  st.dispatch(projectActions.doneSet({ key: auto0[0].key, value: true }))
  check(sel.selectAutoSheets(st.getState()) === auto0 && sel.selectBoardSheets(st.getState()) === board0, 'store : cocher « fait » ne recalcule aucune planche')
  st.dispatch(projectActions.autoMarkingSet({ key: auto0[0].key, patch: { frame: false } }))
  const e1 = sel.selectEntries(st.getState())
  check(sel.selectAutoSheets(st.getState()) === auto0 && e1 !== entries0 && e1[0].marking.frame === false && e1[0].marking.names === true, 'store : une case de gravure ne change que les cases')
  st.dispatch(projectActions.qtySet({ key: parts[1].key, qty: parts[1].qty + 1 }))
  check(sel.selectAutoSheets(st.getState()) !== auto0, 'store : changer une quantité recalcule les planches automatiques')
  const live = st.getState().project
  const rebuilt = buildAutoSheets(live.parts, live.settings)
  check(rebuilt.length > 0 && sel.selectBoardSheets(st.getState())[0].items.length > 0, 'store : état figé lisible par le calcul des planches (sans mutation)')

  // modèles 3D : planches cachées par modèle
  st.dispatch(modelsActions.hiddenSet({ modelId: 'a', indices: [1, 2] }))
  st.dispatch(modelsActions.hiddenSet({ modelId: 'b', indices: [0] }))
  st.dispatch(modelsActions.hiddenSet({ modelId: 'a', indices: [] }))
  check(JSON.stringify(st.getState().models.hidden) === '{"b":[0]}', 'store : planches cachées gardées par modèle')

  // catalogue remplacé : quantités perso et « fait » à zéro, réglages gardés
  st.dispatch(projectActions.settingsSet({ width: 400 }))
  st.dispatch(replaceTexts([{ name: 'exemple.cutparts.json', text }]))
  const rp = st.getState().project
  check(rp.settings.width === 400 && Object.keys(rp.done).length === 0 && rp.boards.every((b) => !Object.keys(b.qty).length && !Object.keys(b.overrides).length) && rp.parts.length === parts.length, 'store : remplacer le catalogue remet quantités perso et « fait » à zéro, garde les réglages')
  st.dispatch(projectActions.cleared())
  check(JSON.stringify(st.getState().project) === JSON.stringify(emptyProject()), 'store : tout effacer remet un projet vide')

  // format de sauvegarde : identique à l’ancien (clés, ordre, valeurs)
  check(Object.keys(emptyProject()).join() === 'parts,settings,autoMarking,boards,done' && Object.keys(emptyProject().settings).join() === 'width,height,margin,gap,spread', 'sauvegarde : mêmes clés qu’avant')
  const legacy = JSON.stringify({ parts: parts.slice(0, 3), settings: { width: 600, height: 400, margin: 4, gap: 2, spread: true }, autoMarking: { 'k-1': { names: false, frame: true } }, boards: [{ ...board, qty: { [parts[0].key]: 2 } }], done: { 'k-1': true } })
  mem.set('cnc-projet-v1', legacy)
  check(serializeProject(loadProject()) === legacy, 'sauvegarde : une ancienne sauvegarde est relue puis réécrite à l’identique')
  mem.set('cnc-projet-v1', JSON.stringify({ parts: [] }))
  check(loadProject().settings.width === 300 && Object.keys(loadProject()).join() === 'parts,settings,autoMarking,boards,done', 'sauvegarde : champs manquants complétés')
  mem.set('cnc-projet-v1', 'pas du json')
  check(loadProject().parts.length === 0, 'sauvegarde : stockage illisible = projet vide')
  mem.set('cnc-modeles-v1', JSON.stringify({ model: 'm', params: { m: { a: 1 } } }))
  const lm = loadModels()
  check(lm.model === 'm' && serializeModels({ ...lm, explode: 2, hidden: { m: [1] }, measuring: true }) === '{"model":"m","params":{"m":{"a":1}}}', 'sauvegarde : modèle choisi et réglages au même format, le reste en mémoire seulement')

  // écriture dans localStorage : une seule, groupée, et seulement si la tranche a changé
  const listeners = []
  Object.defineProperty(globalThis, 'window', { value: { addEventListener: (_, f) => listeners.push(f), removeEventListener: () => {} }, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'document', { value: { addEventListener: () => {}, removeEventListener: () => {} }, configurable: true, writable: true })
  const ps = createAppStore()
  ps.dispatch(importTexts([{ name: 'e', text }]))
  const stopPersist = persistStore(ps)
  mem.delete('cnc-projet-v1')
  writes = 0
  for (let i = 0; i < 20; i++) ps.dispatch(projectActions.qtySet({ key: k0, qty: i }))
  ps.dispatch(uiActions.tabSet('auto'))
  check(writes === 0, 'persistance : rien n’est écrit à chaque action')
  await new Promise((r) => setTimeout(r, 400))
  check(writes === 1 && mem.get('cnc-projet-v1') === serializeProject(ps.getState().project), 'persistance : une seule écriture groupée, au format du projet')
  writes = 0
  ps.dispatch(uiActions.tabSet('perso'))
  ps.dispatch(modelsActions.explodeSet(1))
  await new Promise((r) => setTimeout(r, 400))
  check(writes === 0, 'persistance : changer d’onglet ou l’éclaté n’écrit rien')
  failWrites = true
  ps.dispatch(projectActions.qtySet({ key: k0, qty: 99 }))
  let tolerated = true
  try {
    listeners[0]()
  } catch {
    tolerated = false
  }
  failWrites = false
  check(tolerated && ps.getState().project.parts.find((p) => p.key === k0).qty === 99, 'persistance : stockage plein toléré, l’état reste en mémoire')
  stopPersist()
  delete globalThis.window
  delete globalThis.document
} finally {
  await server.close()
}
process.exit(failed ? 1 : 0)
