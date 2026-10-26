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
  const { buildAutoSheets, buildCustomSheet, conflicts, marksOf, marksFor } = await server.ssrLoadModule('/src/core/sheets.ts')
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
  const tiny = buildCustomSheet({ ...board, width: 30, height: 30, qty: { [parts[0].key]: 50 } }, parts, 5, 1)
  check(tiny.rejected.length > 0 && tiny.items.length + tiny.rejected.length === 50, 'planche perso trop petite : le reste est signalé')
  const other = buildCustomSheet({ ...board, thickness: 99 }, parts, 5, 1)
  check(other.items.length === 0, 'planche perso : une autre épaisseur ne prend pas les pièces')

  // export depuis un projet 3D : aller-retour avec la lecture
  const { toCutParts } = await server.ssrLoadModule('/export/exportParts.js')
  const sq = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]]
  const out = toCutParts([{ code: 'A-01', cat: 'X', outer: sq(10, 20), holes: [] }, { code: 'A-01', cat: 'X', outer: sq(10, 20), holes: [] }, { code: 'B-01', outer: sq(5, 5), holes: [sq(1, 1)] }], { project: 'essai', thickness: 3 })
  const back = parseCutParts(JSON.stringify(out.file))
  check(!out.warnings.length && !back.errors.length && back.parts.length === 2 && back.parts[0].qty === 2, 'export → lecture : doublons regroupés avec qty')
  const clash = toCutParts([{ code: 'A-01', outer: sq(10, 20) }, { code: 'A-01', outer: sq(11, 20) }], { project: 'essai', thickness: 3 })
  check(clash.warnings.length === 1, 'export : deux contours sous le même id signalés')

  // desserrer les petites pièces : pas de planche en plus, pas de chevauchement, petites pièces plus espacées
  const big = parseCutParts(readFileSync(new URL('../examples/etagere.cutparts.json', import.meta.url), 'utf8')).parts
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
} finally {
  await server.close()
}
process.exit(failed ? 1 : 0)
