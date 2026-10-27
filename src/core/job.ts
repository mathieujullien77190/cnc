import { buildGcode, gcodeText, DEFAULT_MACHINE_SETTINGS, MACHINE_AREA, type GcodeJob, type LaserJob, type LaserItem, type MachineSettings } from '../laser'
import { planRoute, type Before, type Group } from './route'
import { drawingsFor, marksFor } from './sheets'
import type { Marking, Placed, Pt, Sheet } from './types'

/** Débord du cadre autour des pièces (mm). */
export const FRAME_OUTSET = 1

/** Cadre de gravure d'une planche : le plus petit rectangle qui entoure toutes ses pièces, élargi de FRAME_OUTSET et borné à la planche. Repère de la planche (y vers le bas). */
export const frameBox = (sheet: Sheet): { x0: number; y0: number; x1: number; y1: number } | null => {
  if (!sheet.items.length) return null
  const r = (v: number) => Math.round(v * 100) / 100
  return {
    x0: r(Math.max(0, Math.min(...sheet.items.map((it) => it.x)) - FRAME_OUTSET)),
    y0: r(Math.max(0, Math.min(...sheet.items.map((it) => it.y)) - FRAME_OUTSET)),
    x1: r(Math.min(sheet.width, Math.max(...sheet.items.map((it) => it.x + it.w)) + FRAME_OUTSET)),
    y1: r(Math.min(sheet.height, Math.max(...sheet.items.map((it) => it.y + it.h)) + FRAME_OUTSET)),
  }
}
export const frameRect = (sheet: Sheet): Pt[] | null => {
  const f = frameBox(sheet)
  return f ? [[f.x0, f.y0], [f.x1, f.y0], [f.x1, f.y1], [f.x0, f.y1]] : null
}

/** Repère machine : origine en bas à gauche, Y vers l'arrière (Y = H - y de la planche). */
const flipY = (H: number) => (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x, H - y])

const inPoly = (p: Pt, poly: Pt[]) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** Pour chaque pièce, les indices des pièces posées dans l'un de ses trous (des carrés dans des carrés). */
// pièces à couper AVANT `it` : celles rangées dans un de ses trous, et celles dont la boîte tient dans la sienne (un creux, un C, une encoche : elles sont
// dedans, on les coupe toujours en premier, avant que l'hôte ne bouge). La plus petite boîte passe devant : pas de cycle possible.
const EPS_BOX = 1e-6
const withinBox = (o: Placed, it: Placed) => o.x >= it.x - EPS_BOX && o.y >= it.y - EPS_BOX && o.x + o.w <= it.x + it.w + EPS_BOX && o.y + o.h <= it.y + it.h + EPS_BOX && o.w * o.h < it.w * it.h - EPS_BOX
const insideOf = (items: Placed[]): number[][] => items.map((it) => items.flatMap((o, j) => (o !== it && (it.holes.some((h) => inPoly(o.outer[0], h)) || withinBox(o, it)) ? [j] : [])))

/** Parcours de la tête d'un travail : déplacements à vide (laser éteint) avec l'ordre optimisé et avec le seul plus proche voisin. */
export interface Travel {
  mm: number
  baselineMm: number
}
const travels = new WeakMap<LaserJob, Travel>()
export const travelOf = (job: LaserJob): Travel | undefined => travels.get(job)

/** Temps laissé à la recherche d'un meilleur ordre, par étape (gravure des noms, coupe). */
const ROUTE_BUDGET_MS = 150

const jobCache = new WeakMap<Sheet, Map<string, LaserJob>>()

/**
 * Travail de découpe d'une planche. Gravure d'abord (matière intacte) : le cadre si `marking.frame`, puis les noms si `marking.names`, puis les dessins si `marking.drawings` ;
 * ensuite la coupe : une pièce n'est jamais coupée avant celles qui sont à l'intérieur de ses trous, trous avant le contour extérieur.
 * L'ordre des pièces et le point d'attaque de chaque contour sont choisis pour raccourcir les déplacements à vide (départ et retour en 0, 0).
 */
export const sheetToJob = (sheet: Sheet, marking: Marking): LaserJob => {
  const key = `${marking.names ? 1 : 0}${marking.frame ? 1 : 0}${marking.drawings !== false ? 1 : 0}`
  const hit = jobCache.get(sheet)?.get(key)
  if (hit) return hit
  const job = buildJob(sheet, marking)
  const byKey = jobCache.get(sheet) ?? new Map<string, LaserJob>()
  byKey.set(key, job)
  jobCache.set(sheet, byKey)
  return job
}

const buildJob = (sheet: Sheet, marking: Marking): LaserJob => {
  const flip = flipY(sheet.height)
  const origin: Pt = [0, 0]
  let pos = origin
  let travel = 0
  let baseline = 0

  // gravure : le cadre d'abord, puis les noms, pièce par pièce
  const engrave: Pt[][] = []
  const drawingLines: Pt[][] = [] // dessins des modèles : gravés après les noms, montrés d'une autre couleur dans l'aperçu laser
  const frame = marking.frame ? frameRect(sheet) : null
  if (frame) {
    const r = planRoute([{ free: [flip(frame)] }], [], pos, { budgetMs: 0 })
    engrave.push(...r.steps.flatMap((st) => st.contours))
    travel += r.travel
    baseline += r.baseline
    pos = r.end
  }
  if (marking.names) {
    const marks = marksFor(sheet)
    const groups: Group[] = [
      ...sheet.items.flatMap((it) => ((marks.get(it.uid)?.length ?? 0) ? [{ free: marks.get(it.uid)!.map(flip) }] : [])),
    ]
    const r = planRoute(groups, [], pos, { budgetMs: ROUTE_BUDGET_MS })
    engrave.push(...r.steps.flatMap((st) => st.contours))
    travel += r.travel
    baseline += r.baseline
    pos = r.end
  }

  if (marking.drawings !== false) {
    const drawings = drawingsFor(sheet)
    const groups: Group[] = sheet.items.flatMap((it) => ((drawings.get(it.uid)?.length ?? 0) ? [{ free: drawings.get(it.uid)!.map(flip) }] : []))
    if (groups.length) {
      const r = planRoute(groups, [], pos, { budgetMs: ROUTE_BUDGET_MS })
      drawingLines.push(...r.steps.flatMap((st) => st.contours))
      travel += r.travel
      baseline += r.baseline
      pos = r.end
    }
  }

  // coupe : l'ordre garantit que les pièces d'un trou sont coupées avant la pièce qui l'entoure
  const inner = insideOf(sheet.items)
  const groups: Group[] = sheet.items.map((it) => ({ free: it.holes.map(flip), last: flip(it.outer) }))
  const before: Before = inner.flatMap((js, i) => js.map((j): [number, number] => [j, i]))
  const route = planRoute(groups, before, pos, { end: origin, budgetMs: ROUTE_BUDGET_MS })
  travel += route.travel
  baseline += route.baseline
  const pieces: NonNullable<LaserJob['pieces']> = route.steps.map((st) => {
    const it = sheet.items[st.group]
    const outer = st.contours[st.contours.length - 1]
    return { name: `${it.n} ${it.part.id}`, contours: [outer, ...st.contours.slice(0, -1)] }
  })

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const it of sheet.items) {
    minX = Math.min(minX, it.x)
    maxX = Math.max(maxX, it.x + it.w)
    minY = Math.min(minY, sheet.height - (it.y + it.h))
    maxY = Math.max(maxY, sheet.height - it.y)
  }
  const job: LaserJob = {
    widthMm: sheet.width,
    heightMm: sheet.height,
    title: `${sheet.label} — contreplaqué ${sheet.thickness} mm`,
    layers: { cut: pieces.flatMap((p) => p.contours), ...(engrave.length ? { engrave } : {}), ...(drawingLines.length ? { drawings: drawingLines } : {}) },
    pieces,
    ordered: true,
    frame: sheet.items.length ? { minX, minY, maxX, maxY } : undefined,
  }
  travels.set(job, { mm: travel, baselineMm: baseline })
  return job
}


/** Les planches proposées au pilotage de la laser. Le travail d'une planche (ordre de coupe optimisé) n'est calculé que quand on la choisit. */
export const laserItems = (sheets: { sheet: Sheet; marking: Marking }[]): LaserItem[] =>
  sheets
    .filter((s) => s.sheet.items.length)
    .map(({ sheet, marking }) => {
      const item = { label: sheet.label, fileName: sheet.key } as LaserItem
      // calculé une seule fois, et seulement quand on le lit. Propriétés non énumérables : en développement, React lit toutes les propriétés
      // des props pour afficher leurs différences, ce qui lançait le calcul du parcours à chaque rendu (plus d'une seconde par clic).
      let job: ReturnType<typeof sheetToJob> | undefined
      const jobOf = () => (job ??= sheetToJob(sheet, marking))
      Object.defineProperty(item, 'job', { enumerable: false, get: jobOf })
      Object.defineProperty(item, 'extra', {
        enumerable: false,
        get: () => ({ pieces: sheet.items.length, sheetMm: { w: sheet.width, h: sheet.height }, fill: sheet.fill, travel: travelOf(jobOf()) }),
      })
      return item
    })

/** G-code d'une planche avec des réglages donnés (pour l'export sans machine branchée). */
export const sheetGcode = (sheet: Sheet, marking: Marking, o: Partial<MachineSettings> = {}): { text: string; job: GcodeJob } => {
  const s = { ...DEFAULT_MACHINE_SETTINGS, ...o }
  const job = buildGcode(sheetToJob(sheet, marking), {
    feed: s.feed,
    powerPct: s.power,
    passes: s.passes,
    passMode: s.passMode,
    sMax: 1000,
    capPct: s.capPct,
    air: s.air,
    engraveFeed: s.engraveFeed,
    engravePowerPct: s.engravePower,
    engravePasses: 1,
  })
  const b = job.stats.bounds
  if (b && (b.maxX > MACHINE_AREA.W || b.maxY > MACHINE_AREA.H)) job.header.unshift(`ATTENTION : le tracé dépasse la zone de la E1 Pro (${MACHINE_AREA.W} x ${MACHINE_AREA.H} mm)`)
  return { text: gcodeText(job), job }
}
