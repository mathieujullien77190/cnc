// Mesure temporaire : mangeoire-v3, rangement normal et recherche « Optimiser encore mieux »
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { parseCutParts } = await server.ssrLoadModule('/src/core/format.ts')
  const { buildAutoSheets, conflicts } = await server.ssrLoadModule('/src/core/sheets.ts')
  const { deepSearch } = await server.ssrLoadModule('/src/core/deep.ts')
  const { MODELS } = await server.ssrLoadModule('/src/models/registry.ts')
  const { panelsToCutParts, finishPanels } = await server.ssrLoadModule('/src/models/toCutParts.ts')
  const { defaultParams } = await server.ssrLoadModule('/src/models/types.ts')
  const { polyArea } = await server.ssrLoadModule('/src/core/hollow.ts')
  const v3 = MODELS.find((m) => m.id === 'mangeoire-v3')
  const file = panelsToCutParts(finishPanels(v3.build(defaultParams(v3)).panels), v3.id).file
  const parts = parseCutParts(JSON.stringify(file)).parts
  const solid = (p) => polyArea(p.outer) - p.holes.reduce((s, h) => s + polyArea(h), 0)
  if (process.argv.includes('--parts')) {
    for (const p of parts) console.log(p.id.padEnd(8), `x${p.qty}`, p.thickness, 'mm', p.w.toFixed(1), 'x', p.h.toFixed(1), 'box', (p.w * p.h).toFixed(0), 'solid', solid(p).toFixed(0), 'outer', p.outer.length, 'holes', p.holes.length, p.rotate)
  }
  const sizes = process.argv.includes('--big') ? [[300, 300], [400, 320]] : [[300, 300]]
  const budget = Number(process.argv.find((a) => a.startsWith('--budget='))?.slice(9) ?? 10000)
  for (const [W, H] of sizes) {
    const s = { width: W, height: H, margin: 5, gap: 1 }
    const t0 = performance.now()
    const plain = buildAutoSheets(parts, s)
    const tPlain = performance.now() - t0
    const fills = (shs) => shs.map((sh) => (sh.items.reduce((a, it) => a + solid(it.part), 0) / (W * H)).toFixed(2)).join(' ')
    const total = parts.reduce((a, p) => a + p.qty * solid(p), 0)
    console.log(`${W}x${H} normal : ${plain.length} planches en ${tPlain.toFixed(0)} ms, remplissage ${fills(plain)} (borne ${(total / (W * H)).toFixed(2)})`)
    const res = deepSearch(parts, s, { budgetMs: budget })
    console.log(`${W}x${H} deep   : ${res.before.sheets} -> ${res.after.sheets} planches, ${res.tried} essais, ${res.ms.toFixed(0)} ms, fill ${res.before.fill.toFixed(3)} -> ${res.after.fill.toFixed(3)}, plan ${res.plan ? JSON.stringify(res.plan).length : 0} octets`)
    if (res.plan) {
      const t1 = performance.now()
      const opt = buildAutoSheets(parts, { ...s, deep: res.plan })
      const tOpt = performance.now() - t1
      console.log(`${W}x${H} rejoué : ${opt.length} planches en ${tOpt.toFixed(1)} ms, remplissage ${fills(opt)}, conflits ${opt.reduce((a, sh) => a + conflicts(sh).size, 0)}, rejetées ${opt.reduce((a, sh) => a + sh.rejected.length, 0)}, posées ${opt.reduce((a, sh) => a + sh.items.length, 0)}`)
    }
  }
} finally {
  await server.close()
}
