/* Program position, what to do today, the missed-session rule and streaks.
   Pure functions so they can be unit-tested. */
import { CYCLE_WEEKS, isTestWeek, phaseForWeek, type Phase } from '../plan/phases';
import { LIFT_ORDER, type DayId } from '../plan/days';
import { addDays, diffDays, weekday } from './dates';

export interface ProgramPos {
  started: boolean;
  daysUntilStart: number;
  /** 1-based cycle number */
  cycle: number;
  /** 1–13 week within the cycle */
  week: number;
  /** weeks since the program started (0-based), across cycles */
  weekIndex: number;
  phase: Phase;
  /** first day of this program week */
  weekStart: string;
  testWeek: boolean;
}

export function programPosition(startDate: string, date: string): ProgramPos {
  const d = diffDays(startDate, date);
  if (d < 0) {
    return { started: false, daysUntilStart: -d, cycle: 1, week: 1, weekIndex: 0, phase: phaseForWeek(1), weekStart: startDate, testWeek: true };
  }
  const weekIndex = Math.floor(d / 7);
  const week = (weekIndex % CYCLE_WEEKS) + 1;
  return {
    started: true,
    daysUntilStart: 0,
    cycle: Math.floor(weekIndex / CYCLE_WEEKS) + 1,
    week,
    weekIndex,
    phase: phaseForWeek(week),
    weekStart: addDays(startDate, weekIndex * 7),
    testWeek: isTestWeek(week),
  };
}

export interface SessionLite {
  date: string;
  type: string;
  status: 'active' | 'done';
  deleted?: boolean;
}

/** Missed-session rule: lifting days run A → B → C. The next lift is the one after the last completed lift. */
export function nextLift(sessions: SessionLite[], beforeOrOn?: string): DayId {
  const lifts = sessions
    .filter((s) => !s.deleted && s.status === 'done' && (LIFT_ORDER as string[]).includes(s.type) && (!beforeOrOn || s.date <= beforeOrOn))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = lifts[lifts.length - 1];
  if (!last) return 'A';
  const i = LIFT_ORDER.indexOf(last.type as DayId);
  return LIFT_ORDER[(i + 1) % LIFT_ORDER.length];
}

export interface ScheduleSettings {
  startDate: string;
  liftDays: [number, number, number];
  bloodDraw?: string;
}

export type TodayKind = 'lift' | 'dayD' | 'cardio' | 'rest' | 'bloodDraw';

export interface TodayPlan {
  kind: TodayKind;
  /** the lift to do today (next in sequence) when kind = 'lift' */
  lift?: DayId;
  /** what the calendar says for today, if it is a lifting day */
  calendarLift?: DayId;
  /** true when the sequence is behind the calendar (a session was missed) */
  behind: boolean;
  /** the next lift in sequence, for display on non-lifting days */
  next: DayId;
  /** easy cardio is suggested (never on the day before Day A or Day D) */
  cardioSuggested: boolean;
  testDay: boolean;
  /** sessions already completed today */
  doneToday: string[];
  pos: ProgramPos;
  bloodDrawIn?: number;
}

const isWeekend = (wd: number) => wd === 0 || wd === 6;

export function planForDay(date: string, s: ScheduleSettings, sessions: SessionLite[]): TodayPlan {
  const pos = programPosition(s.startDate, date);
  const wd = weekday(date);
  const live = sessions.filter((x) => !x.deleted);
  const doneToday = live.filter((x) => x.date === date && x.status === 'done').map((x) => x.type);
  // today's lift is decided by what was completed before today, so it doesn't change mid-day once done
  const next = nextLift(live, addDays(date, -1));
  const nextAfterToday = nextLift(live, date);
  const liftIdx = s.liftDays.indexOf(wd);
  const calendarLift = liftIdx >= 0 ? LIFT_ORDER[liftIdx] : undefined;
  const base = { behind: false, next: nextAfterToday, cardioSuggested: false, testDay: false, doneToday, pos };

  if (s.bloodDraw) {
    const until = diffDays(date, s.bloodDraw);
    if (until >= 0 && until <= 3) return { ...base, kind: 'bloodDraw', bloodDrawIn: until };
  }

  if (calendarLift) {
    return { ...base, kind: 'lift', lift: next, calendarLift, behind: next !== calendarLift };
  }

  if (isWeekend(wd)) {
    // Day D is optional on Saturday or Sunday; only one per week.
    const weekendStart = wd === 0 ? addDays(date, -1) : date;
    const dDone = live.some((x) => x.type === 'D' && x.status === 'done' && x.date >= weekendStart && x.date < date);
    if (!dDone) return { ...base, kind: 'dayD', testDay: pos.started && pos.testWeek };
    return { ...base, kind: 'rest' };
  }

  // A non-lifting weekday: optional easy cardio unless tomorrow is Day A or Day D.
  const tomorrow = addDays(date, 1);
  const twd = weekday(tomorrow);
  const tomorrowIsA = s.liftDays.includes(twd) && nextAfterToday === 'A';
  const tomorrowIsD = isWeekend(twd);
  return { ...base, kind: 'cardio', cardioSuggested: !tomorrowIsA && !tomorrowIsD };
}

/** Week-by-week session counts and the current streak of weeks with ≥ 3 sessions. */
export function weeklyCounts(startDate: string, sessions: SessionLite[], today: string): number[] {
  const pos = programPosition(startDate, today);
  if (!pos.started) return [];
  const counts = new Array(pos.weekIndex + 1).fill(0);
  for (const x of sessions) {
    if (x.deleted || x.status !== 'done' || !['A', 'B', 'C', 'D', 'pickup'].includes(x.type)) continue;
    const d = diffDays(startDate, x.date);
    if (d < 0) continue;
    const w = Math.floor(d / 7);
    if (w < counts.length) counts[w]++;
  }
  return counts;
}

export function currentStreak(counts: number[], target = 3): number {
  if (!counts.length) return 0;
  let i = counts.length - 1;
  // the current week only counts once it has hit the target; an unfinished week doesn't break the streak
  if (counts[i] < target) i--;
  let n = 0;
  for (; i >= 0 && counts[i] >= target; i--) n++;
  return n;
}
