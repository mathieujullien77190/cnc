import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { parseCutParts } = await server.ssrLoadModule('/src/core/format.ts')
  const { MODELS } = await server.ssrLoadModule('/src/models/registry.ts')
  const { panelsToCutParts, finishPanels } = await server.ssrLoadModule('/src/models/toCutParts.ts')
  const { defaultParams } = await server.ssrLoadModule('/src/models/types.ts')
  const v3 = MODELS.find((m) => m.id === 'mangeoire-v3')
  const file = panelsToCutParts(finishPanels(v3.build(defaultParams(v3)).panels), v3.id).file
  const parts = parseCutParts(JSON.stringify(file)).parts
  for (const id of process.argv.slice(2)) {
    const p = parts.find((q) => q.id === id)
    console.log(id, p.w, p.h, 'outer', JSON.stringify(p.outer.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)])))
    for (const h of p.holes) console.log('  hole', JSON.stringify(h.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)])))
  }
} finally { await server.close() }
