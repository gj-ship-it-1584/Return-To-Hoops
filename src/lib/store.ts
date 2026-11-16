/* Write helpers: every write stamps `u` and notifies the sync layer. */
import { db, uid, type Base, type Settings, type SyncedTable } from './db';
import { firstMondayOnOrAfter, todayKey } from './dates';
import { NUTRITION, DUNK_TARGET_IN } from '../plan/content';

type Listener = (table: SyncedTable, rec: Base) => void;
const listeners = new Set<Listener>();
export const onLocalWrite = (fn: Listener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export async function save<T extends Base>(table: SyncedTable, rec: Omit<T, 'u' | 'id'> & { id?: string }): Promise<T> {
  const r = { ...rec, id: rec.id ?? uid(), u: Date.now() } as unknown as T;
  await db.table(table).put(r);
  for (const f of listeners) f(table, r);
  return r;
}

export async function patch<T extends Base>(table: SyncedTable, id: string, changes: Partial<T>): Promise<T | undefined> {
  const cur = (await db.table(table).get(id)) as T | undefined;
  if (!cur) return undefined;
  return save<T>(table, { ...cur, ...changes });
}

/** Soft delete (a tombstone), so the deletion syncs. */
export async function remove(table: SyncedTable, id: string) {
  const cur = await db.table(table).get(id);
  if (cur) await save(table, { ...cur, deleted: true });
}

export const SETTINGS_ID = 'settings';
export function defaultSettings(today = todayKey()): Settings {
  return {
    id: SETTINGS_ID,
    u: 1, // anything synced from another device wins over these defaults
    startDate: firstMondayOnOrAfter(today),
    liftDays: [1, 3, 5],
    units: 'lb',
    restMain: 150,
    restOther: 75,
    sound: true,
    vibrate: true,
    goalWeight: 165,
    calories: NUTRITION.calories,
    dunkTarget: DUNK_TARGET_IN,
  };
}

export async function ensureSettings(): Promise<Settings> {
  const s = await db.settings.get(SETTINGS_ID);
  if (s) return { ...defaultSettings(), ...s };
  const d = defaultSettings();
  await db.settings.put(d);
  return d;
}

export async function saveSettings(changes: Partial<Settings>) {
  const cur = await ensureSettings();
  return save<Settings>('settings', { ...cur, ...changes, id: SETTINGS_ID });
}

/* device-only key/value (never synced) */
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ id: key, value });
}
export async function delMeta(key: string) {
  await db.meta.delete(key);
}
