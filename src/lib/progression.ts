/* Progression hints, estimated 1-rep max and pre-fill rules. */
import type { Rx } from '../plan/days';
import type { Exercise } from '../plan/types';

export const epley = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export const topReps = (rx: Rx): number | undefined => (Array.isArray(rx.reps) ? rx.reps[1] : rx.reps);

export interface SetLike {
  done: boolean;
  weight?: number;
  reps?: number;
  boxIn?: number;
}

/** "Go up 5 lb today" when every set last time hit the top of the rep range. */
export function progressionHint(ex: Exercise, rx: Rx, last: SetLike[]): string | null {
  const done = last.filter((s) => s.done);
  if (!done.length) return null;
  if (ex.log.includes('boxIn') && ex.id === 'box-jump') {
    return done.length >= rx.sets ? 'If every rep landed quietly last time, raise the box 2 in.' : null;
  }
  if (!ex.log.includes('weight') || !ex.log.includes('reps')) return null;
  const top = topReps(rx);
  if (!top || done.length < rx.sets) return null;
  if (!done.every((s) => (s.reps ?? 0) >= top)) return null;
  if (!done.some((s) => (s.weight ?? 0) > 0)) {
    return ex.id === 'feet-elevated-pushup' ? 'All sets hit the top of the range — add a vest or plate.' : null;
  }
  return `Go up ${ex.upperDb ? '2.5' : '5'} lb today`;
}

/** Round to a loadable weight. */
export const roundLoad = (lb: number, step = 5) => Math.round(lb / step) * step;

/** Deload week pre-fill: about 60% of the last weight. */
export const deloadWeight = (lb: number, upperDb?: boolean) => roundLoad(lb * 0.6, upperDb ? 2.5 : 5);
