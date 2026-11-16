/* Calculations behind the Trends screen. Pure functions over the stored records. */
import type { BodyLog, CardioLog, Session, SetLog, TestResult } from './db';
import type { Pt } from '../components/Charts';
import { addDays, diffDays, parseKey } from './dates';
import { epley } from './progression';
import { RATE_TARGET } from '../plan/content';

export const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Weigh-ins plus a 7-day rolling average at each weigh-in. */
export function weightSeries(body: BodyLog[]) {
  const w = body.filter((b) => b.weight !== undefined).sort(byDate);
  // one value per day (latest entry wins)
  const perDay = new Map<string, number>();
  for (const b of w) perDay.set(b.date, b.weight!);
  const days = [...perDay.entries()].map(([date, y]) => ({ date, y }));
  const avg = days.map((d) => {
    const win = days.filter((x) => diffDays(x.date, d.date) >= 0 && diffDays(x.date, d.date) < 7);
    return { date: d.date, y: win.reduce((a, c) => a + c.y, 0) / win.length };
  });
  return { days, avg };
}

/** Least-squares slope in lb per week over the given points. */
export function slopePerWeek(points: Pt[]): number | null {
  if (points.length < 2) return null;
  const t0 = parseKey(points[0].date).getTime();
  const xs = points.map((p) => (parseKey(p.date).getTime() - t0) / (7 * 86400000));
  const ys = points.map((p) => p.y);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den ? num / den : null;
}

export interface RateStatus {
  /** lb lost per week over the last 4 weeks (positive = losing) */
  loss: number | null;
  text: string;
  tone: 'good' | 'warn' | 'muted';
  /** calorie change the plan calls for, if the rate has been off for 2 straight weeks */
  adjust: -150 | 150 | 0;
}

export function rateStatus(days: Pt[], today: string): RateStatus {
  const recent = days.filter((d) => diffDays(d.date, today) < 28);
  const s = slopePerWeek(recent);
  if (s === null || recent.length < 4 || diffDays(recent[0].date, recent[recent.length - 1].date) < 10) {
    return { loss: null, text: 'Log weight 2–3 mornings a week; the rate shows after about 2 weeks.', tone: 'muted', adjust: 0 };
  }
  const loss = -s;
  const r = Math.round(loss * 10) / 10;
  // weekly averages for the last three 7-day blocks
  const block = (k: number) => {
    const win = days.filter((d) => {
      const ago = diffDays(d.date, today);
      return ago >= k * 7 && ago < (k + 1) * 7;
    });
    return win.length ? win.reduce((a, c) => a + c.y, 0) / win.length : null;
  };
  const [b0, b1, b2] = [block(0), block(1), block(2)];
  let adjust: RateStatus['adjust'] = 0;
  if (b0 !== null && b1 !== null && b2 !== null) {
    const l1 = b1 - b0, l2 = b2 - b1;
    if (l1 < RATE_TARGET.flagLow && l2 < RATE_TARGET.flagLow) adjust = -150;
    else if (l1 > RATE_TARGET.flagHigh && l2 > RATE_TARGET.flagHigh) adjust = 150;
  }
  if (loss < 0) return { loss, text: `Gaining ${Math.abs(r)} lb/week`, tone: 'warn', adjust };
  if (loss < RATE_TARGET.low) return { loss, text: `Losing ${r} lb/week — slower than the 0.5–1 target`, tone: 'warn', adjust };
  if (loss <= RATE_TARGET.high) return { loss, text: `Losing ${r} lb/week, on pace`, tone: 'good', adjust };
  if (loss <= RATE_TARGET.flagHigh) return { loss, text: `Losing ${r} lb/week — a little fast, fine short term`, tone: 'good', adjust };
  return { loss, text: `Losing ${r} lb/week — too fast; you'll lose muscle and jump`, tone: 'warn', adjust };
}

/** Best approach touch per day, from test days and approach-jump sets. */
export function touchSeries(tests: TestResult[], sets: SetLog[]): Pt[] {
  const m = new Map<string, number>();
  const put = (date: string, v: number) => m.set(date, Math.max(m.get(date) ?? 0, v));
  for (const t of tests) for (const a of t.approach) put(t.date, a);
  for (const s of sets) if (s.touchIn) put(s.date, s.touchIn);
  return [...m.entries()].map(([date, y]) => ({ date, y })).sort(byDate);
}

export function standingVertical(tests: TestResult[], reach?: number): Pt[] {
  return tests
    .map((t) => {
      const r = t.reach ?? reach;
      const best = Math.max(0, ...t.standing);
      return r && best ? { date: t.date, y: Math.round((best - r) * 10) / 10 } : null;
    })
    .filter((p): p is Pt => !!p)
    .sort(byDate);
}

/** Best value of one field per session date for an exercise. */
export function bestPerDay(sets: SetLog[], exerciseIds: string[], f: (s: SetLog) => number | undefined): Pt[] {
  const m = new Map<string, number>();
  for (const s of sets) {
    if (!exerciseIds.includes(s.exerciseId)) continue;
    const v = f(s);
    if (v === undefined || v <= 0) continue;
    m.set(s.date, Math.max(m.get(s.date) ?? 0, v));
  }
  return [...m.entries()].map(([date, y]) => ({ date, y })).sort(byDate);
}

export const e1rmSeries = (sets: SetLog[], id: string) => bestPerDay(sets, [id], (s) => (s.weight && s.reps ? epley(s.weight, s.reps) : undefined));

/** Strength ÷ body weight, using the latest weigh-in on or before each date. */
export function relative(series: Pt[], body: Pt[]): Pt[] {
  return series
    .map((p) => {
      const bw = [...body].reverse().find((b) => b.date <= p.date) ?? body[0];
      return bw ? { date: p.date, y: Math.round((p.y / bw.y) * 100) / 100 } : null;
    })
    .filter((p): p is Pt => !!p);
}

/** Program-week buckets from startDate up to today. */
export function weekBuckets(startDate: string, today: string, from?: string) {
  const n = Math.max(0, Math.floor(diffDays(startDate, today) / 7)) + 1;
  const out: { start: string; index: number }[] = [];
  for (let i = 0; i < n; i++) {
    const start = addDays(startDate, i * 7);
    if (from && addDays(start, 6) < from) continue;
    out.push({ start, index: i });
  }
  return out;
}

export const inWeek = (date: string, start: string) => date >= start && date < addDays(start, 7);

export function cardioByWeek(cardio: CardioLog[], weeks: { start: string }[]) {
  const types = ['incline', 'bike', 'rower', 'other', 'dog'] as const;
  return weeks.map((w) => types.map((t) => cardio.filter((c) => inWeek(c.date, w.start) && (c.type === t || (t === 'other' && !types.includes(c.type as (typeof types)[number])))).reduce((a, c) => a + c.minutes, 0)));
}

export const doneSessions = (sessions: Session[]) => sessions.filter((s) => s.status === 'done' && !s.deleted).sort(byDate);
