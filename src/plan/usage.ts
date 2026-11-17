/* Which day(s) each exercise is programmed on, for the library tags. Derived from days.ts. */
import { COURT_WARMUP, DAYS, WARMUP, type DayId } from './days';

export interface DayTag {
  /** 'A' | 'B' | 'C' | 'D' | 'warmup' | 'court-warmup' */
  key: string;
  label: string;
}

function weeksText(weeks: number[]): string {
  const w = [...new Set(weeks)].sort((a, b) => a - b);
  // on in every regular week (1–12, with or without the deload week) → no qualifier
  if (w.filter((x) => x <= 12).length === 12) return '';
  const contiguous = w.every((x, i) => i === 0 || x === w[i - 1] + 1);
  if (contiguous) return w.length === 1 ? ` · wk ${w[0]}` : ` · wk ${w[0]}–${w[w.length - 1]}`;
  return ` · wk ${w.join(', ')}`;
}

function build(): Record<string, DayTag[]> {
  const map = new Map<string, Map<string, number[]>>();
  const add = (ex: string, key: string, week: number) => {
    if (!map.has(ex)) map.set(ex, new Map());
    const m = map.get(ex)!;
    m.set(key, [...(m.get(key) ?? []), week]);
  };
  for (const day of Object.values(DAYS))
    for (const item of day.items)
      for (let w = 1; w <= 13; w++) if (item.rx(w) !== null) add(item.exercise(w), day.id, w);
  const out: Record<string, DayTag[]> = {};
  for (const [ex, m] of map) {
    out[ex] = (['A', 'B', 'C', 'D', 'R'] as DayId[]).filter((d) => m.has(d)).map((d) => ({ key: d, label: `${DAYS[d].title}${weeksText(m.get(d)!)}` }));
  }
  for (const r of WARMUP) (out[r.exercise] ??= []).push({ key: 'warmup', label: 'Warm-up' });
  for (const r of COURT_WARMUP) (out[r.exercise] ??= []).push({ key: 'court-warmup', label: 'Court day warm-up' });
  return out;
}

export const DAY_TAGS: Record<string, DayTag[]> = build();
