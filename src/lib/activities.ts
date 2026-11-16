/* Activities you do outside the program (basketball, a run, a hike…) and labels for every
   kind of session, in one place. Basketball is stored as a 'pickup' session so it counts
   toward your weekly sessions; everything else is stored as a cardio entry. */
import { uid, type CardioLog, type Session, type SessionType } from './db';
import { save } from './store';
import { programPosition } from './schedule';
import { DAYS, type DayId } from '../plan/days';

export interface ActivityDef {
  id: string;
  label: string;
  hint: string;
}

export const ACTIVITIES: ActivityDef[] = [
  { id: 'basketball', label: 'Basketball', hint: 'Pickup, shooting, rec league' },
  { id: 'run', label: 'Run', hint: 'Easy or tempo' },
  { id: 'walk', label: 'Walk', hint: 'Any walk' },
  { id: 'dog', label: 'Dog walk', hint: 'Easy or hilly' },
  { id: 'incline', label: 'Incline walk', hint: 'Treadmill, 10–12%' },
  { id: 'bike', label: 'Bike', hint: 'Indoor or outdoor' },
  { id: 'rower', label: 'Rower', hint: 'Steady' },
  { id: 'hike', label: 'Hike', hint: 'Trails, hills' },
  { id: 'swim', label: 'Swim', hint: 'Laps or open water' },
  { id: 'yoga', label: 'Yoga / stretching', hint: 'Mobility class or flow' },
  { id: 'tennis', label: 'Tennis / pickleball', hint: 'Court sports' },
  { id: 'golf', label: 'Golf', hint: 'Walking 9 or 18' },
  { id: 'other', label: 'Other activity', hint: 'Name it yourself' },
];
export const ACTIVITY_LABEL: Record<string, string> = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a.label]));

export type Effort = 'easy' | 'moderate' | 'hard';

/** Log an activity that happened. Returns what was saved. */
export async function logActivity(o: { date: string; type: string; minutes: number; effort?: Effort; label?: string; note?: string; startDate: string }) {
  if (o.type === 'basketball') {
    const pos = programPosition(o.startDate, o.date);
    const end = new Date(o.date + 'T19:00:00').getTime();
    return save<Session>('sessions', {
      id: uid(),
      date: o.date,
      type: 'pickup',
      cycle: pos.cycle,
      week: pos.week,
      startedAt: end - o.minutes * 60000,
      endedAt: end,
      status: 'done',
      ticked: [],
      swaps: {},
      pickup: { minutes: o.minutes, feel: o.effort === 'hard' ? 5 : o.effort === 'easy' ? 2 : 3, note: o.note },
    });
  }
  return save<CardioLog>('cardio', { id: uid(), date: o.date, type: o.type as CardioLog['type'], minutes: o.minutes, effort: o.effort, label: o.label, note: o.note });
}

/** Display name for any session type. */
export function sessionLabel(type: SessionType | string): string {
  if (type in DAYS) return DAYS[type as DayId].title;
  if (type === 'pickup') return 'Basketball';
  if (type === 'mobility') return 'Mobility + walk';
  if (type === 'custom') return 'Workout';
  return type;
}
/** One word for tight spots: week strip, badges. */
export function sessionShort(type: string): string {
  if (type in DAYS) return DAYS[type as DayId].short;
  return type === 'pickup' ? 'Hoops' : type === 'mobility' ? 'Mobility' : type === 'custom' ? 'Workout' : type;
}
export const sessionBadge = sessionShort;
