/* Slot names, the AC joint "not for now" list, nutrition, safety copy, goals and lab targets. */
import type { NotForNow, SlotId } from './types';

export const SLOTS: { id: SlotId; label: string }[] = [
  { id: 'verticalJump', label: 'Vertical jump' },
  { id: 'horizontalJump', label: 'Horizontal and lateral jump' },
  { id: 'ankle', label: 'Ankle stiffness' },
  { id: 'hinge', label: 'Hinge' },
  { id: 'squat', label: 'Squat' },
  { id: 'singleLeg', label: 'Single leg' },
  { id: 'hamstring', label: 'Hamstring' },
  { id: 'upperPower', label: 'Upper power' },
  { id: 'horizontalPush', label: 'Horizontal push' },
  { id: 'verticalPush', label: 'Vertical push' },
  { id: 'horizontalPull', label: 'Horizontal pull' },
  { id: 'verticalPull', label: 'Vertical pull' },
  { id: 'upperBack', label: 'Upper back and shoulder' },
  { id: 'shoulders', label: 'Shoulders (delts)' },
  { id: 'arms', label: 'Arms' },
  { id: 'chest', label: 'Chest' },
  { id: 'legs', label: 'Leg accessories' },
  { id: 'core', label: 'Core' },
  { id: 'carry', label: 'Carry' },
  { id: 'conditioning', label: 'Conditioning' },
  { id: 'hipMobility', label: 'Hip flexor mobility' },
  { id: 'warmup', label: 'Warm-up' },
  { id: 'court', label: 'Court' },
];
export const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.label])) as Record<SlotId, string>;

export const NOT_FOR_NOW: NotForNow[] = [
  { name: 'Barbell bench press', reason: 'A fixed bar locks your hands in place and drives the upper arm back past the body at the bottom, which compresses the AC joint. Neutral-grip dumbbells let the shoulder find its own path.' },
  { name: 'Dips', reason: 'The bottom of a dip pushes the shoulder down and forward under full body weight, one of the most stressful positions for a separated AC joint.' },
  { name: 'Upright rows', reason: 'Lifting the elbows above the shoulders with the arms turned in pinches the space under the AC joint. Face pulls and Y raises train the same muscles safely.' },
  { name: 'Behind-the-neck presses', reason: 'Pressing from behind the head forces the shoulder into extreme external rotation and loads the AC joint at its weakest angle.' },
  { name: 'Heavy barbell overhead press', reason: 'Heavy straight-bar pressing overhead loads the AC joint at end range. The landmine press gives you an overhead-ish press on an angle the joint tolerates.' },
];

/* ---------- goals ---------- */
export const DUNK_TARGET_IN = 126; // 10'6" touch
export const RATE_TARGET = { low: 0.5, high: 1.0, flagLow: 0.5, flagHigh: 1.5 }; // lb lost per week

/* ---------- nutrition ---------- */
export const NUTRITION = {
  calories: 2200,
  adjust: 150,
  protein: [150, 165] as [number, number],
  proteinNote: 'across 3–4 meals',
  fiber: 'Fiber 30 g or more a day; limit saturated fat (helps ApoB).',
  avoid: 'Cut sugary drinks and refined carbs (helps ALT).',
};

/* ---------- labs ---------- */
export type LabKey = 'alt' | 'ast' | 'apob' | 'ldl' | 'hdl' | 'tg' | 'glucose' | 'a1c' | 'vitd';
export const LABS: { key: LabKey; label: string; unit: string; target?: { op: '<' | '≤' | '>'; value: number } }[] = [
  { key: 'alt', label: 'ALT', unit: 'U/L', target: { op: '≤', value: 40 } },
  { key: 'ast', label: 'AST', unit: 'U/L' },
  { key: 'apob', label: 'ApoB', unit: 'mg/dL', target: { op: '<', value: 90 } },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL' },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL', target: { op: '>', value: 40 } },
  { key: 'tg', label: 'Triglycerides', unit: 'mg/dL', target: { op: '<', value: 150 } },
  { key: 'glucose', label: 'Fasting glucose', unit: 'mg/dL', target: { op: '<', value: 100 } },
  { key: 'a1c', label: 'A1c', unit: '%' },
  { key: 'vitd', label: 'Vitamin D', unit: 'ng/mL' },
];

export function labOk(key: LabKey, v: number): boolean | null {
  const t = LABS.find((l) => l.key === key)?.target;
  if (!t) return null;
  return t.op === '<' ? v < t.value : t.op === '≤' ? v <= t.value : v > t.value;
}

/* ---------- safety ---------- */
export const SAFETY = {
  painScale: 'Pain 0–3 out of 10 is fine. Above 3, or any sharp or pinching pain: stop that exercise and swap it.',
  hamstring: 'Hamstring: a sudden grab in the back of the thigh, especially when sprinting, means stop for the day. Don\'t stretch through it.',
  tendons: 'Knees and Achilles: tendons recover tolerance more slowly than muscle after a year off.',
  tendonRule: 'Knee or Achilles above 3, or stiffness that lasts past the warm-up: jump volume is halved for the rest of this week.',
  shoulder: 'Shoulder: pain at the top of the shoulder, painful clicking or night pain means back off pressing and hanging. See a PT if it lasts more than a week.',
  bloodDraw: 'Blood draw coming up: no hard lifting, jumps or sprints for 3 days before it. Today is mobility plus walking.',
  footer: 'Not medical advice. Get injuries cleared by a doctor or PT.',
  jumpRules: 'Every rep is max effort with full rest (60–90 s between sets). End the set early if height drops noticeably. Jumps always come first.',
};

export const REACH_HOWTO = [
  'Stand flat-footed next to a wall, shoes on, side facing the wall.',
  'Reach one arm straight up as high as you can without lifting your heels.',
  'Mark the highest fingertip point and measure from the floor, in inches.',
];
