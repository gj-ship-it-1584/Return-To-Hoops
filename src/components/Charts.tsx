/* Hand-drawn SVG charts (no chart library), in the spirit of Shea's Log. Tap to read a value. */
import { useState, type ReactNode } from 'react';
import { parseKey, fmtShort, keyOf } from '../lib/dates';

export const CHART = {
  accent: '#ff7a1a',
  blue: '#5aa7ff',
  green: '#34c77b',
  yellow: '#f5c84c',
  red: '#ff5a5a',
  purple: '#b48cff',
  grid: '#262c3b',
  text: '#8a93a3',
};

export interface Pt {
  date: string;
  y: number;
}
export interface Series {
  points: Pt[];
  color: string;
  label?: string;
  line?: boolean;
  dots?: boolean;
  dashed?: boolean;
}

const W = 340;
const PAD = { l: 34, r: 8, t: 10, b: 20 };

const niceStep = (span: number) => {
  const raw = span / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
};

export function LineChart({
  series,
  height = 170,
  band,
  refs = [],
  yFmt = (v) => `${Math.round(v * 10) / 10}`,
  empty = 'No data yet',
  xFrom,
  xTo,
}: {
  series: Series[];
  height?: number;
  band?: [number, number];
  refs?: { y: number; label?: string; color?: string }[];
  yFmt?: (v: number) => string;
  empty?: ReactNode;
  xFrom?: string;
  xTo?: string;
}) {
  const [sel, setSel] = useState<{ s: number; i: number } | null>(null);
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <div className="flex h-24 items-center justify-center rounded-xl bg-card2 text-sm text-faint">{empty}</div>;
  const xs = all.map((p) => parseKey(p.date).getTime());
  let x0 = xFrom ? parseKey(xFrom).getTime() : Math.min(...xs);
  let x1 = xTo ? parseKey(xTo).getTime() : Math.max(...xs);
  if (x1 - x0 < 86400000 * 6) {
    x0 -= 86400000 * 3;
    x1 += 86400000 * 3;
  }
  const ys = [...all.map((p) => p.y), ...refs.map((r) => r.y), ...(band ?? [])];
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 4) {
    // too flat to read: give it some room so the axis labels don't repeat
    const pad = Math.max(2, Math.abs(y1) * 0.04);
    y0 -= pad;
    y1 += pad;
  }
  const step = niceStep(y1 - y0);
  y0 = Math.floor(y0 / step) * step;
  y1 = Math.ceil(y1 / step) * step;
  const H = height;
  const sx = (t: number) => PAD.l + ((t - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - PAD.t - PAD.b);
  const ticks: number[] = [];
  for (let v = y0; v <= y1 + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  const selPt = sel ? series[sel.s]?.points[sel.i] : null;

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    let best: { s: number; i: number; d: number } | null = null;
    series.forEach((s, si) =>
      s.points.forEach((p, i) => {
        const d = Math.abs(sx(parseKey(p.date).getTime()) - x);
        if (!best || d < best.d) best = { s: si, i, d };
      }),
    );
    if (best) setSel({ s: (best as { s: number }).s, i: (best as { i: number }).i });
  };

  return (
    <div>
      <div className="mb-1 h-5 text-xs text-muted">
        {selPt ? (
          <span>
            <span style={{ color: series[sel!.s].color }}>●</span> {series[sel!.s].label ? `${series[sel!.s].label}: ` : ''}
            <b className="tnum text-ink">{yFmt(selPt.y)}</b> · {fmtShort(selPt.date)}
          </span>
        ) : (
          <span className="text-faint">Tap the chart to read a value</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" onPointerDown={(e) => pick(e.clientX, e.currentTarget)} onPointerMove={(e) => e.buttons && pick(e.clientX, e.currentTarget)}>
        {band && <rect x={PAD.l} width={W - PAD.l - PAD.r} y={sy(band[1])} height={Math.max(1, sy(band[0]) - sy(band[1]))} fill={CHART.green} opacity={0.12} />}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke={CHART.grid} strokeWidth={1} />
            <text x={PAD.l - 4} y={sy(t) + 3.5} fontSize={10} fill={CHART.text} textAnchor="end">{yFmt(t)}</text>
          </g>
        ))}
        {refs.map((r, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(r.y)} y2={sy(r.y)} stroke={r.color ?? CHART.green} strokeWidth={1.4} strokeDasharray="5 4" />
            {r.label && <text x={W - PAD.r - 2} y={sy(r.y) - 4} fontSize={10} fill={r.color ?? CHART.green} textAnchor="end">{r.label}</text>}
          </g>
        ))}
        <text x={PAD.l} y={H - 5} fontSize={10} fill={CHART.text}>{fmtShort(keyOf(new Date(x0)))}</text>
        <text x={W - PAD.r} y={H - 5} fontSize={10} fill={CHART.text} textAnchor="end">{fmtShort(keyOf(new Date(x1)))}</text>
        {series.map((s, si) => {
          const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1));
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(parseKey(p.date).getTime()).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
          return (
            <g key={si}>
              {s.line !== false && pts.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeDasharray={s.dashed ? '4 3' : undefined} />}
              {(s.dots ?? true) && pts.map((p, i) => <circle key={i} cx={sx(parseKey(p.date).getTime())} cy={sy(p.y)} r={s.line === false ? 2.6 : 3} fill={s.color} opacity={s.line === false ? 0.6 : 1} />)}
            </g>
          );
        })}
        {selPt && <line x1={sx(parseKey(selPt.date).getTime())} x2={sx(parseKey(selPt.date).getTime())} y1={PAD.t} y2={H - PAD.b} stroke="#fff" strokeOpacity={0.3} />}
      </svg>
      {series.length > 1 && series.some((s) => s.label) && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {series.filter((s) => s.label).map((s) => <span key={s.label}><span style={{ color: s.color }}>●</span> {s.label}</span>)}
        </div>
      )}
    </div>
  );
}

export function BarChart({
  bars,
  colors,
  labels,
  height = 150,
  target,
  yFmt = (v) => `${Math.round(v)}`,
}: {
  bars: { label: string; values: number[] }[];
  colors: string[];
  labels?: string[];
  height?: number;
  target?: number | [number, number];
  yFmt?: (v: number) => string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  if (!bars.length) return <div className="flex h-24 items-center justify-center rounded-xl bg-card2 text-sm text-faint">No data yet</div>;
  const H = height;
  const tgtHigh = Array.isArray(target) ? target[1] : target ?? 0;
  const max = Math.max(1, tgtHigh, ...bars.map((b) => b.values.reduce((a, c) => a + c, 0)));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const sy = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const bw = (W - PAD.l - PAD.r) / bars.length;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  const s = sel !== null ? bars[sel] : null;
  return (
    <div>
      <div className="mb-1 h-5 text-xs text-muted">
        {s ? (
          <span>
            <b className="text-ink">{s.label}</b>: {s.values.map((v, i) => `${labels?.[i] ? labels[i] + ' ' : ''}${yFmt(v)}`).filter((_, i) => s.values[i] > 0 || s.values.length === 1).join(' · ') || '0'}
          </span>
        ) : (
          <span className="text-faint">Tap a bar</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke={CHART.grid} />
            <text x={PAD.l - 4} y={sy(t) + 3.5} fontSize={10} fill={CHART.text} textAnchor="end">{yFmt(t)}</text>
          </g>
        ))}
        {Array.isArray(target) ? (
          <rect x={PAD.l} width={W - PAD.l - PAD.r} y={sy(target[1])} height={sy(target[0]) - sy(target[1])} fill={CHART.green} opacity={0.12} />
        ) : target ? (
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(target)} y2={sy(target)} stroke={CHART.green} strokeDasharray="5 4" strokeWidth={1.4} />
        ) : null}
        {bars.map((b, i) => {
          let acc = 0;
          return (
            <g key={i} onPointerDown={() => setSel(i)}>
              <rect x={PAD.l + i * bw} y={PAD.t} width={bw} height={H - PAD.t - PAD.b} fill="transparent" />
              {b.values.map((v, k) => {
                if (v <= 0) return null;
                const yTop = sy(acc + v), yBot = sy(acc);
                acc += v;
                return <rect key={k} x={PAD.l + i * bw + bw * 0.15} width={bw * 0.7} y={yTop} height={Math.max(0.5, yBot - yTop)} fill={colors[k % colors.length]} rx={1.5} opacity={sel === null || sel === i ? 1 : 0.5} />;
              })}
              {(bars.length <= 14 || i % Math.ceil(bars.length / 10) === 0) && (
                <text x={PAD.l + i * bw + bw / 2} y={H - 5} fontSize={9.5} fill={CHART.text} textAnchor="middle">{b.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {labels && labels.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {labels.map((l, i) => <span key={l}><span style={{ color: colors[i % colors.length] }}>■</span> {l}</span>)}
        </div>
      )}
    </div>
  );
}
