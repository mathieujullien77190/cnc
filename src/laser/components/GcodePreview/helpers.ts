import type { Segment } from '../../grbl';

/** Chemin SVG des segments coupés (`cut`, ou `engrave` pour la gravure) ou rapides, les segments qui se suivent étant joints en une seule polyligne. */
export function segmentsPath(segments: Segment[], cut: boolean, engrave: boolean, drawing = false): string {
  let d = '';
  let ex = Infinity, ey = Infinity;
  const f = (n: number) => +n.toFixed(2);
  for (const s of segments) {
    if (s.cut !== cut || (cut && (!!s.engrave !== engrave || (engrave && !!s.drawing !== drawing)))) continue;
    if (Math.abs(s.x0 - ex) > 1e-6 || Math.abs(s.y0 - ey) > 1e-6) d += `M${f(s.x0)} ${f(s.y0)}`;
    d += `L${f(s.x1)} ${f(s.y1)}`;
    ex = s.x1; ey = s.y1;
  }
  return d;
}

/** Fenêtre visible de l'aperçu, dans le repère du dessin (comme un `viewBox` SVG). */
export interface View { x: number; y: number; w: number; h: number }

/** Zoom maximal : la fenêtre ne descend pas en dessous de 1/`ZOOM_MAX` de la vue d'ensemble. */
export const ZOOM_MAX = 40;

/**
 * Zoom de `factor` (> 1 : on s'approche) autour du point (`px`, `py`) du dessin, qui reste sous le curseur. Jamais plus large que la vue d'ensemble `base`
 * (on revient alors à `base`), jamais plus étroit que `base.w / ZOOM_MAX`.
 */
export function zoomView(v: View, base: View, factor: number, px: number, py: number): View {
  const w = Math.min(base.w, Math.max(base.w / ZOOM_MAX, v.w / factor));
  if (w >= base.w) return { ...base };
  const k = w / v.w, h = v.h * k;
  return clampView({ x: px - (px - v.x) * k, y: py - (py - v.y) * k, w, h }, base);
}

/** Déplace la fenêtre de (`dx`, `dy`) unités du dessin, en la gardant dans la vue d'ensemble. */
export function panView(v: View, base: View, dx: number, dy: number): View {
  return clampView({ ...v, x: v.x + dx, y: v.y + dy }, base);
}

/** Garde la fenêtre `v` à l'intérieur de `base` (elle n'en est jamais plus grande). */
function clampView(v: View, base: View): View {
  return { ...v, x: Math.min(base.x + base.w - v.w, Math.max(base.x, v.x)), y: Math.min(base.y + base.h - v.h, Math.max(base.y, v.y)) };
}

/** Combien de segments en avant du dernier connu on cherche la tête : assez pour qu'une position rafraîchie lentement (la tête a parcouru beaucoup de petits segments) ne fasse pas décrocher le suivi. */
export const LOOKAHEAD = 400;

/** Parmi les segments à moins de cette distance (mm) du plus proche, on prend le premier : la tête est sur le tracé, un segment lointain qui s'en approche ne la lui prend pas. */
const TIE = 0.3;

/** Distance (mm) d'un point au segment [a, b]. */
function distanceToSegment(px: number, py: number, s: Segment): number {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, len2 = dx * dx + dy * dy;
  const u = len2 > 0 ? Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / len2)) : 0;
  return Math.hypot(px - (s.x0 + u * dx), py - (s.y0 + u * dy));
}

/**
 * Où en est le tracé : l'indice du segment que la tête est en train de parcourir. Les segments d'avant sont faits, ceux d'après restent à faire.
 * Le suivi part du dernier segment connu (`from`) et cherche la tête parmi les `LOOKAHEAD` suivants (le premier à moins de `TIE` du plus proche) : la machine a beaucoup de lignes d'avance dans sa mémoire tampon
 * (`acked` = lignes acceptées), donc on ne se fie pas aux lignes envoyées, seulement à la position réelle. Un segment n'est jamais compté s'il n'a pas été envoyé.
 * Sans position de la tête, on reste où l'on est. `segLines` = ligne qui trace chaque segment (`GcodeJob.segLines`).
 */
export function currentSegment(segments: Segment[], segLines: number[], acked: number, head: { x: number; y: number } | undefined, from = 0): number {
  let queued = 0;
  while (queued < segLines.length && segLines[queued] < acked) queued++;
  if (queued === 0 || !head) return from;
  const start = Math.min(from, queued - 1), end = Math.min(queued, from + LOOKAHEAD), dist: number[] = [];
  for (let k = start; k < end; k++) dist.push(distanceToSegment(head.x, head.y, segments[k]));
  const near = Math.min(...dist);
  return start + dist.findIndex((d) => d <= near + TIE);
}

/**
 * Tracé fait / à faire, au fil de l'eau : les segments d'avant `done` sont faits, celui que la tête parcourt est coupé en deux à la position de la tête
 * (la partie déjà parcourue part dans `done`, le reste dans `rest`), ceux d'après restent à faire.
 */
export function splitAtHead(segments: Segment[], done: number, head?: { x: number; y: number }): { done: Segment[]; rest: Segment[] } {
  const k = Math.min(done, segments.length);
  const doneSegs = segments.slice(0, k), rest = segments.slice(k);
  const cur = rest[0];
  if (cur && head && cur.cut) {
    const dx = cur.x1 - cur.x0, dy = cur.y1 - cur.y0, len2 = dx * dx + dy * dy;
    const u = len2 > 0 ? Math.max(0, Math.min(1, ((head.x - cur.x0) * dx + (head.y - cur.y0) * dy) / len2)) : 0;
    const px = cur.x0 + u * dx, py = cur.y0 + u * dy;
    doneSegs.push({ ...cur, x1: px, y1: py });
    rest[0] = { ...cur, x0: px, y0: py };
  }
  return { done: doneSegs, rest };
}
