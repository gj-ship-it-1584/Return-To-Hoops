/* Exercises added by hand: sensible default sets/reps, and turning them into plan items
   so they render with the same ExerciseCard as programmed moves. */
import type { AddedMove } from './db';
import type { PlanItem, Rx } from '../plan/days';
import { EXERCISES } from '../plan/exercises';

const shortId = () => Math.random().toString(36).slice(2, 8);

export function defaultMove(exerciseId: string): AddedMove {
  const ex = EXERCISES[exerciseId];
  const log = ex?.log ?? [];
  const m: AddedMove = { key: shortId(), exercise: exerciseId, sets: 3 };
  if (log.includes('rounds')) return { ...m, sets: 1, rounds: 10 };
  if (log.includes('minutes')) return { ...m, sets: 1, minutes: 10 };
  if (log.includes('makes')) return { ...m, sets: 1, makes: 10 };
  if (log.includes('meters')) return { ...m, meters: 40 };
  if (log.includes('seconds') && !log.includes('reps')) return { ...m, seconds: 30 };
  if (ex?.jump || log.includes('touchIn') || log.includes('boxIn') || log.includes('distanceIn')) return { ...m, reps: 3 };
  return { ...m, reps: 10 };
}

export function moveRx(m: AddedMove): Rx {
  return { sets: m.sets, reps: m.reps, seconds: m.seconds, meters: m.meters, makes: m.makes, rounds: m.rounds, minutes: m.minutes };
}

/** Which prescription field the add sheet lets you edit for this move. */
export function targetField(m: AddedMove): 'reps' | 'seconds' | 'meters' | 'makes' | 'rounds' | 'minutes' {
  if (m.rounds !== undefined) return 'rounds';
  if (m.minutes !== undefined) return 'minutes';
  if (m.makes !== undefined) return 'makes';
  if (m.meters !== undefined) return 'meters';
  if (m.seconds !== undefined) return 'seconds';
  return 'reps';
}

export const ADDED_PREFIX = 'add-';

export function toPlanItem(m: AddedMove): PlanItem {
  const ex = EXERCISES[m.exercise];
  return {
    key: ADDED_PREFIX + m.key,
    slot: ex?.slots[0] ?? 'core',
    section: 'added',
    exercise: () => m.exercise,
    rx: () => moveRx(m),
  };
}
