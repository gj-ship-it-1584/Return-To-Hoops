/* Shared types for the training plan and exercise library.
   Plan content lives in src/plan/*.ts so it can be edited without touching screens. */

export type SlotId =
  | 'verticalJump'
  | 'horizontalJump'
  | 'ankle'
  | 'hinge'
  | 'squat'
  | 'singleLeg'
  | 'hamstring'
  | 'upperPower'
  | 'horizontalPush'
  | 'verticalPush'
  | 'horizontalPull'
  | 'verticalPull'
  | 'upperBack'
  | 'core'
  | 'carry'
  | 'conditioning'
  | 'hipMobility'
  | 'warmup'
  | 'court';

export type MuscleId =
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'calves'
  | 'achilles'
  | 'tibialis'
  | 'hipFlexors'
  | 'adductors'
  | 'abductors'
  | 'abs'
  | 'obliques'
  | 'lowerBack'
  | 'lats'
  | 'teresMajor'
  | 'upperTraps'
  | 'midTraps'
  | 'lowerTraps'
  | 'rhomboids'
  | 'rearDelts'
  | 'frontDelts'
  | 'sideDelts'
  | 'infraspinatus'
  | 'teresMinor'
  | 'serratus'
  | 'chest'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'thoracic';

/** What gets logged per set.
 *  weight = lb of load (added load for body-weight moves), reps, seconds (holds),
 *  meters (carries, sled), boxIn (box height, inches), distanceIn (broad jump, inches),
 *  touchIn (highest touch, inches), rounds (intervals), makes (shooting), minutes. */
export type LogField =
  | 'weight'
  | 'reps'
  | 'seconds'
  | 'meters'
  | 'boxIn'
  | 'distanceIn'
  | 'touchIn'
  | 'rounds'
  | 'makes'
  | 'minutes';

/* ---------- diagram model ----------
   A side-view figure facing RIGHT. Every angle is ABSOLUTE (world), in degrees:
     0 = pointing straight down, 90 = pointing forward (the way the figure faces),
     180 = straight up, -90 = pointing backward.
   Values are interpolated linearly, so use 200 rather than -160 if you want the
   limb to travel over the top. */
export type Angle2 = [number, number];

export type BodyPoint =
  | 'hip'
  | 'shoulder'
  | 'head'
  | 'elbowN'
  | 'elbowF'
  | 'handN'
  | 'handF'
  | 'kneeN'
  | 'kneeF'
  | 'ankleN'
  | 'ankleF'
  | 'toeN'
  | 'toeF'
  | 'heelN'
  | 'heelF';

export interface Pose {
  /** hip → shoulder. Standing tall = 180, hinge parallel to floor = 90, lying face-up with head to the left = -90 (or 270). */
  torso: number;
  /** neck → head. Defaults to the torso angle. */
  head?: number;
  /** near arm: [upper arm, forearm]. Hanging at your side = [0, 0]; straight overhead = [180, 180]. */
  armN: Angle2;
  /** far arm (drawn faded). Defaults to armN. */
  armF?: Angle2;
  /** near leg: [thigh, shin]. Standing = [0, 0]; sitting on a box = [90, 0]; knee on floor behind you ≈ [-20, -95]. */
  legN: Angle2;
  /** far leg (drawn faded). Defaults to legN. */
  legF?: Angle2;
  /** foot direction (ankle → toe). Default 90 = flat on the floor. On the toes ≈ 50. Toes on floor in a plank = 0. */
  footN?: number;
  footF?: number;
  /** Height (body units) of the contact point above the floor: a box top, a bench pad, the air during a jump. Default 0. */
  lift?: number;
  /** Which body point sits at `lift`. Default 'lowest' (whatever is lowest). Use 'hip' for seated / lying on a bench. */
  contact?: 'lowest' | BodyPoint;
  /** Horizontal shift of the whole figure, body units, positive = forward. Use on the end pose of travelling moves. */
  dx?: number;
}

/** Where an attached prop sits on the body. 'hands' = midpoint of both hands. */
export type Anchor = BodyPoint | 'hands' | 'chest' | 'upperBack' | 'feet';

/** World coordinates: x is body units from the start pose's hip (positive = forward),
 *  y is body units above the floor. The standing figure is ~93 units tall (hip ≈ 47, shoulder ≈ 77). */
export type XY = [number, number];

export type Prop = { only?: 'a' | 'b' } & (
  | { t: 'box'; x: number; w: number; h: number } // plyo box, step, block, wall ball target
  | { t: 'bench'; x: number; w: number; h: number; angle?: number } // pad; angle in degrees, + raises the right (forward) end
  | { t: 'wall'; x: number }
  | { t: 'bar'; x: number; y: number } // pull-up bar seen end-on
  | { t: 'hurdle'; x: number; h: number }
  | { t: 'cone'; x: number }
  | { t: 'line'; x: number } // court line / tape mark on the floor
  | { t: 'hoop'; x: number; y: number }
  | { t: 'dumbbell' | 'kettlebell' | 'medball' | 'plate' | 'ball' | 'barbell' | 'trapbar' | 'abwheel' | 'handle'; at: Anchor }
  | { t: 'cable' | 'band'; from: XY; to: Anchor }
  | { t: 'landmine'; pivot: XY; to: Anchor }
  | { t: 'roller'; at: Anchor | XY }
  | { t: 'rope' } // jump rope loop from the hands under the feet
  | { t: 'bike' | 'rower' | 'stair' | 'sled' | 'machine'; x: number; w?: number; h?: number }
  | { t: 'arrow'; from: XY; to: XY } // motion cue, world coordinates
);

export interface Diagram {
  /** start position */
  a: Pose;
  /** end position */
  b: Pose;
  props?: Prop[];
  /** labels under the two panels; default ['Start', 'End'] */
  labels?: [string, string];
}

export interface Exercise {
  id: string;
  name: string;
  /** Movement slots it belongs to (first one is where it is listed in the library). */
  slots: SlotId[];
  /** true = used in the plan; false = swap option only. */
  inPlan: boolean;
  /** What to log for each set. */
  log: LogField[];
  /** Progression step for upper-body dumbbell lifts is 2.5 lb instead of 5. */
  upperDb?: boolean;
  /** Main lift: 150 s rest. Otherwise 75 s. */
  main?: boolean;
  /** Is this a jump (counts toward weekly jump volume)? */
  jump?: boolean;
  muscles: MuscleId[];
  /** One or two sentences tied to the athlete's goals or injuries. */
  why: string;
  setup: string;
  steps: string[];
  cues: string[];
  mistakes: string[];
  injuryNote?: string;
  easier?: string;
  harder?: string;
  /** Only allowed when pain-free / later phase — shown as a caution tag. */
  caution?: string;
  diagram: Diagram;
  /** Override for the YouTube search text. */
  search?: string;
}

export interface NotForNow {
  name: string;
  reason: string;
}
