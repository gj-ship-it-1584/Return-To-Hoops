/* Per-date changes to the schedule: a different workout, added workouts, swapped moves. */
import { db, planId, type AddedMove, type PlannedDay, type Session, type SessionType } from './db';
import { save } from './store';

export async function getPlan(date: string): Promise<PlannedDay | undefined> {
  const p = await db.plans.get(planId(date));
  return p && !p.deleted ? p : undefined;
}

async function update(date: string, fn: (p: PlannedDay) => PlannedDay) {
  const cur = (await getPlan(date)) ?? { id: planId(date), u: 0, date };
  const next = fn({ ...cur, deleted: false });
  const empty =
    !next.type &&
    !(next.extra && next.extra.length) &&
    !(next.swaps && Object.keys(next.swaps).length) &&
    !Object.values(next.moves ?? {}).some((l) => l.length) &&
    !(next.activities && next.activities.length) &&
    !Object.values(next.order ?? {}).some((l) => l.length);
  await save<PlannedDay>('plans', { ...next, deleted: empty ? true : undefined });
}

/** Replace the scheduled workout for a date; undefined puts the normal schedule back. */
export const setDayType = (date: string, type: PlannedDay['type'] | undefined) => update(date, (p) => ({ ...p, type }));

export const addExtra = (date: string, type: SessionType) => update(date, (p) => ({ ...p, extra: [...(p.extra ?? []), type] }));

export const removeExtra = (date: string, index: number) => update(date, (p) => ({ ...p, extra: (p.extra ?? []).filter((_, i) => i !== index) }));

/** Swap a move for this date only. slotKey = `${day}:${itemKey}`; undefined removes the swap. */
export const setPlannedSwap = (date: string, slotKey: string, exerciseId: string | undefined) =>
  update(date, (p) => {
    const swaps = { ...(p.swaps ?? {}) };
    if (exerciseId) swaps[slotKey] = exerciseId;
    else delete swaps[slotKey];
    return { ...p, swaps };
  });

/** The planned swaps for one day type on a date, keyed by plan item key (the shape Session.swaps uses). */
export function swapsFor(plan: PlannedDay | undefined, day: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(plan?.swaps ?? {})) {
    const [d, key] = k.split(':');
    if (d === day) out[key] = v;
  }
  return out;
}

/** A stand-in session so resolveExercise() can read planned swaps for a future day. */
export const plannedSession = (plan: PlannedDay | undefined, day: string, cycle: number) =>
  ({ swaps: swapsFor(plan, day), cycle }) as unknown as Session;

/** Add an exercise to one workout on a date (day = 'A'…'D' or 'mobility'). */
export const addPlannedMove = (date: string, day: string, move: AddedMove) =>
  update(date, (p) => ({ ...p, moves: { ...(p.moves ?? {}), [day]: [...(p.moves?.[day] ?? []), move] } }));

export const removePlannedMove = (date: string, day: string, key: string) =>
  update(date, (p) => ({ ...p, moves: { ...(p.moves ?? {}), [day]: (p.moves?.[day] ?? []).filter((m) => m.key !== key) } }));

export const movesFor = (plan: PlannedDay | undefined, day: string): AddedMove[] => plan?.moves?.[day] ?? [];

export const addPlannedActivity = (date: string, a: { type: string; minutes: number; label?: string }) =>
  update(date, (p) => ({ ...p, activities: [...(p.activities ?? []), { key: Math.random().toString(36).slice(2, 8), ...a }] }));

export const removePlannedActivity = (date: string, key: string) =>
  update(date, (p) => ({ ...p, activities: (p.activities ?? []).filter((a) => a.key !== key) }));

export const setPlannedOrder = (date: string, day: string, keys: string[] | undefined) =>
  update(date, (p) => {
    const order = { ...(p.order ?? {}) };
    if (keys) order[day] = keys;
    else delete order[day];
    return { ...p, order };
  });

/** Sort plan items by a saved key order; anything not in the order keeps its place at the end. */
export function applyOrder<T extends { key: string }>(items: T[], order?: string[]): T[] {
  if (!order?.length) return items;
  const rank = (k: string, i: number) => {
    const at = order.indexOf(k);
    return at === -1 ? order.length + i : at;
  };
  return items.map((it, i) => ({ it, r: rank(it.key, i) })).sort((a, b) => a.r - b.r).map((x) => x.it);
}
