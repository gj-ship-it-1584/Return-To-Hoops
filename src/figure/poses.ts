/* Reusable starting points for exercise diagrams. Spread one and override:
     a: { ...P.squatBottom, armN: [90, 90] }
   Angles: 0 = down, 90 = forward (figure faces right), 180 = up, -90 = backward. */
import type { Pose } from '../plan/types';

export const P = {
  /** standing tall, arms at the sides */
  stand: { torso: 180, armN: [6, 10], armF: [-6, -4], legN: [3, 0], legF: [-3, 0] },
  /** athletic stance / quarter squat */
  athletic: { torso: 158, armN: [30, 55], armF: [20, 45], legN: [42, -14], legF: [36, -16] },
  /** loaded jump dip: hips back, arms swung behind */
  jumpLoad: { torso: 125, head: 140, armN: [-60, -50], armF: [-55, -45], legN: [72, -26], legF: [66, -28], footN: 90 },
  /** mid-air, full extension, arms up */
  jumpAir: { torso: 182, armN: [170, 175], armF: [160, 168], legN: [-4, -8], legF: [-8, -14], footN: 30, footF: 25, lift: 14 },
  /** half / parallel squat bottom */
  squatBottom: { torso: 150, armN: [80, 80], armF: [75, 75], legN: [82, -28], legF: [78, -30] },
  /** deep goblet-style squat */
  squatDeep: { torso: 158, armN: [40, 120], armF: [35, 115], legN: [95, -38], legF: [90, -40] },
  /** Romanian deadlift bottom: hips back, flat back */
  hinge: { torso: 100, head: 110, armN: [2, 2], armF: [-2, -2], legN: [12, -4], legF: [10, -6] },
  /** deadlift start: hips lower than the hinge */
  deadliftStart: { torso: 120, head: 130, armN: [-2, -2], armF: [-4, -4], legN: [62, -22], legF: [58, -24] },
  /** split squat bottom: near leg forward */
  splitBottom: { torso: 178, armN: [4, 4], armF: [-4, -4], legN: [88, 0], legF: [-25, -92], footF: 0 },
  /** split stance top */
  splitTop: { torso: 180, armN: [4, 4], armF: [-4, -4], legN: [30, -2], legF: [-22, -14], footF: 40 },
  /** high plank / push-up top: hands under shoulders */
  pushupTop: { torso: 96, head: 100, armN: [-2, -2], armF: [2, 2], legN: [-84, -84], legF: [-84, -84], footN: 2, footF: 2 },
  /** push-up bottom: chest near the floor */
  pushupBottom: { torso: 92, head: 96, armN: [-120, 10], armF: [-118, 12], legN: [-88, -88], legF: [-88, -88], footN: 4, footF: 4 },
  /** forearm plank */
  forearmPlank: { torso: 94, head: 98, armN: [0, 90], armF: [2, 92], legN: [-86, -86], legF: [-86, -86], footN: 2, footF: 2 },
  /** lying face up, head to the left, legs straight */
  supine: { torso: -90, head: -90, armN: [-80, -80], armF: [-82, -82], legN: [90, 90], legF: [90, 90], footN: 175, footF: 175 },
  /** lying face up with knees bent, feet flat (bridge / dead bug start) */
  supineKnees: { torso: -90, head: -90, armN: [10, 10], armF: [12, 12], legN: [140, 15], legF: [138, 13], footN: 95, footF: 95 },
  /** lying face down, head to the right */
  prone: { torso: 90, head: 92, armN: [-90, -90], armF: [-92, -92], legN: [-90, -90], legF: [-90, -90], footN: 5, footF: 5 },
  /** half-kneeling: near leg forward foot flat, far knee down */
  halfKneel: { torso: 180, armN: [4, 4], armF: [-4, -4], legN: [90, 0], legF: [0, -90], footF: 0 },
  /** tall kneeling */
  tallKneel: { torso: 180, armN: [4, 4], armF: [-4, -4], legN: [0, -90], legF: [0, -90], footN: 0, footF: 0 },
  /** seated on a box or bench, feet on the floor */
  seated: { torso: 182, armN: [10, 70], armF: [8, 68], legN: [90, 0], legF: [86, -2], contact: 'hip', lift: 20 },
  /** hanging from a bar */
  hang: { torso: 180, armN: [178, 178], armF: [176, 176], legN: [2, -4], legF: [-2, -6], footN: 30, footF: 30, lift: 18 },
  /** sprint / bound: near knee driving */
  sprint: { torso: 165, armN: [-45, 30], armF: [50, 140], legN: [80, 5], legF: [-30, -70], footN: 70, footF: 20 },
  /** quadruped (hands and knees) */
  quadruped: { torso: 92, head: 100, armN: [0, 0], armF: [2, 2], legN: [0, -90], legF: [2, -90], footN: 0, footF: 0 },
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof P;
