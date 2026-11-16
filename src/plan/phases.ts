/* 12-week cycle + deload/test week. After week 13 the cycle repeats from week 1. */

export interface Phase {
  id: 1 | 2 | 3 | 4;
  name: string;
  weeks: [number, number];
  effort: string;
  strength: string;
  jumps: string;
  /** weekly max-effort jump target [low, high] */
  jumpTarget: [number, number];
  court: string;
}

export const CYCLE_WEEKS = 13;
export const TEST_WEEKS = [1, 5, 9, 13];

export const PHASES: Phase[] = [
  {
    id: 1,
    name: 'Re-entry',
    weeks: [1, 3],
    effort: 'Leave 2 reps in the tank',
    strength: '4 × 6–8 on main lifts',
    jumps: 'Box jumps, trap bar jumps, broad jumps, bounds',
    jumpTarget: [80, 100],
    court: 'Sprints up to 80%, approach jumps',
  },
  {
    id: 2,
    name: 'Strength-power',
    weeks: [4, 8],
    effort: 'Leave 1–2 reps in the tank',
    strength: '4 × 5–6, heavier',
    jumps: 'Depth drops (wk 4–5), then depth jumps (wk 6+)',
    jumpTarget: [100, 130],
    court: 'Sprints up to 90%',
  },
  {
    id: 3,
    name: 'Peak',
    weeks: [9, 12],
    effort: 'Leave 1 rep in the tank',
    strength: '4 × 3–5, heaviest',
    jumps: 'Depth jumps, max approach jumps, dunk attempts',
    jumpTarget: [120, 150],
    court: 'Full speed, 17s, pickup games',
  },
  {
    id: 4,
    name: 'Deload + test',
    weeks: [13, 13],
    effort: 'Easy week',
    strength: 'Half the sets at about 60%',
    jumps: 'Test day only',
    jumpTarget: [0, 0],
    court: 'Shooting only',
  },
];

export function phaseForWeek(week: number): Phase {
  return PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) ?? PHASES[0];
}

export const isTestWeek = (week: number) => TEST_WEEKS.includes(week);
