import type { GcodeJob } from '../grbl/gcode';

/** Reprise d'un travail interrompu : d'où repartir, et à quelle distance du tracé se trouve vraiment la tête. */
export interface Resume {
  /** Programme à envoyer : l'en-tête du travail, un déplacement à vide vers le début du contour en cours, puis la suite. */
  job: GcodeJob;
  /** Ligne du programme d'origine où la reprise commence (1 = première). */
  fromLine: number;
  /** Pièce dont le contour est refait, si le programme la nomme. */
  piece?: string;
  /** Distance (mm) entre la tête et le tracé : grande = la position ne correspond plus (origine perdue, planche bougée). */
  gapMm: number;
}

const dist = (px: number, py: number, s: { x0: number; y0: number; x1: number; y1: number }) => {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / l2)) : 0;
  return Math.hypot(px - (s.x0 + t * dx), py - (s.y0 + t * dy));
};

/**
 * Cherche dans le tracé (première passe) le segment de coupe le plus proche de la tête, remonte au début de son contour et fabrique le programme
 * qui repart de là. Le contour entamé est refait en entier (on ne sait pas où le faisceau s'est éteint) ; les passes suivantes sont rejouées.
 * `null` si le programme n'a pas de tracé exploitable.
 */
export function resumeFrom(job: GcodeJob, head: { x: number; y: number }): Resume | null {
  const { segments, segLines } = job;
  if (!segLines || !segments.length) return null;
  let best = -1, gap = Infinity;
  segments.forEach((s, i) => {
    if (!s.cut) return;
    const d = dist(head.x, head.y, s);
    if (d < gap) { gap = d; best = i; }
  });
  if (best < 0) return null;

  // début du contour : le segment juste après un déplacement à vide
  let k = best;
  while (k > 0 && segments[k - 1].cut && !!segments[k - 1].engrave === !!segments[best].engrave) k--;
  const start = segLines[k];
  const prologueEnd = job.lines.indexOf('M4 S0');
  if (start === undefined || prologueEnd < 0 || start <= prologueEnd) return null;

  const first = segments[k];
  const lines = [...job.lines.slice(0, prologueEnd + 1), `G0 X${Math.round(first.x0 * 1000) / 1000} Y${Math.round(first.y0 * 1000) / 1000}`, ...job.lines.slice(start)];
  const offset = prologueEnd + 2 - start; // ligne d'origine L → ligne L + offset dans le programme de reprise
  const baseT = job.lineTimes[start - 1] ?? 0;
  const head0 = job.lineTimes.slice(0, prologueEnd + 1);
  const lineTimes = [...head0, head0[head0.length - 1] ?? 0, ...job.lineTimes.slice(start).map((t) => t - baseT + (head0[head0.length - 1] ?? 0))];
  const total = lineTimes[lineTimes.length - 1] ?? 0;
  return {
    job: {
      ...job,
      lines,
      lineTimes,
      segments: segments.slice(k),
      segLines: segLines.slice(k).map((l) => l + offset),
      stats: { ...job.stats, lines: lines.length, seconds: total },
    },
    fromLine: start + 1,
    piece: segments[best].piece,
    gapMm: gap,
  };
}
