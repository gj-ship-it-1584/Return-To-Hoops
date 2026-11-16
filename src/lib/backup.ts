/* Export / import every record as one JSON file, plus the private one-time setup link. */
import { db, SYNCED_TABLES, uid, type LabEntry, type BodyLog, type Settings } from './db';
import { setMeta, getMeta, save, ensureSettings } from './store';
import { todayKey } from './dates';

export interface BackupFile {
  app: 'return-to-hoops';
  version: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export async function buildBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNCED_TABLES) tables[t] = await db.table(t).toArray();
  return { app: 'return-to-hoops', version: 1, exportedAt: new Date().toISOString(), tables };
}

/** Share sheet on iPhone (save to Files, AirDrop); plain download elsewhere. */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data = await buildBackup();
  const name = `hoops-backup-${todayKey()}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Hoops backup' });
      await setMeta('lastBackupAt', Date.now());
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  await setMeta('lastBackupAt', Date.now());
  return 'downloaded';
}

export function parseBackup(text: string): BackupFile {
  const j = JSON.parse(text);
  if (j?.app !== 'return-to-hoops' || typeof j.tables !== 'object') throw new Error('This is not a Return to Hoops backup file.');
  return j as BackupFile;
}

/** Replace everything on this phone with the backup, exactly as exported. */
export async function restoreBackup(b: BackupFile) {
  await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
    for (const t of SYNCED_TABLES) {
      await db.table(t).clear();
      const rows = b.tables[t];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
    }
  });
}

export async function wipeLocal() {
  await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
    for (const t of SYNCED_TABLES) await db.table(t).clear();
  });
}

export async function daysSinceBackup(): Promise<number | null> {
  const t = await getMeta<number>('lastBackupAt');
  const first = await getMeta<number>('firstLaunch');
  const since = t ?? first;
  if (!since) return null;
  return Math.floor((Date.now() - since) / 86400000);
}

/* ---------- private setup link ----------
   Personal numbers (the November 2026 baseline labs, starting weight) are not in the
   public code. They arrive once through a link whose data lives after the '#', which
   browsers never send to any server:  .../#setup=<base64 json>  */
export interface SetupData {
  labs?: Omit<LabEntry, 'id' | 'u'>[];
  body?: Omit<BodyLog, 'id' | 'u'>[];
  settings?: Partial<Settings>;
}

export function encodeSetup(d: SetupData) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(d))));
}

export async function applySetupHash(hash: string): Promise<boolean> {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const raw = p.get('setup');
  if (!raw) return false;
  if (await getMeta('setupApplied')) return false;
  let d: SetupData;
  try {
    d = JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return false;
  }
  const existingLabs = await db.labs.toArray();
  for (const l of d.labs ?? []) if (!existingLabs.some((x) => x.date === l.date && !x.deleted)) await save<LabEntry>('labs', { ...l, id: uid() });
  const existingBody = await db.body.toArray();
  for (const b of d.body ?? []) if (!existingBody.some((x) => x.date === b.date && !x.deleted)) await save<BodyLog>('body', { ...b, id: uid() });
  if (d.settings) {
    const cur = await ensureSettings();
    await save<Settings>('settings', { ...cur, ...d.settings, id: cur.id });
  }
  await setMeta('setupApplied', Date.now());
  return true;
}
