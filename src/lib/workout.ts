/* Session helpers: which exercise fills a slot today, last-time numbers, jump volume, swaps. */
import { db, uid, type CycleSwap, type Session, type SessionType, type SetLog, type Checkin } from './db';
import { save } from './store';
import { DAYS, type DayId, type PlanItem, type Rx } from '../plan/days';
import { EXERCISES } from '../plan/exercises';
import { programPosition } from './schedule';
import { addDays } from './dates';

export const slotKeyOf = (day: string, item: PlanItem) => `${day}:${item.key}`;

/** Planned exercise, unless swapped "just today" (session) or "rest of this cycle". */
export function resolveExercise(day: DayId, item: PlanItem, week: number, session: Session | undefined, cycleSwaps: CycleSwap[]): { id: string; planned: string; swapped: 'today' | 'cycle' | null } {
  const planned = item.exercise(week);
  const today = session?.swaps?.[item.key];
  if (today && today !== planned) return { id: today, planned, swapped: 'today' };
  const cyc = cycleSwaps.find((s) => !s.deleted && s.slotKey === slotKeyOf(day, item) && s.from === planned && s.cycle === (session?.cycle ?? s.cycle));
  if (cyc && EXERCISES[cyc.to]) return { id: cyc.to, planned, swapped: 'cycle' };
  return { id: planned, planned, swapped: null };
}

export async function startSession(type: SessionType, startDate: string, date: string): Promise<Session> {
  const pos = programPosition(startDate, date);
  return save<Session>('sessions', {
    id: uid(),
    date,
    type,
    cycle: pos.cycle,
    week: pos.week,
    startedAt: Date.now(),
    status: 'active',
    ticked: [],
    swaps: {},
  });
}

/** The most recent earlier session's completed sets for an exercise. */
export async function lastSets(exerciseId: string, excludeSessionId?: string): Promise<{ date: string; sets: SetLog[] } | null> {
  const all = await db.sets.where('exerciseId').equals(exerciseId).filter((s) => !s.deleted && s.done && s.sessionId !== excludeSessionId).toArray();
  if (!all.length) return null;
  const latest = all.reduce((a, b) => (b.date > a.date || (b.date === a.date && b.u > a.u) ? b : a));
  const sets = all.filter((s) => s.sessionId === latest.sessionId).sort((a, b) => a.idx - b.idx);
  return { date: latest.date, sets };
}

/** Max-effort jumps done in a program week (jump-flagged exercises + dunk attempts). */
export async function jumpsInWeek(weekStart: string): Promise<number> {
  const end = addDays(weekStart, 7);
  const sets = await db.sets.where('date').between(weekStart, end, true, false).filter((s) => !s.deleted && s.done).toArray();
  let n = 0;
  for (const s of sets) if (EXERCISES[s.exerciseId]?.jump) n += s.reps ?? 0;
  const sessions = await db.sessions.where('date').between(weekStart, end, true, false).filter((s) => !s.deleted).toArray();
  for (const s of sessions) n += s.dunks?.length ?? 0;
  return n;
}

/** Knee/Achilles above 3 or stiffness past the warm-up any day this week → halve jump volume. */
export async function tendonFlag(weekStart: string): Promise<Checkin | null> {
  const end = addDays(weekStart, 7);
  const c = await db.checkins.where('date').between(weekStart, end, true, false).filter((x) => !x.deleted && ((x.knee ?? 0) > 3 || (x.achilles ?? 0) > 3 || !!x.stiff)).first();
  return c ?? null;
}

export function halveJumps(rx: Rx): Rx {
  return { ...rx, sets: Math.max(1, Math.ceil(rx.sets / 2)), note: [rx.note, 'halved this week'].filter(Boolean).join(' · ') };
}

/** Distinct slots swapped in this cycle (cycle-long swaps + any "just today" swaps). */
export async function swapCount(cycle: number): Promise<number> {
  const keys = new Set<string>();
  for (const s of await db.swaps.where('cycle').equals(cycle).filter((x) => !x.deleted).toArray()) keys.add(s.slotKey);
  for (const s of await db.sessions.where('cycle').equals(cycle).filter((x) => !x.deleted).toArray())
    for (const k of Object.keys(s.swaps ?? {})) keys.add(`${s.type}:${k}`);
  return keys.size;
}

export function rxText(rx: Rx): string {
  const n = (v: number | [number, number]) => (Array.isArray(v) ? `${v[0]}–${v[1]}` : `${v}`);
  let s = '';
  if (rx.rounds) s = `${rx.rounds} rounds`;
  else if (rx.minutes) s = `${rx.minutes} min`;
  else if (rx.makes) s = rx.sets > 1 ? `${rx.sets} × ${rx.makes} shots` : `${rx.makes}`;
  else if (rx.reps !== undefined) s = `${rx.sets} × ${n(rx.reps)}`;
  else if (rx.seconds !== undefined) s = `${rx.sets} × ${n(rx.seconds)} s`;
  else if (rx.meters) s = `${rx.sets} × ${rx.meters} m`;
  if (rx.perSide) s += ' per side';
  return s;
}

export const dayItems = (day: DayId, week: number) => DAYS[day].items.filter((i) => i.rx(week) !== null);
