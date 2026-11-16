import { describe, expect, it } from 'vitest';
import { currentStreak, nextLift, planForDay, programPosition, weeklyCounts, type SessionLite } from './schedule';
import { progressionHint, epley } from './progression';
import { DAYS } from '../plan/days';
import type { Exercise } from '../plan/types';

const START = '2026-11-16'; // a Monday
const S = { startDate: START, liftDays: [1, 3, 5] as [number, number, number] };
const done = (date: string, type: string): SessionLite => ({ date, type, status: 'done' });

describe('programPosition', () => {
  it('is week 1 of cycle 1 on the start date', () => {
    const p = programPosition(START, START);
    expect(p).toMatchObject({ started: true, cycle: 1, week: 1, weekStart: START, testWeek: true });
    expect(p.phase.name).toBe('Re-entry');
  });
  it('counts days before the start', () => {
    expect(programPosition(START, '2026-11-13')).toMatchObject({ started: false, daysUntilStart: 3 });
  });
  it('moves through the phases', () => {
    expect(programPosition(START, '2026-11-22').week).toBe(1); // Sunday of week 1
    expect(programPosition(START, '2026-11-23').week).toBe(2);
    expect(programPosition(START, '2026-12-07').phase.name).toBe('Strength-power'); // week 4
    expect(programPosition(START, '2027-01-11').phase.name).toBe('Peak'); // week 9
    const w13 = programPosition(START, '2027-02-08');
    expect(w13).toMatchObject({ week: 13, cycle: 1, testWeek: true });
    expect(w13.phase.name).toBe('Deload + test');
  });
  it('repeats the cycle after week 13', () => {
    const p = programPosition(START, '2027-02-15');
    expect(p).toMatchObject({ cycle: 2, week: 1, weekIndex: 13 });
  });
  it('flags test weeks 1, 5, 9, 13', () => {
    const weeks = Array.from({ length: 13 }, (_, i) => programPosition(START, addWeeks(START, i))).filter((p) => p.testWeek).map((p) => p.week);
    expect(weeks).toEqual([1, 5, 9, 13]);
  });
});

function addWeeks(k: string, n: number) {
  const d = new Date(k + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

describe('missed-session rule', () => {
  it('starts with A', () => {
    expect(nextLift([])).toBe('A');
  });
  it('runs A → B → C → A', () => {
    expect(nextLift([done('2026-11-16', 'A')])).toBe('B');
    expect(nextLift([done('2026-11-16', 'A'), done('2026-11-18', 'B')])).toBe('C');
    expect(nextLift([done('2026-11-16', 'A'), done('2026-11-18', 'B'), done('2026-11-20', 'C')])).toBe('A');
  });
  it('ignores optional sessions and unfinished ones', () => {
    expect(nextLift([done('2026-11-16', 'A'), done('2026-11-21', 'D'), { date: '2026-11-18', type: 'B', status: 'active' }])).toBe('B');
  });
  it('shows the next session in sequence on a lifting day after a miss', () => {
    // Missed Monday's A; Wednesday should be A, not B.
    const p = planForDay('2026-11-18', S, []);
    expect(p).toMatchObject({ kind: 'lift', lift: 'A', calendarLift: 'B', behind: true });
  });
  it('is not behind when on schedule', () => {
    const p = planForDay('2026-11-18', S, [done('2026-11-16', 'A')]);
    expect(p).toMatchObject({ kind: 'lift', lift: 'B', behind: false });
  });
  it('keeps today’s lift fixed after finishing it', () => {
    const p = planForDay('2026-11-16', S, [done('2026-11-16', 'A')]);
    expect(p.lift).toBe('A');
    expect(p.doneToday).toEqual(['A']);
    expect(p.next).toBe('B');
  });
  it('carries the sequence across weeks', () => {
    // A Mon, missed Wed, B Fri → next Monday is C
    const p = planForDay('2026-11-23', S, [done('2026-11-16', 'A'), done('2026-11-20', 'B')]);
    expect(p.lift).toBe('C');
  });
});

describe('planForDay', () => {
  it('offers Day D on Saturday, and Sunday only if Saturday was skipped', () => {
    expect(planForDay('2026-11-21', S, []).kind).toBe('dayD');
    expect(planForDay('2026-11-22', S, []).kind).toBe('dayD');
    expect(planForDay('2026-11-22', S, [done('2026-11-21', 'D')]).kind).toBe('rest');
  });
  it('marks test day on Day D in test weeks', () => {
    expect(planForDay('2026-11-21', S, []).testDay).toBe(true); // week 1
    expect(planForDay('2026-11-28', S, []).testDay).toBe(false); // week 2
  });
  it('suggests cardio Tue/Thu but not the day before Day A or Day D', () => {
    expect(planForDay('2026-11-17', S, [done('2026-11-16', 'A')])).toMatchObject({ kind: 'cardio', cardioSuggested: true });
    // Thursday before Friday: Friday is C here (A, B done), so cardio is fine
    expect(planForDay('2026-11-19', S, [done('2026-11-16', 'A'), done('2026-11-18', 'B')]).cardioSuggested).toBe(true);
    // Thursday when tomorrow's lift would be A (A, B, C all done earlier)
    expect(planForDay('2026-11-19', S, [done('2026-11-16', 'A'), done('2026-11-17', 'B'), done('2026-11-18', 'C')]).cardioSuggested).toBe(false);
    // Friday when lift days are Mon/Wed/Thu → Friday is before Saturday (Day D)
    expect(planForDay('2026-11-20', { ...S, liftDays: [1, 3, 4] }, []).cardioSuggested).toBe(false);
  });
  it('switches to mobility + walking in the 3 days before a blood draw', () => {
    const s = { ...S, bloodDraw: '2026-11-20' };
    expect(planForDay('2026-11-16', s, []).kind).toBe('lift');
    expect(planForDay('2026-11-17', s, [])).toMatchObject({ kind: 'bloodDraw', bloodDrawIn: 3 });
    expect(planForDay('2026-11-20', s, []).kind).toBe('bloodDraw');
    expect(planForDay('2026-11-21', s, []).kind).toBe('dayD');
  });
});

describe('streaks', () => {
  it('counts weeks with 3+ sessions', () => {
    const s = [done('2026-11-16', 'A'), done('2026-11-18', 'B'), done('2026-11-20', 'C'), done('2026-11-23', 'A'), done('2026-11-25', 'B'), done('2026-11-28', 'D')];
    const counts = weeklyCounts(START, s, '2026-12-01');
    expect(counts).toEqual([3, 3, 0]);
    expect(currentStreak(counts)).toBe(2); // week 3 is unfinished, so it doesn't break the streak
    expect(currentStreak([3, 2, 0])).toBe(0);
  });
});

describe('prescriptions', () => {
  it('rotates Day A’s jump slot by week and drops jumps in the deload week', () => {
    const jump = DAYS.A.items.find((i) => i.key === 'jump')!;
    expect(jump.exercise(2)).toBe('box-jump');
    expect(jump.exercise(4)).toBe('depth-drop');
    expect(jump.exercise(7)).toBe('depth-jump');
    expect(jump.rx(13)).toBeNull();
  });
  it('halves sets in the deload week', () => {
    const dl = DAYS.A.items.find((i) => i.key === 'deadlift')!;
    expect(dl.rx(2)).toMatchObject({ sets: 4, reps: [6, 8] });
    expect(dl.rx(6)).toMatchObject({ sets: 4, reps: [5, 6] });
    expect(dl.rx(13)).toMatchObject({ sets: 2 });
  });
  it('adds a bike interval round each week, capped at 15', () => {
    const iv = DAYS.C.items.find((i) => i.key === 'intervals')!;
    expect([1, 2, 6, 10].map((w) => iv.rx(w)!.rounds)).toEqual([10, 11, 15, 15]);
  });
});

describe('progression', () => {
  const ex = { id: 'trap-bar-deadlift', log: ['weight', 'reps'] } as Exercise;
  const db = { id: 'db-bench-neutral', log: ['weight', 'reps'], upperDb: true } as Exercise;
  const rx = { sets: 3, reps: [6, 8] as [number, number] };
  it('suggests +5 lb when every set hit the top of the range', () => {
    expect(progressionHint(ex, rx, [8, 8, 8].map((r) => ({ done: true, weight: 200, reps: r })))).toBe('Go up 5 lb today');
    expect(progressionHint(db, rx, [8, 8, 8].map((r) => ({ done: true, weight: 50, reps: r })))).toBe('Go up 2.5 lb today');
  });
  it('stays quiet otherwise', () => {
    expect(progressionHint(ex, rx, [8, 8, 7].map((r) => ({ done: true, weight: 200, reps: r })))).toBeNull();
    expect(progressionHint(ex, rx, [8, 8].map((r) => ({ done: true, weight: 200, reps: r })))).toBeNull();
  });
  it('estimates 1RM with Epley', () => {
    expect(epley(200, 5)).toBeCloseTo(233.3, 1);
    expect(epley(200, 1)).toBe(200);
  });
});
