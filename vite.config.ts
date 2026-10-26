import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dossiers de pièces exportées par les projets 3D, lus par le serveur de dev (variable CNC_PARTS_DIR, séparés par « ; »).
const PARTS_DIRS = (process.env.CNC_PARTS_DIR ?? 'C:/projet/testBrick/cutparts;C:/Users/julli/Desktop/projects/cnc-laser-test/cutparts').split(';').filter(Boolean)

/** `GET /api/library` : liste des .json des dossiers ; `GET /api/library/<nom>` : le contenu d'un fichier. Dev seulement (le build statique n'a pas de serveur : le panneau se masque). */
const partsLibrary = (): Plugin => ({
  name: 'parts-library',
  configureServer(server) {
    server.middlewares.use('/api/library', async (req, res) => {
      const send = (code: number, body: string, type = 'application/json') => {
        res.statusCode = code
        res.setHeader('Content-Type', `${type}; charset=utf-8`)
        res.setHeader('Cache-Control', 'no-store')
        res.end(body)
      }
      try {
        const name = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\//, ''))
        if (!name) {
          const files = []
          for (const dir of PARTS_DIRS) {
            for (const f of await readdir(dir).catch(() => [])) {
              if (!f.toLowerCase().endsWith('.json')) continue
              const s = await stat(join(dir, f))
              files.push({ name: f, dir, size: s.size, mtime: s.mtimeMs })
            }
          }
          return send(200, JSON.stringify(files))
        }
        if (basename(name) !== name || !name.toLowerCase().endsWith('.json')) return send(400, '{"error":"nom invalide"}')
        for (const dir of PARTS_DIRS) {
          const text = await readFile(join(dir, name), 'utf8').catch(() => null)
          if (text !== null) return send(200, text)
        }
        send(404, '{"error":"introuvable"}')
      } catch (e) {
        send(500, JSON.stringify({ error: String(e) }))
      }
    })
  },
})

export default defineConfig({ plugins: [react(), tailwindcss(), partsLibrary()] })
