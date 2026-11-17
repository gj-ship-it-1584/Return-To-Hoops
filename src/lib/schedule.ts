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

export type TodayKind = 'lift' | 'dayD' | 'rehab' | 'cardio' | 'rest' | 'bloodDraw';

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
  /** today's plan was changed by hand */
  overridden: boolean;
  /** workouts added to today on top of the main one */
  extra: string[];
}

/** A hand-made change for one date (see PlannedDay in db.ts). */
export interface PlanLite {
  date: string;
  type?: string;
  extra?: string[];
  deleted?: boolean;
}

const isWeekend = (wd: number) => wd === 0 || wd === 6;

export function planForDay(date: string, s: ScheduleSettings, sessions: SessionLite[], plans: PlanLite[] = []): TodayPlan {
  const pos = programPosition(s.startDate, date);
  const wd = weekday(date);
  const live = sessions.filter((x) => !x.deleted);
  const doneToday = live.filter((x) => x.date === date && x.status === 'done').map((x) => x.type);
  // today's lift is decided by what was completed before today, so it doesn't change mid-day once done
  const next = nextLift(live, addDays(date, -1));
  const nextAfterToday = nextLift(live, date);
  const liftIdx = s.liftDays.indexOf(wd);
  const calendarLift = liftIdx >= 0 ? LIFT_ORDER[liftIdx] : undefined;
  const plan = plans.find((p) => p.date === date && !p.deleted);
  const base = { behind: false, next: nextAfterToday, cardioSuggested: false, testDay: false, doneToday, pos, overridden: false, extra: plan?.extra ?? [] };

  if (s.bloodDraw) {
    const until = diffDays(date, s.bloodDraw);
    if (until >= 0 && until <= 3) return { ...base, kind: 'bloodDraw', bloodDrawIn: until };
  }

  if (plan?.type) {
    const o = { ...base, overridden: true };
    if ((LIFT_ORDER as string[]).includes(plan.type)) return { ...o, kind: 'lift', lift: plan.type as DayId, calendarLift: plan.type as DayId };
    if (plan.type === 'D') return { ...o, kind: 'dayD', testDay: pos.started && pos.testWeek };
    if (plan.type === 'R') return { ...o, kind: 'rehab' };
    if (plan.type === 'cardio') return { ...o, kind: 'cardio', cardioSuggested: true };
    return { ...o, kind: 'rest' };
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

/* ---------- the agenda: what each upcoming day holds ---------- */
export type AgendaKind = 'lift' | 'dayD' | 'rehab' | 'cardio' | 'rest' | 'mobility' | 'bloodDraw' | 'pickup';

export interface AgendaDay {
  date: string;
  kind: AgendaKind;
  /** the lift when kind = 'lift' */
  lift?: DayId;
  optional: boolean;
  /** changed by hand for this date */
  overridden: boolean;
  /** workouts added on top */
  extra: string[];
  testDay: boolean;
  pos: ProgramPos;
}

/** Project the schedule forward from `from`, assuming each planned lift gets done in order. */
export function projectAgenda(from: string, days: number, s: ScheduleSettings, sessions: SessionLite[], plans: PlanLite[] = []): AgendaDay[] {
  const live = sessions.filter((x) => !x.deleted);
  let seq = nextLift(live, addDays(from, -1));
  const advance = (d: DayId) => {
    seq = LIFT_ORDER[(LIFT_ORDER.indexOf(d) + 1) % LIFT_ORDER.length];
  };
  const out: AgendaDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const pos = programPosition(s.startDate, date);
    const wd = weekday(date);
    const plan = plans.find((p) => p.date === date && !p.deleted);
    const extra = plan?.extra ?? [];
    const base = { date, optional: false, overridden: false, extra, testDay: false, pos };
    let day: AgendaDay;
    const until = s.bloodDraw ? diffDays(date, s.bloodDraw) : -1;
    if (until >= 0 && until <= 3) {
      day = { ...base, kind: 'bloodDraw' };
    } else if (plan?.type) {
      const t = plan.type;
      if ((LIFT_ORDER as string[]).includes(t)) day = { ...base, kind: 'lift', lift: t as DayId, overridden: true };
      else if (t === 'D') day = { ...base, kind: 'dayD', optional: true, overridden: true, testDay: pos.started && pos.testWeek };
      else if (t === 'R') day = { ...base, kind: 'rehab', optional: true, overridden: true };
      else if (t === 'cardio') day = { ...base, kind: 'cardio', optional: true, overridden: true };
      else if (t === 'mobility') day = { ...base, kind: 'mobility', overridden: true };
      else day = { ...base, kind: 'rest', overridden: true };
    } else if (s.liftDays.includes(wd)) {
      // a lift already done today counts
      const doneHere = live.find((x) => x.date === date && x.status === 'done' && (LIFT_ORDER as string[]).includes(x.type));
      day = { ...base, kind: 'lift', lift: (doneHere?.type as DayId) ?? seq };
    } else if (isWeekend(wd)) {
      const prev = out[out.length - 1];
      const satHadD = wd === 0 && ((prev && prev.date === addDays(date, -1) && (prev.kind === 'dayD' || prev.extra.includes('D'))) ||
        live.some((x) => x.type === 'D' && x.status === 'done' && x.date === addDays(date, -1)));
      day = satHadD ? { ...base, kind: 'rest' } : { ...base, kind: 'dayD', optional: true, testDay: pos.started && pos.testWeek };
    } else {
      day = { ...base, kind: 'cardio', optional: true };
    }
    if (day.kind === 'lift' && day.lift) advance(day.lift);
    for (const e of extra) if ((LIFT_ORDER as string[]).includes(e)) advance(e as DayId);
    out.push(day);
  }
  return out;
}
