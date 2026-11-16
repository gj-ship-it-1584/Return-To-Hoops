/* Daily targets and what's been logged toward them on a date. */
import { db, type Settings } from './db';

export const DEFAULT_TARGETS = { cardioMin: 60, protein: 150, steps: 8000, sleep: 7.5 };
export const targetsOf = (s: Settings) => ({ ...DEFAULT_TARGETS, ...(s.targets ?? {}), calories: s.calories });

export interface DayTotals {
  /** all cardio + activities, dog walks included */
  cardioMin: number;
  dogMin: number;
  protein: number;
  calories: number;
  steps?: number;
  sleep?: number;
}

/** Protein and calories add up across entries; steps and sleep take the day's highest entry. */
export async function dayTotals(date: string): Promise<DayTotals> {
  const [cardio, body, sessions] = await Promise.all([
    db.cardio.where('date').equals(date).filter((c) => !c.deleted).toArray(),
    db.body.where('date').equals(date).filter((b) => !b.deleted).toArray(),
    db.sessions.where('date').equals(date).filter((s) => !s.deleted && s.type === 'pickup').toArray(),
  ]);
  const max = (xs: (number | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === 'number');
    return v.length ? Math.max(...v) : undefined;
  };
  return {
    cardioMin: cardio.reduce((a, c) => a + c.minutes, 0) + sessions.reduce((a, s) => a + (s.pickup?.minutes ?? 0), 0),
    dogMin: cardio.filter((c) => c.type === 'dog').reduce((a, c) => a + c.minutes, 0),
    protein: body.reduce((a, b) => a + (b.protein ?? 0), 0),
    calories: body.reduce((a, b) => a + (b.calories ?? 0), 0),
    steps: max(body.map((b) => b.steps)),
    sleep: max(body.map((b) => b.sleep)),
  };
}
