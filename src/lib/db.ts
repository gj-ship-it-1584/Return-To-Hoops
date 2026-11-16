/* Local database (IndexedDB via Dexie). Every record has an `id`, an update time `u`
   and an optional `deleted` tombstone so it can sync to Firestore with last-writer-wins,
   the same way Shea's Log does. */
import Dexie, { type Table } from 'dexie';
import type { DayId, CardioType } from '../plan/days';
import type { LabKey } from '../plan/content';

export interface Base {
  id: string;
  u: number;
  deleted?: boolean;
}

/** 'custom' = a free-form workout built from added exercises */
export type SessionType = DayId | 'mobility' | 'pickup' | 'custom';
export type PainKey = 'shoulder' | 'hamstring' | 'knee' | 'achilles';
export type BallType = 'tennis' | 'volleyball' | 'basketball';

/** An exercise added by hand to a workout or a planned day. */
export interface AddedMove {
  /** stable key; the plan item key is `add-${key}` */
  key: string;
  exercise: string;
  sets: number;
  reps?: number;
  seconds?: number;
  meters?: number;
  makes?: number;
  rounds?: number;
  minutes?: number;
}

export interface Session extends Base {
  date: string;
  type: SessionType;
  cycle: number;
  week: number;
  startedAt: number;
  endedAt?: number;
  status: 'active' | 'done';
  /** warm-up / routine items ticked off */
  ticked: string[];
  /** "just today" swaps: planItemKey → exercise id */
  swaps: Record<string, string>;
  pain?: Partial<Record<PainKey, number>>;
  overhead?: number;
  note?: string;
  dunks?: { ball: BallType; made: boolean }[];
  pickup?: { minutes: number; feel: number; note?: string };
  /** exercises added by hand to this session */
  added?: AddedMove[];
  /** custom exercise order (plan item keys) */
  order?: string[];
  /** which card the session was on, so a reopened app lands in the same place */
  cursor?: string;
}

export interface SetLog extends Base {
  sessionId: string;
  date: string;
  exerciseId: string;
  /** `${day}:${planItemKey}` */
  slotKey: string;
  idx: number;
  done: boolean;
  weight?: number; // lb
  reps?: number;
  seconds?: number;
  meters?: number;
  boxIn?: number;
  distanceIn?: number;
  touchIn?: number;
  rounds?: number;
  makes?: number;
  minutes?: number;
  /** what the plan called for, kept for history */
  swappedFrom?: string;
}

export interface CycleSwap extends Base {
  cycle: number;
  slotKey: string;
  /** the planned exercise this replaces (Day A's jump slot changes by week) */
  from: string;
  to: string;
}

export interface BodyLog extends Base {
  date: string;
  weight?: number;
  waist?: number;
  sleep?: number;
  calories?: number;
  protein?: number;
  steps?: number;
  notes?: string;
}

export interface LabEntry extends Base, Partial<Record<LabKey, number>> {
  date: string;
  note?: string;
}

export interface CardioLog extends Base {
  date: string;
  /** a CardioType or any activity id from lib/activities.ts */
  type: CardioType | string;
  /** name for "other" activities */
  label?: string;
  note?: string;
  minutes: number;
  hr?: number;
  incline?: number;
  speed?: number;
  distance?: number;
  effort?: 'easy' | 'moderate' | 'hard';
}

export interface Checkin extends Base {
  date: string;
  knee?: number;
  achilles?: number;
  /** stiffness lasted past the warm-up */
  stiff?: boolean;
}

export interface TestResult extends Base {
  date: string;
  cycle: number;
  week: number;
  reach?: number;
  standing: number[];
  approach: number[];
}

export interface Settings extends Base {
  startDate: string;
  /** weekdays (0 Sun … 6 Sat) for A, B, C */
  liftDays: [number, number, number];
  units: 'lb' | 'kg';
  restMain: number;
  restOther: number;
  sound: boolean;
  vibrate: boolean;
  standingReach?: number;
  bloodDraw?: string;
  goalWeight: number;
  /** your preferred exercise order for each training day (plan item keys) */
  dayOrder?: Record<string, string[]>;
  calories: number;
  dunkTarget: number;
}

/** A change to the schedule for one date: a different workout, extra workouts, or swapped moves. id = 'plan-YYYY-MM-DD'. */
export interface PlannedDay extends Base {
  date: string;
  /** replaces what the schedule says for this date */
  type?: SessionType | 'rest' | 'cardio';
  /** workouts added on top */
  extra?: SessionType[];
  /** swapped moves for this date only: `${day}:${itemKey}` → exercise id */
  swaps?: Record<string, string>;
  /** exercises added by hand, per workout on this date ('A'…'D', 'mobility' or 'custom') */
  moves?: Record<string, AddedMove[]>;
  /** custom exercise order per workout on this date */
  order?: Record<string, string[]>;
  /** activities planned for this date */
  activities?: { key: string; type: string; minutes: number; label?: string }[];
}

/** Device-only state (never synced). */
export interface Meta {
  id: string;
  value: unknown;
}

export class HoopsDB extends Dexie {
  sessions!: Table<Session, string>;
  sets!: Table<SetLog, string>;
  swaps!: Table<CycleSwap, string>;
  body!: Table<BodyLog, string>;
  labs!: Table<LabEntry, string>;
  cardio!: Table<CardioLog, string>;
  checkins!: Table<Checkin, string>;
  tests!: Table<TestResult, string>;
  settings!: Table<Settings, string>;
  plans!: Table<PlannedDay, string>;
  meta!: Table<Meta, string>;

  constructor(name = 'hoops') {
    super(name);
    this.version(1).stores({
      sessions: 'id, date, type, status, cycle, u',
      sets: 'id, sessionId, exerciseId, date, slotKey, u',
      swaps: 'id, cycle, slotKey, u',
      body: 'id, date, u',
      labs: 'id, date, u',
      cardio: 'id, date, u',
      checkins: 'id, date, u',
      tests: 'id, date, u',
      settings: 'id, u',
      meta: 'id',
    });
    this.version(2).stores({ plans: 'id, date, u' });
  }
}

export const SYNCED_TABLES = ['sessions', 'sets', 'swaps', 'body', 'labs', 'cardio', 'checkins', 'tests', 'settings', 'plans'] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export let db = new HoopsDB();
/** tests swap in a fresh database */
export function useDatabase(next: HoopsDB) {
  db = next;
}

export const planId = (date: string) => `plan-${date}`;

export const uid = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
