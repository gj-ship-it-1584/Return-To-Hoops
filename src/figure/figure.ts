/* Exercise diagram renderer. Pure functions that turn a Diagram into an SVG
   string, so the app (React) and the preview script (Node) draw identical pictures.
   Coordinate model is documented in src/plan/types.ts. */
import type { Anchor, BodyPoint, Diagram, FrontPose, MuscleId, Pose, Prop, XY } from '../plan/types';

export const SEG = { torso: 30, neck: 3.5, headR: 6, upper: 15, fore: 14, thigh: 23, shin: 22, foot: 7, heel: 1.6 };
const LIMB = 5.2; // stroke width of limbs
const HALF = LIMB / 2;

export const COLORS = {
  body: '#ede7db',
  far: '#7b746a',
  accent: '#c9a96a',
  prop: '#787064',
  floor: '#3a362f',
  label: '#a39b8e',
  /** the faint start-position figure behind the animation */
  ghost: '#3a362f',
  bg: 'transparent',
};

type P = { x: number; y: number }; // world coords, y up
const rad = (d: number) => (d * Math.PI) / 180;
const dir = (a: number): P => ({ x: Math.sin(rad(a)), y: -Math.cos(rad(a)) });
const add = (p: P, d: P, k: number): P => ({ x: p.x + d.x * k, y: p.y + d.y * k });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type Body = Record<BodyPoint, P> & {
  headC: P;
  neck: P;
  angles?: unknown;
  /** front/back view only: the four corners of the torso */
  front?: { shR: P; shL: P; hpR: P; hpL: P };
};
export type View3 = 'side' | 'front' | 'back' | undefined;
const isFront = (v: View3) => v === 'front' || v === 'back';
const FW = { shoulder: 10.5, hip: 6.5, foot: 5 };
const dirL = (a: number): P => ({ x: -Math.sin(rad(a)), y: -Math.cos(rad(a)) });

function fullFront(p: FrontPose) {
  return {
    lean: p.lean ?? 0,
    head: p.head ?? p.lean ?? 0,
    armR: p.armR,
    armL: p.armL ?? p.armR,
    legR: p.legR,
    legL: p.legL ?? p.legR,
    footR: p.footR ?? 90,
    footL: p.footL ?? p.footR ?? 90,
    lift: p.lift ?? 0,
    contact: p.contact ?? 'lowest',
    dx: p.dx ?? 0,
  };
}

/** Front view: N = the limb drawn on the right of the picture, F = on the left. */
function chainFront(p: ReturnType<typeof fullFront>): Body {
  const hip = { x: 0, y: 0 };
  const up = { x: Math.sin(rad(p.lean)), y: Math.cos(rad(p.lean)) };
  const perp = { x: Math.cos(rad(p.lean)), y: -Math.sin(rad(p.lean)) };
  const headUp = { x: Math.sin(rad(p.head)), y: Math.cos(rad(p.head)) };
  const shoulder = add(hip, up, SEG.torso);
  const neck = add(shoulder, headUp, SEG.neck);
  const headC = add(shoulder, headUp, SEG.neck + SEG.headR);
  const shR = add(shoulder, perp, FW.shoulder), shL = add(shoulder, perp, -FW.shoulder);
  const hpR = add(hip, perp, FW.hip), hpL = add(hip, perp, -FW.hip);
  const elbowN = add(shR, dir(p.armR[0]), SEG.upper);
  const handN = add(elbowN, dir(p.armR[1]), SEG.fore);
  const elbowF = add(shL, dirL(p.armL[0]), SEG.upper);
  const handF = add(elbowF, dirL(p.armL[1]), SEG.fore);
  const kneeN = add(hpR, dir(p.legR[0]), SEG.thigh);
  const ankleN = add(kneeN, dir(p.legR[1]), SEG.shin);
  const kneeF = add(hpL, dirL(p.legL[0]), SEG.thigh);
  const ankleF = add(kneeF, dirL(p.legL[1]), SEG.shin);
  const toeN = add(ankleN, dir(p.footR), FW.foot), heelN = add(ankleN, dir(p.footR), -1.2);
  const toeF = add(ankleF, dirL(p.footL), FW.foot), heelF = add(ankleF, dirL(p.footL), -1.2);
  return {
    hip, shoulder, neck, headC, head: { x: headC.x, y: headC.y - SEG.headR },
    elbowN, handN, elbowF, handF, kneeN, ankleN, kneeF, ankleF, toeN, toeF, heelN, heelF,
    front: { shR, shL, hpR, hpL },
  };
}

function lerpAny<T extends object>(a: T, b: T, t: number): T {
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = (a as Record<string, unknown>)[k], y = (b as Record<string, unknown>)[k];
    if (typeof x === 'number' && typeof y === 'number') out[k] = lerp(x, y, t);
    else if (Array.isArray(x) && Array.isArray(y)) out[k] = x.map((v: number, i: number) => lerp(v, y[i] as number, t));
    else out[k] = t < 0.5 ? x : y;
  }
  return out as T;
}

function full(p: Pose) {
  return {
    torso: p.torso,
    head: p.head ?? p.torso,
    armN: p.armN,
    armF: p.armF ?? p.armN,
    legN: p.legN,
    legF: p.legF ?? p.legN,
    footN: p.footN ?? 90,
    footF: p.footF ?? p.footN ?? 90,
    lift: p.lift ?? 0,
    contact: p.contact ?? 'lowest',
    dx: p.dx ?? 0,
  };
}

/** Forward kinematics with the hip at the origin. */
function chain(p: ReturnType<typeof full>): Body {
  const hip = { x: 0, y: 0 };
  const shoulder = add(hip, dir(p.torso), SEG.torso);
  const neck = add(shoulder, dir(p.head), SEG.neck);
  const headC = add(shoulder, dir(p.head), SEG.neck + SEG.headR);
  const elbowN = add(shoulder, dir(p.armN[0]), SEG.upper);
  const handN = add(elbowN, dir(p.armN[1]), SEG.fore);
  const elbowF = add(shoulder, dir(p.armF[0]), SEG.upper);
  const handF = add(elbowF, dir(p.armF[1]), SEG.fore);
  const kneeN = add(hip, dir(p.legN[0]), SEG.thigh);
  const ankleN = add(kneeN, dir(p.legN[1]), SEG.shin);
  const kneeF = add(hip, dir(p.legF[0]), SEG.thigh);
  const ankleF = add(kneeF, dir(p.legF[1]), SEG.shin);
  const toeN = add(ankleN, dir(p.footN), SEG.foot);
  const toeF = add(ankleF, dir(p.footF), SEG.foot);
  const heelN = add(ankleN, dir(p.footN), -SEG.heel);
  const heelF = add(ankleF, dir(p.footF), -SEG.heel);
  return {
    hip, shoulder, neck, headC, head: { x: headC.x, y: headC.y - SEG.headR },
    elbowN, handN, elbowF, handF, kneeN, ankleN, kneeF, ankleF, toeN, toeF, heelN, heelF,
    angles: { torso: p.torso, head: p.head, armN: p.armN, armF: p.armF, legN: p.legN, legF: p.legF, footN: p.footN, footF: p.footF },
  };
}

const POINT_KEYS: BodyPoint[] = ['hip', 'shoulder', 'elbowN', 'elbowF', 'handN', 'handF', 'kneeN', 'kneeF', 'ankleN', 'ankleF', 'toeN', 'toeF', 'heelN', 'heelF'];

function bottomOf(b: Body, k: BodyPoint | 'headBottom') {
  if (k === 'head' || k === 'headBottom') return b.headC.y - SEG.headR;
  return b[k].y - HALF;
}

/** Place a pose in the world: ground it and shift it horizontally. `originX` is where the hip goes before dx. */
export function placePose(pose: Pose | FrontPose, originX = 0, view?: View3): Body {
  const f = isFront(view) ? fullFront(pose as FrontPose) : full(pose as Pose);
  const b = isFront(view) ? chainFront(f as ReturnType<typeof fullFront>) : chain(f as ReturnType<typeof full>);
  let low: number;
  if (f.contact === 'lowest') {
    low = Math.min(...POINT_KEYS.map((k) => bottomOf(b, k)), bottomOf(b, 'headBottom'));
  } else {
    low = bottomOf(b, f.contact);
  }
  const ty = f.lift - low;
  const tx = originX + f.dx;
  const move = (p: P): P => ({ x: p.x + tx, y: p.y + ty });
  const out = { angles: b.angles } as Body;
  for (const k of [...POINT_KEYS, 'head', 'headC', 'neck'] as const) (out as Record<string, P>)[k] = move(b[k]);
  if (b.front) out.front = { shR: move(b.front.shR), shL: move(b.front.shL), hpR: move(b.front.hpR), hpL: move(b.front.hpL) };
  return out;
}

export function lerpPose(a: Pose | FrontPose, b: Pose | FrontPose, t: number, view?: View3): Pose | FrontPose {
  if (isFront(view)) return lerpAny(fullFront(a as FrontPose), fullFront(b as FrontPose), t) as FrontPose;
  const A = full(a as Pose);
  const B = full(b as Pose);
  const l2 = (x: [number, number], y: [number, number]): [number, number] => [lerp(x[0], y[0], t), lerp(x[1], y[1], t)];
  return {
    torso: lerp(A.torso, B.torso, t),
    head: lerp(A.head, B.head, t),
    armN: l2(A.armN, B.armN),
    armF: l2(A.armF, B.armF),
    legN: l2(A.legN, B.legN),
    legF: l2(A.legF, B.legF),
    footN: lerp(A.footN, B.footN, t),
    footF: lerp(A.footF, B.footF, t),
    lift: lerp(A.lift, B.lift, t),
    dx: lerp(A.dx, B.dx, t),
    contact: t < 0.5 ? A.contact : B.contact,
  };
}

/* ---------- muscles ---------- */
type Seg = 'torso' | 'upperArm' | 'foreArm' | 'thigh' | 'shin';
type Mark =
  | { seg: Seg; side: 'front' | 'back' | 'mid'; from: number; to: number }
  | { dot: 'hip' | 'shoulder' | 'neck'; side: 'front' | 'back' | 'mid'; r: number };

export const MUSCLES: Record<MuscleId, { label: string; marks: Mark[] }> = {
  quads: { label: 'Quads', marks: [{ seg: 'thigh', side: 'front', from: 0.15, to: 0.9 }] },
  glutes: { label: 'Glutes', marks: [{ dot: 'hip', side: 'back', r: 4.2 }] },
  hamstrings: { label: 'Hamstrings', marks: [{ seg: 'thigh', side: 'back', from: 0.15, to: 0.9 }] },
  calves: { label: 'Calves', marks: [{ seg: 'shin', side: 'back', from: 0.12, to: 0.6 }] },
  achilles: { label: 'Achilles tendon', marks: [{ seg: 'shin', side: 'back', from: 0.65, to: 0.95 }] },
  tibialis: { label: 'Tibialis (front of shin)', marks: [{ seg: 'shin', side: 'front', from: 0.1, to: 0.8 }] },
  hipFlexors: { label: 'Hip flexors', marks: [{ seg: 'thigh', side: 'front', from: 0, to: 0.35 }, { dot: 'hip', side: 'front', r: 3 }] },
  adductors: { label: 'Adductors (inner thigh)', marks: [{ seg: 'thigh', side: 'mid', from: 0.1, to: 0.75 }] },
  abductors: { label: 'Hip abductors (glute med)', marks: [{ dot: 'hip', side: 'mid', r: 3.6 }] },
  abs: { label: 'Abs', marks: [{ seg: 'torso', side: 'front', from: 0.08, to: 0.62 }] },
  obliques: { label: 'Obliques', marks: [{ seg: 'torso', side: 'mid', from: 0.1, to: 0.55 }] },
  lowerBack: { label: 'Lower back (spinal erectors)', marks: [{ seg: 'torso', side: 'back', from: 0.05, to: 0.45 }] },
  lats: { label: 'Lats', marks: [{ seg: 'torso', side: 'back', from: 0.4, to: 0.85 }] },
  teresMajor: { label: 'Teres major', marks: [{ seg: 'torso', side: 'back', from: 0.78, to: 0.97 }, { seg: 'upperArm', side: 'back', from: 0, to: 0.25 }] },
  upperTraps: { label: 'Upper traps', marks: [{ dot: 'neck', side: 'back', r: 2.8 }] },
  midTraps: { label: 'Middle traps', marks: [{ seg: 'torso', side: 'back', from: 0.7, to: 0.95 }] },
  lowerTraps: { label: 'Lower traps', marks: [{ seg: 'torso', side: 'back', from: 0.5, to: 0.8 }] },
  rhomboids: { label: 'Rhomboids', marks: [{ seg: 'torso', side: 'back', from: 0.68, to: 0.92 }] },
  rearDelts: { label: 'Rear delts', marks: [{ dot: 'shoulder', side: 'back', r: 3.4 }] },
  frontDelts: { label: 'Front delts', marks: [{ dot: 'shoulder', side: 'front', r: 3.4 }] },
  sideDelts: { label: 'Side delts', marks: [{ dot: 'shoulder', side: 'mid', r: 3.6 }] },
  infraspinatus: { label: 'Infraspinatus', marks: [{ dot: 'shoulder', side: 'back', r: 3.2 }, { seg: 'torso', side: 'back', from: 0.82, to: 0.98 }] },
  teresMinor: { label: 'Teres minor', marks: [{ dot: 'shoulder', side: 'back', r: 2.8 }] },
  serratus: { label: 'Serratus anterior', marks: [{ seg: 'torso', side: 'mid', from: 0.6, to: 0.9 }] },
  chest: { label: 'Chest', marks: [{ seg: 'torso', side: 'front', from: 0.65, to: 0.95 }] },
  triceps: { label: 'Triceps', marks: [{ seg: 'upperArm', side: 'back', from: 0.15, to: 0.9 }] },
  biceps: { label: 'Biceps', marks: [{ seg: 'upperArm', side: 'front', from: 0.15, to: 0.9 }] },
  forearms: { label: 'Forearms / grip', marks: [{ seg: 'foreArm', side: 'mid', from: 0.1, to: 0.85 }] },
  thoracic: { label: 'Upper back (thoracic spine)', marks: [{ seg: 'torso', side: 'back', from: 0.55, to: 0.95 }] },
};

function segEnds(b: Body, s: Seg): [P, P] {
  switch (s) {
    case 'torso': return [b.hip, b.shoulder];
    case 'upperArm': return [b.shoulder, b.elbowN];
    case 'foreArm': return [b.elbowN, b.handN];
    case 'thigh': return [b.hip, b.kneeN];
    case 'shin': return [b.kneeN, b.ankleN];
  }
}
/** Unit normal pointing to the FRONT of a segment (see types.ts comments). */
function frontNormal(s: Seg, a: P, c: P): P {
  const dx = c.x - a.x, dy = c.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const d = { x: dx / L, y: dy / L };
  return s === 'torso' ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
}

/* ---------- SVG output ---------- */
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const line = (a: P, b: P, color: string, w: number, extra = '') =>
  `<line x1="${f1(a.x)}" y1="${f1(-a.y)}" x2="${f1(b.x)}" y2="${f1(-b.y)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
const poly = (pts: P[], color: string, w: number, extra = '') =>
  `<polyline points="${pts.map((p) => `${f1(p.x)},${f1(-p.y)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const circle = (c: P, r: number, fill: string, extra = '') => `<circle cx="${f1(c.x)}" cy="${f1(-c.y)}" r="${f1(r)}" fill="${fill}"${extra}/>`;
const rect = (x: number, yTop: number, w: number, h: number, stroke: string, fill = 'none', extra = '') =>
  `<rect x="${f1(x)}" y="${f1(-yTop)}" width="${f1(w)}" height="${f1(h)}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" rx="1.2"${extra}/>`;

function anchorPoint(b: Body, at: Anchor): P {
  switch (at) {
    case 'hands': return { x: (b.handN.x + b.handF.x) / 2, y: (b.handN.y + b.handF.y) / 2 };
    case 'feet': return { x: (b.ankleN.x + b.ankleF.x) / 2, y: (b.ankleN.y + b.ankleF.y) / 2 };
    case 'chest': {
      if (b.front) return { x: lerp(b.hip.x, b.shoulder.x, 0.78), y: lerp(b.hip.y, b.shoulder.y, 0.78) };
      const p = { x: lerp(b.hip.x, b.shoulder.x, 0.78), y: lerp(b.hip.y, b.shoulder.y, 0.78) };
      const n = frontNormal('torso', b.hip, b.shoulder);
      return add(p, n, 7);
    }
    case 'upperBack': {
      const p = { x: lerp(b.hip.x, b.shoulder.x, 0.9), y: lerp(b.hip.y, b.shoulder.y, 0.9) };
      const n = frontNormal('torso', b.hip, b.shoulder);
      return add(p, n, -4);
    }
    default: return b[at];
  }
}

/** Front/back view: both sides drawn full strength, torso as a solid trapezoid. */
/* ---------- the figure: shaped limbs (tapered capsules), solid torso, depth, filled muscles ---------- */
const RAD = {
  thigh: [4.8, 3.4], shin: [3.3, 2.1], upper: [3.2, 2.6], fore: [2.5, 1.9], foot: [2.1, 1.6],
  torso: [5.6, 6.2], neck: 2.4, head: 6.2, hand: 2.5,
} as const;
const BG = '#141312';

/** A tapered limb: two circles joined by their tangent lines. */
function capsule(a: P, c: P, r1: number, r2: number, fill: string, extra = ''): string {
  const dx = c.x - a.x, dy = c.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const pts = [
    { x: a.x + nx * r1, y: a.y + ny * r1 },
    { x: c.x + nx * r2, y: c.y + ny * r2 },
    { x: c.x - nx * r2, y: c.y - ny * r2 },
    { x: a.x - nx * r1, y: a.y - ny * r1 },
  ];
  return `<g fill="${fill}"${extra}><polygon points="${pts.map((p) => `${f1(p.x)},${f1(-p.y)}`).join(' ')}"/><circle cx="${f1(a.x)}" cy="${f1(-a.y)}" r="${f1(r1)}"/><circle cx="${f1(c.x)}" cy="${f1(-c.y)}" r="${f1(r2)}"/></g>`;
}
const at = (a: P, c: P, t: number): P => ({ x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t) });

type Shade = { near: string; far: string; eye: boolean; muscles: boolean };

/** Gold fill over part of a limb, nudged toward the front or back of it. */
function muscleOn(a: P, c: P, r1: number, r2: number, n: P, side: 'front' | 'back' | 'mid', from: number, to: number, C: typeof COLORS, torso = false): string {
  const ra = lerp(r1, r2, from), rc = lerp(r1, r2, to);
  const k = side === 'mid' ? 0 : (side === 'front' ? 1 : -1) * (torso ? 0.42 : 0.34);
  const scale = side === 'mid' ? 0.8 : torso ? 0.62 : 0.7;
  const p0 = add(at(a, c, from), n, ra * k), p1 = add(at(a, c, to), n, rc * k);
  return capsule(p0, p1, ra * scale, rc * scale, C.accent, ' fill-opacity="0.95"');
}

function drawSide(b: Body, muscles: MuscleId[], C: typeof COLORS, sh: Shade): string {
  const out: string[] = [];
  // far side first, darker
  out.push(capsule(b.hip, b.kneeF, RAD.thigh[0], RAD.thigh[1], sh.far));
  out.push(capsule(b.kneeF, b.ankleF, RAD.shin[0], RAD.shin[1], sh.far));
  out.push(capsule(b.heelF, b.toeF, RAD.foot[0], RAD.foot[1], sh.far));
  out.push(capsule(b.shoulder, b.elbowF, RAD.upper[0], RAD.upper[1], sh.far));
  out.push(capsule(b.elbowF, b.handF, RAD.fore[0], RAD.fore[1], sh.far));
  out.push(circle(b.handF, RAD.hand, sh.far));
  // torso, neck, head
  out.push(capsule(b.hip, b.shoulder, RAD.torso[0], RAD.torso[1], sh.near));
  out.push(capsule(b.shoulder, b.neck, RAD.neck, RAD.neck, sh.near));
  out.push(circle(b.headC, RAD.head, sh.near));
  if (sh.eye) {
    // which way the figure is looking: a small eye toward the front of the head
    const hd = { x: b.headC.x - b.shoulder.x, y: b.headC.y - b.shoulder.y };
    const L = Math.hypot(hd.x, hd.y) || 1;
    const u = { x: hd.x / L, y: hd.y / L };
    const front = { x: u.y, y: -u.x };
    out.push(circle(add(add(b.headC, u, 0.9), front, 3.7), 1.15, BG));
  }
  // near leg and arm, light
  out.push(capsule(b.hip, b.kneeN, RAD.thigh[0], RAD.thigh[1], sh.near));
  out.push(capsule(b.kneeN, b.ankleN, RAD.shin[0], RAD.shin[1], sh.near));
  out.push(capsule(b.heelN, b.toeN, RAD.foot[0], RAD.foot[1], sh.near));
  // muscles sit under the near arm so the arm still reads in front of the body
  const mus: string[] = [];
  if (sh.muscles) {
    for (const m of muscles) {
      for (const mk of MUSCLES[m]?.marks ?? []) {
        if ('seg' in mk) {
          if (mk.seg === 'upperArm' || mk.seg === 'foreArm') continue;
          const [a, c] = segEnds(b, mk.seg);
          const n = frontNormal(mk.seg, a, c);
          const r = mk.seg === 'torso' ? RAD.torso : mk.seg === 'thigh' ? RAD.thigh : mk.seg === 'shin' ? RAD.shin : mk.seg === 'upperArm' ? RAD.upper : RAD.fore;
          mus.push(muscleOn(a, c, r[0], r[1], n, mk.side, mk.from, mk.to, C, mk.seg === 'torso'));
        } else if (mk.dot !== 'shoulder') {
          const base = b[mk.dot === 'neck' ? 'neck' : mk.dot];
          const n = frontNormal('torso', b.hip, b.shoulder);
          const off = mk.side === 'front' ? 3 : mk.side === 'back' ? -3 : 0;
          mus.push(circle(add(base, n, off), mk.r * 1.05, C.accent, ' fill-opacity="0.95"'));
        }
      }
    }
  }
  out.push(...mus);
  out.push(capsule(b.shoulder, b.elbowN, RAD.upper[0], RAD.upper[1], sh.near));
  out.push(capsule(b.elbowN, b.handN, RAD.fore[0], RAD.fore[1], sh.near));
  out.push(circle(b.handN, RAD.hand, sh.near));
  // arm muscles go on top of the arm
  if (sh.muscles) {
    for (const m of muscles) {
      for (const mk of MUSCLES[m]?.marks ?? []) {
        if ('seg' in mk && (mk.seg === 'upperArm' || mk.seg === 'foreArm')) {
          const [a, c] = segEnds(b, mk.seg);
          const r = mk.seg === 'upperArm' ? RAD.upper : RAD.fore;
          out.push(muscleOn(a, c, r[0], r[1], frontNormal(mk.seg, a, c), mk.side, mk.from, mk.to, C));
        } else if (!('seg' in mk) && mk.dot === 'shoulder') {
          const n = frontNormal('torso', b.hip, b.shoulder);
          const off = mk.side === 'front' ? 2.2 : mk.side === 'back' ? -2.2 : 0;
          out.push(circle(add(b.shoulder, n, off), mk.r * 1.05, C.accent, ' fill-opacity="0.95"'));
        }
      }
    }
  }
  return out.join('');
}

function drawFrontView(b: Body, muscles: MuscleId[], C: typeof COLORS, sh: Shade, back: boolean): string {
  const f = b.front!;
  const out: string[] = [];
  const legs = [[f.hpR, b.kneeN, b.ankleN, b.heelN, b.toeN], [f.hpL, b.kneeF, b.ankleF, b.heelF, b.toeF]] as const;
  for (const [h, k, a, he, to] of legs) {
    out.push(capsule(h, k, RAD.thigh[0] + 0.8, RAD.thigh[1] + 0.8, BG));
    out.push(capsule(h, k, RAD.thigh[0], RAD.thigh[1], sh.near));
    out.push(capsule(k, a, RAD.shin[0], RAD.shin[1], sh.near));
    out.push(capsule(he, to, RAD.foot[0], RAD.foot[1], sh.near));
  }
  out.push(`<polygon points="${[f.shL, f.shR, f.hpR, f.hpL].map((p) => `${f1(p.x)},${f1(-p.y)}`).join(' ')}" fill="${sh.near}" stroke="${sh.near}" stroke-width="7" stroke-linejoin="round"/>`);
  out.push(capsule(b.shoulder, b.neck, RAD.neck + 0.3, RAD.neck + 0.3, sh.near));
  out.push(circle(b.headC, RAD.head + 0.2, sh.near));
  if (sh.eye && !back) {
    out.push(circle({ x: b.headC.x - 2.3, y: b.headC.y + 0.6 }, 1.05, BG));
    out.push(circle({ x: b.headC.x + 2.3, y: b.headC.y + 0.6 }, 1.05, BG));
  }
  // torso and leg muscles under the arms
  const EDGE: MuscleId[] = ['lats', 'obliques', 'serratus', 'teresMajor'];
  const armMarks: string[] = [];
  if (sh.muscles) {
    for (const m of muscles) {
      for (const mk of MUSCLES[m]?.marks ?? []) {
        if ('seg' in mk) {
          const pairs: [P, P, readonly [number, number]][] =
            mk.seg === 'thigh' ? [[f.hpR, b.kneeN, RAD.thigh], [f.hpL, b.kneeF, RAD.thigh]]
            : mk.seg === 'shin' ? [[b.kneeN, b.ankleN, RAD.shin], [b.kneeF, b.ankleF, RAD.shin]]
            : mk.seg === 'upperArm' ? [[f.shR, b.elbowN, RAD.upper], [f.shL, b.elbowF, RAD.upper]]
            : mk.seg === 'foreArm' ? [[b.elbowN, b.handN, RAD.fore], [b.elbowF, b.handF, RAD.fore]]
            : EDGE.includes(m) ? [[f.hpR, f.shR, [2.6, 2.8]], [f.hpL, f.shL, [2.6, 2.8]]]
            : [[b.hip, b.shoulder, [5.5, 6.5]]];
          for (const [a, c, r] of pairs) {
            const s = capsule(at(a, c, mk.from), at(a, c, mk.to), lerp(r[0], r[1], mk.from) * 0.72, lerp(r[0], r[1], mk.to) * 0.72, C.accent, ' fill-opacity="0.95"');
            (mk.seg === 'upperArm' || mk.seg === 'foreArm' ? armMarks : out).push(s);
          }
        } else {
          const pts = mk.dot === 'shoulder' ? [f.shR, f.shL] : mk.dot === 'hip' ? [f.hpR, f.hpL] : [b.neck];
          for (const p of pts) (mk.dot === 'shoulder' ? armMarks : out).push(circle(p, mk.r, C.accent, ' fill-opacity="0.95"'));
        }
      }
    }
  }
  // arms last, with a dark outline so an arm across the body still reads
  for (const [s, e, h] of [[f.shR, b.elbowN, b.handN], [f.shL, b.elbowF, b.handF]] as const) {
    out.push(capsule(s, e, RAD.upper[0] + 0.8, RAD.upper[1] + 0.8, BG));
    out.push(capsule(e, h, RAD.fore[0] + 0.8, RAD.fore[1] + 0.8, BG));
    out.push(capsule(s, e, RAD.upper[0], RAD.upper[1], sh.near));
    out.push(capsule(e, h, RAD.fore[0], RAD.fore[1], sh.near));
    out.push(circle(h, RAD.hand, sh.near));
  }
  out.push(...armMarks);
  return out.join('');
}

function drawBody(b: Body, muscles: MuscleId[], C = COLORS, view?: View3, ghost = false): string {
  const sh: Shade = ghost ? { near: C.ghost, far: C.ghost, eye: false, muscles: false } : { near: C.body, far: C.far, eye: true, muscles: true };
  return b.front ? drawFrontView(b, muscles, C, sh, view === 'back') : drawSide(b, muscles, C, sh);
}

/** A soft contact shadow under whatever is touching the floor. */
function shadow(b: Body): string {
  const pts = [b.heelN, b.toeN, b.heelF, b.toeF, b.handN, b.handF, b.kneeN, b.kneeF, b.hip].filter((p) => p.y < 7);
  if (!pts.length) return '';
  const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
  return `<ellipse cx="${f1((x0 + x1) / 2)}" cy="0.7" rx="${f1(Math.max(9, (x1 - x0) / 2 + 7))}" ry="1.9" fill="#000" fill-opacity="0.4"/>`;
}

function drawProp(pr: Prop, b: Body, C = COLORS, topY = 140): { back: string; front: string } {
  const s = C.prop;
  let back = '';
  let front = '';
  switch (pr.t) {
    case 'box': back = rect(pr.x - pr.w / 2, pr.h, pr.w, pr.h, s, '#232834'); break;
    case 'bench': {
      const half = pr.w / 2;
      const ang = rad(pr.angle ?? 0);
      const l = { x: pr.x - half * Math.cos(ang), y: pr.h - half * Math.sin(ang) };
      const r = { x: pr.x + half * Math.cos(ang), y: pr.h + half * Math.sin(ang) };
      back += line(l, r, s, 4);
      back += line({ x: pr.x - half * 0.7, y: 0 }, { x: pr.x - half * 0.7, y: lerp(l.y, r.y, 0.15) - 2 }, s, 1.8);
      back += line({ x: pr.x + half * 0.7, y: 0 }, { x: pr.x + half * 0.7, y: lerp(l.y, r.y, 0.85) - 2 }, s, 1.8);
      break;
    }
    case 'wall': back = line({ x: pr.x, y: 0 }, { x: pr.x, y: topY }, s, 3); break;
    case 'bar': back = line({ x: pr.x - 14, y: pr.y }, { x: pr.x + 14, y: pr.y }, s, 2.2) + circle({ x: pr.x, y: pr.y }, 2.8, s); break;
    case 'hurdle':
      back = line({ x: pr.x - 4, y: 0 }, { x: pr.x - 4, y: pr.h }, s, 1.6) + line({ x: pr.x + 4, y: 0 }, { x: pr.x + 4, y: pr.h }, s, 1.6) + line({ x: pr.x - 5, y: pr.h }, { x: pr.x + 5, y: pr.h }, s, 2.4);
      break;
    case 'cone':
      back = `<polygon points="${f1(pr.x - 4)},0 ${f1(pr.x + 4)},0 ${f1(pr.x)},-9" fill="${C.accent}" fill-opacity="0.55"/>`;
      break;
    case 'line': back = line({ x: pr.x - 6, y: 0.3 }, { x: pr.x + 6, y: 0.3 }, '#c9d1de', 1.6); break;
    case 'hoop':
      back = line({ x: pr.x + 8, y: pr.y + 14 }, { x: pr.x + 8, y: pr.y - 6 }, s, 2) + `<ellipse cx="${f1(pr.x)}" cy="${f1(-pr.y)}" rx="7" ry="1.6" fill="none" stroke="${C.accent}" stroke-width="1.6"/>`;
      break;
    case 'dumbbell': {
      const p = anchorPoint(b, pr.at);
      front = line({ x: p.x - 3.5, y: p.y }, { x: p.x + 3.5, y: p.y }, s, 2) + circle({ x: p.x - 3.5, y: p.y }, 3, s) + circle({ x: p.x + 3.5, y: p.y }, 3, s);
      break;
    }
    case 'kettlebell': {
      const p = anchorPoint(b, pr.at);
      front = `<circle cx="${f1(p.x)}" cy="${f1(-p.y + 2.5)}" r="2.6" fill="none" stroke="${s}" stroke-width="1.4"/>` + circle({ x: p.x, y: p.y - 6 }, 4.6, s);
      break;
    }
    case 'medball': case 'ball': {
      const p = anchorPoint(b, pr.at);
      front = circle(p, pr.t === 'ball' ? 4.4 : 5.2, pr.t === 'ball' ? C.accent : s, pr.t === 'ball' ? ' fill-opacity="0.9"' : '');
      break;
    }
    case 'plate': { const p = anchorPoint(b, pr.at); front = `<circle cx="${f1(p.x)}" cy="${f1(-p.y)}" r="6" fill="none" stroke="${s}" stroke-width="2.4"/>`; break; }
    case 'barbell': { const p = anchorPoint(b, pr.at); front = `<circle cx="${f1(p.x)}" cy="${f1(-p.y)}" r="8.5" fill="none" stroke="${s}" stroke-width="2.6"/>` + circle(p, 1.4, s); break; }
    case 'trapbar': {
      const p = anchorPoint(b, pr.at);
      back = `<circle cx="${f1(p.x)}" cy="${f1(-p.y)}" r="8.5" fill="none" stroke="${s}" stroke-width="2.6"/>` + line({ x: p.x - 9, y: p.y }, { x: p.x + 9, y: p.y }, s, 1.8);
      break;
    }
    case 'abwheel': { const p = anchorPoint(b, pr.at); front = `<circle cx="${f1(p.x)}" cy="${f1(-p.y + 3.5)}" r="4" fill="none" stroke="${s}" stroke-width="2.2"/>`; break; }
    case 'handle': { const p = anchorPoint(b, pr.at); front = circle(p, 1.9, s); break; }
    case 'cable': case 'band': {
      const p = anchorPoint(b, pr.to);
      const from = { x: pr.from[0], y: pr.from[1] };
      back = line(from, p, pr.t === 'band' ? C.accent : s, pr.t === 'band' ? 1.4 : 1, pr.t === 'band' ? ' stroke-opacity="0.75"' : ' stroke-dasharray="2 1.5"') + circle(from, 1.8, s);
      break;
    }
    case 'landmine': {
      const p = anchorPoint(b, pr.to);
      const piv = { x: pr.pivot[0], y: pr.pivot[1] };
      const dx = p.x - piv.x, dy = p.y - piv.y;
      const L = Math.hypot(dx, dy) || 1;
      const end = { x: p.x + (dx / L) * 6, y: p.y + (dy / L) * 6 };
      back = line(piv, end, s, 2.4) + circle(piv, 2, s);
      front = `<circle cx="${f1(end.x)}" cy="${f1(-end.y)}" r="6.5" fill="none" stroke="${s}" stroke-width="2.2"/>`;
      break;
    }
    case 'roller': {
      const p = Array.isArray(pr.at) ? { x: pr.at[0], y: pr.at[1] } : anchorPoint(b, pr.at);
      back = `<circle cx="${f1(p.x)}" cy="${f1(-p.y)}" r="4.5" fill="#232834" stroke="${s}" stroke-width="1.6"/>`;
      break;
    }
    case 'rope': {
      const h = anchorPoint(b, 'hands');
      const f = anchorPoint(b, 'feet');
      const low = Math.min(b.toeN.y, b.toeF.y, b.heelN.y) - 4;
      back = `<path d="M${f1(h.x)},${f1(-h.y)} C${f1(h.x - 16)},${f1(-h.y)} ${f1(f.x - 18)},${f1(-low)} ${f1(f.x)},${f1(-low)} C${f1(f.x + 18)},${f1(-low)} ${f1(h.x + 16)},${f1(-h.y)} ${f1(h.x)},${f1(-h.y)}" fill="none" stroke="${C.accent}" stroke-opacity="0.6" stroke-width="1.2"/>`;
      break;
    }
    case 'bike': {
      const x = pr.x;
      back = circle({ x: x - 16, y: 9 }, 9, 'none', ` stroke="${s}" stroke-width="1.6"`) + circle({ x: x + 16, y: 9 }, 9, 'none', ` stroke="${s}" stroke-width="1.6"`) +
        poly([{ x: x - 16, y: 9 }, { x: x - 2, y: 9 }, { x: x - 6, y: 34 }, { x: x - 16, y: 9 }], s, 1.8) + line({ x: x - 2, y: 9 }, { x: x + 12, y: 38 }, s, 1.8) + line({ x: x + 12, y: 38 }, { x: x + 16, y: 9 }, s, 1.8) +
        line({ x: x - 10, y: 35 }, { x: x - 2, y: 35 }, s, 3);
      break;
    }
    case 'rower': {
      const x = pr.x, w = pr.w ?? 80;
      back = line({ x: x - w / 2, y: 4 }, { x: x + w / 2, y: 4 }, s, 2.4) + rect(x + w / 2 - 10, 18, 12, 18, s, '#232834');
      break;
    }
    case 'stair': {
      const x = pr.x;
      let d = '';
      for (let i = 0; i < 4; i++) d += rect(x - 10 + i * 7, 6 + i * 6, 7, 6 + i * 6, s, '#232834');
      back = d;
      break;
    }
    case 'sled': {
      const x = pr.x;
      back = rect(x - 8, 12, 16, 10, s, '#232834') + line({ x: x - 12, y: 1.5 }, { x: x + 12, y: 1.5 }, s, 2) + line({ x: x - 4, y: 12 }, { x: x - 6, y: 34 }, s, 2) + line({ x: x + 4, y: 12 }, { x: x + 2, y: 34 }, s, 2);
      break;
    }
    case 'machine': {
      const w = pr.w ?? 24, h = pr.h ?? 60;
      back = rect(pr.x - w / 2, h, w, h, s, 'none', ' stroke-dasharray="3 2"');
      break;
    }
    case 'arrow': {
      const a = { x: pr.from[0], y: pr.from[1] }, c = { x: pr.to[0], y: pr.to[1] };
      const dx = c.x - a.x, dy = c.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const u = { x: dx / L, y: dy / L };
      const n = { x: -u.y, y: u.x };
      const h1 = add(add(c, u, -4), n, 2.6), h2 = add(add(c, u, -4), n, -2.6);
      front = line(a, c, C.accent, 1.4, ' stroke-dasharray="3 2" stroke-opacity="0.9"') + `<polygon points="${f1(c.x)},${f1(-c.y)} ${f1(h1.x)},${f1(-h1.y)} ${f1(h2.x)},${f1(-h2.y)}" fill="${C.accent}"/>`;
      break;
    }
  }
  return { back, front };
}

/* ---------- bounds ---------- */
type Box = { x0: number; x1: number; y0: number; y1: number }; // world, y0 = bottom
function bodyBox(b: Body): Box {
  const pts = [...POINT_KEYS.map((k) => b[k]), b.headC, ...(b.front ? [b.front.shR, b.front.shL, b.front.hpR, b.front.hpL] : [])];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs) - 7, x1: Math.max(...xs) + 7, y0: Math.min(...ys) - 4, y1: Math.max(...ys) + 7 };
}
function propBox(pr: Prop, b: Body): Box | null {
  switch (pr.t) {
    case 'box': return { x0: pr.x - pr.w / 2, x1: pr.x + pr.w / 2, y0: 0, y1: pr.h };
    case 'bench': return { x0: pr.x - pr.w / 2 - 1, x1: pr.x + pr.w / 2 + 1, y0: 0, y1: pr.h + Math.abs(Math.sin(rad(pr.angle ?? 0))) * pr.w / 2 + 2 };
    case 'wall': return { x0: pr.x - 2, x1: pr.x + 2, y0: 0, y1: 10 };
    case 'bar': return { x0: pr.x - 15, x1: pr.x + 15, y0: pr.y - 4, y1: pr.y + 4 };
    case 'hurdle': return { x0: pr.x - 6, x1: pr.x + 6, y0: 0, y1: pr.h + 2 };
    case 'cone': case 'line': return { x0: pr.x - 6, x1: pr.x + 6, y0: 0, y1: 9 };
    case 'hoop': return { x0: pr.x - 9, x1: pr.x + 10, y0: pr.y - 8, y1: pr.y + 16 };
    case 'cable': case 'band': return { x0: pr.from[0] - 3, x1: pr.from[0] + 3, y0: pr.from[1] - 3, y1: pr.from[1] + 3 };
    case 'landmine': return { x0: pr.pivot[0] - 3, x1: pr.pivot[0] + 3, y0: pr.pivot[1] - 3, y1: pr.pivot[1] + 3 };
    case 'roller': return Array.isArray(pr.at) ? { x0: pr.at[0] - 5, x1: pr.at[0] + 5, y0: pr.at[1] - 5, y1: pr.at[1] + 5 } : null;
    case 'bike': return { x0: pr.x - 26, x1: pr.x + 26, y0: 0, y1: 40 };
    case 'rower': { const w = pr.w ?? 80; return { x0: pr.x - w / 2, x1: pr.x + w / 2 + 2, y0: 0, y1: 20 }; }
    case 'stair': return { x0: pr.x - 11, x1: pr.x + 19, y0: 0, y1: 26 };
    case 'sled': return { x0: pr.x - 13, x1: pr.x + 13, y0: 0, y1: 35 };
    case 'machine': { const w = pr.w ?? 24, h = pr.h ?? 60; return { x0: pr.x - w / 2, x1: pr.x + w / 2, y0: 0, y1: h }; }
    case 'arrow': return { x0: Math.min(pr.from[0], pr.to[0]) - 3, x1: Math.max(pr.from[0], pr.to[0]) + 3, y0: Math.min(pr.from[1], pr.to[1]) - 3, y1: Math.max(pr.from[1], pr.to[1]) + 3 };
    default: {
      const p = 'at' in pr && !Array.isArray(pr.at) ? anchorPoint(b, pr.at as Anchor) : null;
      return p ? { x0: p.x - 10, x1: p.x + 10, y0: p.y - 10, y1: p.y + 10 } : null;
    }
  }
}
const union = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) });

export type View = { x: number; y: number; w: number; h: number };

/** One viewBox that fits both poses and all props, at a fixed aspect ratio, so both panels share a scale. */
export function fitView(d: Diagram, aspect = 1.25): View {
  const A = placePose(d.a, 0, d.view);
  const B = placePose(d.b, 0, d.view);
  let box = union(bodyBox(A), bodyBox(B));
  for (let i = 0; i <= 4; i++) box = union(box, bodyBox(placePose(lerpPose(d.a, d.b, i / 4, d.view), 0, d.view)));
  for (const pr of d.props ?? []) {
    const pa = propBox(pr, A), pb = propBox(pr, B);
    if (pa) box = union(box, pa);
    if (pb) box = union(box, pb);
  }
  box.y0 = Math.min(box.y0, -3);
  const pad = 5;
  let w = box.x1 - box.x0 + pad * 2;
  let h = box.y1 - box.y0 + pad * 2;
  w = Math.max(w, 70);
  h = Math.max(h, 56);
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const cx = (box.x0 + box.x1) / 2;
  // keep the floor near the bottom edge
  const bottom = box.y0 - pad;
  return { x: cx - w / 2, y: -(bottom + h), w, h };
}

export interface RenderOpts {
  /** 0 = start pose, 1 = end pose, anything between = interpolated frame */
  t: number;
  view?: View;
  /** pixel size hints for the root <svg> (optional) */
  width?: number;
  height?: number;
  muscles?: MuscleId[];
  colors?: typeof COLORS;
  /** drop the outer <svg> wrapper (for composing several panels) */
  inner?: boolean;
  /** draw the start position faintly behind the current frame */
  ghost?: boolean;
}

export function renderFrame(d: Diagram, o: RenderOpts): string {
  const C = o.colors ?? COLORS;
  const view = o.view ?? fitView(d);
  const pose = o.t <= 0 ? d.a : o.t >= 1 ? d.b : lerpPose(d.a, d.b, o.t, d.view);
  const body = placePose(pose, 0, d.view);
  const which = o.t < 0.5 ? 'a' : 'b';
  const props = (d.props ?? []).filter((p) => !p.only || p.only === which);
  const top = -view.y;
  const drawn = props.map((p) => drawProp(p, body, C, top));
  const floorY = 0;
  const ghost = o.ghost && o.t > 0.02 ? `<g opacity="0.6">${drawBody(placePose(d.a, 0, d.view), [], C, d.view, true)}</g>` : '';
  const parts = [
    `<line x1="${f1(view.x)}" y1="${floorY + 0.8}" x2="${f1(view.x + view.w)}" y2="${floorY + 0.8}" stroke="${C.floor}" stroke-width="1.6"/>`,
    shadow(body),
    ghost,
    ...drawn.map((x) => x.back),
    drawBody(body, o.muscles ?? [], C, d.view),
    ...drawn.map((x) => x.front),
  ].join('');
  if (o.inner) return parts;
  const size = o.width ? ` width="${o.width}" height="${o.height ?? Math.round((o.width * view.h) / view.w)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f1(view.x)} ${f1(view.y)} ${f1(view.w)} ${f1(view.h)}"${size} preserveAspectRatio="xMidYMax meet">${parts}</svg>`;
}

/** Contact report used by the preview script: how far each foot / hand is above the floor. */
export function contactReport(p: Pose | FrontPose, view?: View3) {
  const b = placePose(p, 0, view);
  const h = (k: BodyPoint) => Math.round((b[k].y - HALF) * 10) / 10;
  return { heelN: h('heelN'), toeN: h('toeN'), heelF: h('heelF'), toeF: h('toeF'), handN: h('handN'), handF: h('handF'), kneeN: h('kneeN'), kneeF: h('kneeF'), hip: h('hip'), shoulder: h('shoulder') };
}

export type { XY };
