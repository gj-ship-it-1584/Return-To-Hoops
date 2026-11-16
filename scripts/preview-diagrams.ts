/* Render exercise diagrams to a PNG contact sheet so they can be checked by eye.
   Usage:
     npx tsx scripts/preview-diagrams.ts <out.png> [file-or-id-filter ...]
   Filters match an exercise id, or the exercises module file name (e.g. "jumps").
   Each row: name, then Start | middle frame | End, plus a contact report on stdout. */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { fitView, renderFrame, contactReport } from '../src/figure/figure';
import { ALL_EXERCISES, EXERCISE_FILES } from '../src/plan/exercises';

const [out, ...filters] = process.argv.slice(2);
if (!out) {
  console.error('usage: tsx scripts/preview-diagrams.ts out.png [filter...]');
  process.exit(1);
}
const list = filters.length
  ? ALL_EXERCISES.filter((e) => filters.some((f) => e.id === f || e.id.includes(f) || (EXERCISE_FILES[f] ?? []).includes(e.id)))
  : ALL_EXERCISES;
if (!list.length) {
  console.error('nothing matched', filters);
  process.exit(1);
}

const PW = 200, PH = 160, LABEL = 22, COLS = 2;
const cellW = PW * 3 + 12;
const cellH = PH + LABEL + 8;
const rows = Math.ceil(list.length / COLS);
const W = cellW * COLS + 20, H = rows * cellH + 20;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let body = `<rect width="${W}" height="${H}" fill="#0b0d12"/>`;
list.forEach((e, i) => {
  const cx = 10 + (i % COLS) * cellW;
  const cy = 10 + Math.floor(i / COLS) * cellH;
  const view = fitView(e.diagram);
  body += `<text x="${cx + 4}" y="${cy + 16}" fill="#e6e9ef" font-family="Segoe UI, Arial" font-size="14" font-weight="600">${esc(e.name)} <tspan fill="#8a93a3" font-weight="400">(${e.id})</tspan></text>`;
  [0, 0.5, 1].forEach((t, k) => {
    const inner = renderFrame(e.diagram, { t, view, inner: true, muscles: e.muscles });
    const x = cx + k * (PW + 4), y = cy + LABEL;
    body += `<rect x="${x}" y="${y}" width="${PW}" height="${PH}" fill="#141821" rx="6"/>`;
    body += `<svg x="${x}" y="${y}" width="${PW}" height="${PH}" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="xMidYMax meet">${inner}</svg>`;
  });
  const ra = contactReport(e.diagram.a), rb = contactReport(e.diagram.b);
  console.log(`${e.id}\n  A ${JSON.stringify(ra)}\n  B ${JSON.stringify(rb)}`);
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
writeFileSync(out, png);
console.log(`wrote ${out} (${list.length} exercises)`);
