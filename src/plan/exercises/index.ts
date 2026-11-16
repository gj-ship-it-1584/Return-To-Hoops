import type { Exercise } from '../types';
import { exercises as jumps } from './jumps';
import { exercises as lower } from './lower';
import { exercises as upper } from './upper';
import { exercises as shoulderCore } from './shoulder-core';
import { exercises as mobilityCourt } from './mobility-court';
import { exercises as accessories } from './accessories';

export const ALL_EXERCISES: Exercise[] = [...jumps, ...lower, ...upper, ...shoulderCore, ...mobilityCourt, ...accessories];

/** file name → exercise ids (used by the preview script) */
export const EXERCISE_FILES: Record<string, string[]> = {
  jumps: jumps.map((e) => e.id),
  lower: lower.map((e) => e.id),
  upper: upper.map((e) => e.id),
  'shoulder-core': shoulderCore.map((e) => e.id),
  'mobility-court': mobilityCourt.map((e) => e.id),
  accessories: accessories.map((e) => e.id),
};

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(ALL_EXERCISES.map((e) => [e.id, e]));
