/* The four training days, the warm-up, the prehab circuit and easy cardio.
   Edit prescriptions here; screens read everything from this file.
   `rx(week)` returns the prescription for a week of the cycle (1–13), or null to skip the item that week. */
import type { SlotId } from './types';

export type DayId = 'A' | 'B' | 'C' | 'D';
export type Section = 'main' | 'court' | 'conditioning' | 'prehab';

export interface Rx {
  sets: number;
  /** reps: a number or a [low, high] range */
  reps?: number | [number, number];
  seconds?: number | [number, number];
  meters?: number;
  makes?: number; // target makes (or shots) per set
  rounds?: number;
  minutes?: number;
  perSide?: boolean;
  /** extra words shown after the numbers, e.g. "3 s lowering" */
  note?: string;
}

export interface PlanItem {
  /** stable key within the day; swaps are stored against `${day}:${key}` */
  key: string;
  slot: SlotId;
  section: Section;
  exercise: (week: number) => string;
  rx: (week: number) => Rx | null;
  /** one-line note shown on the card */
  note?: string;
}

export interface DayPlan {
  id: DayId;
  title: string;
  subtitle: string;
  optional?: boolean;
  /** note shown at the top of the session */
  banner?: string;
  courtWarmup?: boolean;
  items: PlanItem[];
}

const fixed = (id: string) => () => id;
const deload = (rx: Rx, week: number): Rx | null => (week === 13 ? { ...rx, sets: Math.max(1, Math.ceil(rx.sets / 2)), note: 'about 60% of your usual weight' } : rx);
const noDeload = (rx: Rx, week: number): Rx | null => (week === 13 ? null : rx);
/** main-lift rep ranges by phase (from the phase table) */
const mainReps = (week: number): [number, number] => (week <= 3 ? [6, 8] : week <= 8 ? [5, 6] : [3, 5]);

export const PREHAB_ITEMS: PlanItem[] = [
  { key: 'pre1', slot: 'upperBack', section: 'prehab', exercise: fixed('lacrosse-ball-release'), rx: () => ({ sets: 1, seconds: 60, perSide: true, note: 'against a wall' }) },
  { key: 'pre2', slot: 'upperBack', section: 'prehab', exercise: fixed('bench-lat-stretch'), rx: () => ({ sets: 2, seconds: 30 }) },
  { key: 'pre3', slot: 'upperBack', section: 'prehab', exercise: fixed('band-pull-apart'), rx: () => ({ sets: 2, reps: 15 }) },
  { key: 'pre4', slot: 'upperBack', section: 'prehab', exercise: fixed('side-lying-er'), rx: () => ({ sets: 2, reps: 15, perSide: true, note: '2–5 lb, towel under the elbow' }) },
  { key: 'pre5', slot: 'upperBack', section: 'prehab', exercise: fixed('cable-er'), rx: () => ({ sets: 2, reps: 12, perSide: true, note: 'towel between elbow and ribs' }) },
  { key: 'pre6', slot: 'upperBack', section: 'prehab', exercise: fixed('prone-ytw'), rx: () => ({ sets: 2, reps: 8, note: 'of each letter, thumbs up' }) },
  { key: 'pre7', slot: 'upperBack', section: 'prehab', exercise: fixed('scap-pushup'), rx: () => ({ sets: 2, reps: 12 }) },
  { key: 'pre8', slot: 'upperBack', section: 'prehab', exercise: fixed('wall-slide-liftoff'), rx: () => ({ sets: 2, reps: 10, note: 'rate overhead restriction here' }) },
  { key: 'pre9', slot: 'upperBack', section: 'prehab', exercise: fixed('thoracic-extension'), rx: () => ({ sets: 1, reps: 10 }) },
  { key: 'pre10', slot: 'upperBack', section: 'prehab', exercise: fixed('dead-hang'), rx: () => ({ sets: 3, seconds: [20, 30], note: 'only if pain-free, feet on the floor at first' }) },
];

export const PREHAB_NOTE = 'Light bands or 2–5 lb. No sharp pain at the top of the shoulder.';

export const DAYS: Record<DayId, DayPlan> = {
  A: {
    id: 'A',
    title: 'Day A',
    subtitle: 'Vertical jumps + heavy lower body',
    items: [
      {
        key: 'jump',
        slot: 'verticalJump',
        section: 'main',
        exercise: (w) => (w <= 3 ? 'box-jump' : w <= 5 ? 'depth-drop' : 'depth-jump'),
        rx: (w) =>
          w === 13 ? null : w <= 3 ? { sets: 5, reps: 3, note: 'highest box you land quietly' } : w <= 5 ? { sets: 4, reps: 4, note: 'from 12–18", stick the landing' } : { sets: 5, reps: 3, note: 'from 12–18"' },
      },
      { key: 'tbjump', slot: 'verticalJump', section: 'main', exercise: fixed('trap-bar-jump'), rx: (w) => noDeload({ sets: 4, reps: 3, note: '20–30% of deadlift weight' }, w) },
      { key: 'deadlift', slot: 'hinge', section: 'main', exercise: fixed('trap-bar-deadlift'), rx: (w) => deload({ sets: 4, reps: mainReps(w) }, w) },
      { key: 'split', slot: 'singleLeg', section: 'main', exercise: fixed('rfess'), rx: (w) => deload({ sets: 3, reps: w >= 4 ? 6 : 8, perSide: true, note: w >= 4 ? 'heavier' : undefined }, w) },
      { key: 'nordic', slot: 'hamstring', section: 'main', exercise: fixed('nordic-curl'), rx: (w) => deload({ sets: 3, reps: w >= 6 ? 6 : 4, note: w < 6 ? 'band-assisted at first' : undefined }, w) },
      { key: 'rdl', slot: 'hinge', section: 'main', exercise: fixed('db-rdl'), rx: (w) => deload({ sets: 3, reps: 8, note: '3 s lowering' }, w) },
      { key: 'calf', slot: 'ankle', section: 'main', exercise: fixed('sl-calf-raise'), rx: (w) => deload({ sets: 3, reps: 12, perSide: true }, w) },
      { key: 'abwheel', slot: 'core', section: 'main', exercise: fixed('ab-wheel'), rx: (w) => deload({ sets: 3, reps: [8, 10] }, w) },
      { key: 'close', slot: 'court', section: 'court', exercise: fixed('close-makes'), rx: () => ({ sets: 1, makes: 25, note: 'makes close in' }) },
      { key: 'ft', slot: 'court', section: 'court', exercise: fixed('free-throws'), rx: () => ({ sets: 1, makes: 20, note: 'log makes out of 20' }) },
    ],
  },
  B: {
    id: 'B',
    title: 'Day B',
    subtitle: 'Upper body (shoulder-safe) + upper power + prehab',
    banner: 'No barbell bench, dips, upright rows or behind-the-neck pressing for now.',
    items: [
      { key: 'mbpass', slot: 'upperPower', section: 'main', exercise: fixed('med-ball-chest-pass'), rx: (w) => deload({ sets: 4, reps: 5, note: '8–12 lb ball, max effort' }, w) },
      { key: 'landmine', slot: 'verticalPush', section: 'main', exercise: fixed('hk-landmine-press'), rx: (w) => deload({ sets: 4, reps: w >= 9 ? 6 : 8, perSide: true }, w) },
      { key: 'bench', slot: 'horizontalPush', section: 'main', exercise: fixed('db-bench-neutral'), rx: (w) => deload({ sets: 4, reps: w <= 3 ? 8 : w <= 8 ? [6, 8] : [5, 6] }, w) },
      { key: 'row', slot: 'horizontalPull', section: 'main', exercise: fixed('chest-supported-row'), rx: (w) => deload({ sets: 4, reps: 10 }, w) },
      { key: 'chin', slot: 'verticalPull', section: 'main', exercise: fixed('neutral-chinup'), rx: (w) => deload({ sets: 3, reps: [6, 10], note: 'log added weight; lat pulldown if hanging bothers the shoulder' }, w) },
      { key: 'pushup', slot: 'horizontalPush', section: 'main', exercise: fixed('feet-elevated-pushup'), rx: (w) => deload({ sets: 3, reps: [12, 20] }, w) },
      { key: 'facepull', slot: 'upperBack', section: 'main', exercise: fixed('face-pull'), rx: (w) => deload({ sets: 3, reps: 15 }, w) },
      { key: 'carry', slot: 'carry', section: 'main', exercise: fixed('farmer-carry'), rx: (w) => deload({ sets: 3, meters: 40 }, w) },
      ...PREHAB_ITEMS,
    ],
  },
  C: {
    id: 'C',
    title: 'Day C',
    subtitle: 'Horizontal + lateral jumps, squat, conditioning, prehab',
    items: [
      { key: 'broad', slot: 'horizontalJump', section: 'main', exercise: fixed('broad-jump'), rx: (w) => noDeload({ sets: 4, reps: 3, note: 'stick the landing 2 s' }, w) },
      { key: 'lateral', slot: 'horizontalJump', section: 'main', exercise: fixed('lateral-bound'), rx: (w) => noDeload({ sets: 3, reps: 4, perSide: true, note: 'hold the landing 2 s' }, w) },
      { key: 'squat', slot: 'squat', section: 'main', exercise: fixed('safety-bar-squat'), rx: (w) => deload({ sets: 4, reps: mainReps(w) }, w), note: 'No safety bar? Swap to hack squat or heavy goblet squat.' },
      { key: 'swing', slot: 'hinge', section: 'main', exercise: fixed('kb-swing'), rx: (w) => deload({ sets: 3, reps: 10 }, w) },
      { key: 'slrdl', slot: 'hinge', section: 'main', exercise: fixed('sl-rdl'), rx: (w) => deload({ sets: 3, reps: 8, perSide: true }, w) },
      { key: 'sarow', slot: 'horizontalPull', section: 'main', exercise: fixed('sa-db-row'), rx: (w) => deload({ sets: 3, reps: 10, perSide: true }, w) },
      { key: 'copen', slot: 'core', section: 'main', exercise: fixed('copenhagen-plank'), rx: (w) => deload({ sets: 3, seconds: 20, perSide: true }, w) },
      {
        key: 'intervals',
        slot: 'conditioning',
        section: 'conditioning',
        exercise: fixed('bike-intervals'),
        rx: (w) => ({ sets: 1, rounds: w === 13 ? 6 : Math.min(15, 10 + (w - 1)), note: '20 s all-out / 40 s easy' }),
      },
      ...PREHAB_ITEMS,
    ],
  },
  D: {
    id: 'D',
    title: 'Day D',
    subtitle: 'Court, dunk work + conditioning',
    optional: true,
    courtWarmup: true,
    items: [
      { key: 'approach', slot: 'verticalJump', section: 'court', exercise: fixed('approach-jump'), rx: (w) => noDeload({ sets: 3, reps: 4, note: 'full approach, max effort; log best touch (in)' }, w) },
      { key: 'dunk', slot: 'court', section: 'court', exercise: fixed('dunk-attempt'), rx: (w) => (w >= 9 && w <= 12 ? { sets: 1, reps: 12, note: '10–12 attempts max; stop when height drops' } : null) },
      { key: 'handle', slot: 'court', section: 'court', exercise: fixed('ball-handling'), rx: (w) => noDeload({ sets: 1, minutes: 5 }, w) },
      { key: 'form', slot: 'court', section: 'court', exercise: fixed('form-shooting'), rx: () => ({ sets: 1, makes: 50, note: 'form makes' }) },
      { key: 'spots', slot: 'court', section: 'court', exercise: fixed('spot-shooting'), rx: () => ({ sets: 5, makes: 10, note: 'corners, wings, top — makes out of 10 per spot' }) },
      { key: 'slides', slot: 'court', section: 'court', exercise: fixed('defensive-slides'), rx: (w) => noDeload({ sets: 4, seconds: 20, note: 'lane line to lane line' }, w) },
      {
        key: 'cond',
        slot: 'conditioning',
        section: 'conditioning',
        exercise: (w) => (w >= 9 ? 'seventeens' : 'suicides'),
        rx: (w) => (w === 13 ? null : w >= 9 ? { sets: 3, seconds: 70, note: '17 sideline-to-sidelines in under 70 s; log times' } : { sets: 6, seconds: 30, note: w <= 3 ? 'at 80%; log times' : 'at 90%; log times' }),
      },
      { key: 'ftired', slot: 'court', section: 'court', exercise: fixed('free-throws'), rx: () => ({ sets: 1, makes: 10, note: 'when tired — makes out of 10' }) },
    ],
  },
};

export const LIFT_ORDER: DayId[] = ['A', 'B', 'C'];

/* ---------- warm-up / hip flexor routine ---------- */
export interface RoutineItem {
  exercise: string;
  dose: string;
  note?: string;
}

export const WARMUP: RoutineItem[] = [
  { exercise: 'easy-bike-row', dose: '3 min easy' },
  { exercise: 'hk-hip-flexor-stretch', dose: '2 × 30–45 s per side', note: 'squeeze the back glute, tuck the pelvis' },
  { exercise: 'couch-stretch', dose: '1 × 45 s per side' },
  { exercise: 'hip-9090', dose: '8 per side' },
  { exercise: 'glute-bridge', dose: '12 reps, 2 s hold at the top' },
  { exercise: 'worlds-greatest-stretch', dose: '5 per side' },
  { exercise: 'leg-swings', dose: '10 each way per leg' },
  { exercise: 'inchworm', dose: '5' },
  { exercise: 'band-pull-apart', dose: '15' },
  { exercise: 'pogo-hops', dose: '2 × 15', note: 'wakes up the ankles before jumping' },
];

export const COURT_WARMUP: RoutineItem[] = [
  { exercise: 'skips', dose: '2 × 20 m' },
  { exercise: 'a-skips', dose: '2 × 20 m' },
  { exercise: 'carioca', dose: '2 × 20 m each way' },
  { exercise: 'build-up-runs', dose: '4 × 20 m', note: 'at 60%, 70%, 80%, 90%' },
];

/** Rest days: items 2–5 of the warm-up as a 5-minute desk reset. */
export const DESK_RESET: RoutineItem[] = WARMUP.slice(1, 5);

/* ---------- easy cardio ---------- */
export const CARDIO_WHY = 'Helps liver enzymes, blood sugar and triglycerides, and builds the base that keeps you jumping late in games.';
export const CARDIO_EFFORT = 'Can talk in full sentences, about 120–140 bpm.';

export type CardioType = 'incline' | 'bike' | 'rower' | 'dog' | 'other';
export const CARDIO_TYPES: { id: CardioType; label: string; hint: string }[] = [
  { id: 'incline', label: 'Incline walk', hint: '30–40 min, 10–12% incline, 3–3.5 mph' },
  { id: 'bike', label: 'Bike', hint: '30–40 min, steady' },
  { id: 'rower', label: 'Rower', hint: '30–40 min, steady' },
  { id: 'dog', label: 'Dog walk', hint: 'hilly or fast, 45–60 min' },
];

/** Test days: weeks 1, 5, 9, 13 on Day D after the warm-up. */
export const TEST_PROTOCOL = [
  'Standing vertical: 3 tries from a flat-footed standing start, touch as high as you can. Best touch minus standing reach = your standing vertical.',
  'Approach touch: 3 tries with your full approach. Log the highest touch in inches.',
];
