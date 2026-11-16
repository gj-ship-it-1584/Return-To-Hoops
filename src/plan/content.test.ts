import { describe, expect, it } from 'vitest';
import { ALL_EXERCISES, EXERCISES } from './exercises';
import { COURT_WARMUP, DAYS, DESK_RESET, WARMUP } from './days';
import { renderFrame } from '../figure/figure';
import { SLOTS } from './content';

describe('plan content', () => {
  it('every exercise the plan uses exists in the library', () => {
    const missing: string[] = [];
    for (const day of Object.values(DAYS))
      for (const item of day.items)
        for (let w = 1; w <= 13; w++) {
          const id = item.exercise(w);
          if (!EXERCISES[id]) missing.push(`${day.id}:${item.key}:${id}`);
        }
    for (const r of [...WARMUP, ...COURT_WARMUP, ...DESK_RESET]) if (!EXERCISES[r.exercise]) missing.push(`routine:${r.exercise}`);
    expect([...new Set(missing)]).toEqual([]);
  });

  it('ids are unique', () => {
    const ids = ALL_EXERCISES.map((e) => e.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('every exercise has a full write-up and a slot', () => {
    const slotIds = new Set(SLOTS.map((s) => s.id));
    const bad = ALL_EXERCISES.filter(
      (e) => !e.why || !e.setup || e.steps.length < 3 || e.steps.length > 5 || e.cues.length < 2 || !e.mistakes.length || !e.slots.every((s) => slotIds.has(s)),
    ).map((e) => e.id);
    expect(bad).toEqual([]);
  });

  it('every slot used for swaps has at least one alternative', () => {
    for (const day of Object.values(DAYS))
      for (const item of day.items) {
        const alts = ALL_EXERCISES.filter((e) => e.slots.includes(item.slot) && e.id !== item.exercise(1));
        expect(alts.length, `${day.id}:${item.key}`).toBeGreaterThan(0);
      }
  });

  it('every diagram renders without NaN at start, middle and end', () => {
    const bad: string[] = [];
    for (const e of ALL_EXERCISES)
      for (const t of [0, 0.5, 1]) {
        const svg = renderFrame(e.diagram, { t, muscles: e.muscles });
        if (svg.includes('NaN') || svg.includes('undefined')) bad.push(`${e.id}@${t}`);
      }
    expect(bad).toEqual([]);
  });
});
