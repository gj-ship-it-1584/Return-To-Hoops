/* Optional sync to a free Firebase Firestore project — the same setup as Shea's Log.
   The phone's own database is always the source the app reads from. When Firebase is
   connected, every local write is mirrored to  athletes/<code>/<table>/<id>  and remote
   changes are merged back in with last-writer-wins on `u`.
   The Firebase SDK is loaded only when a config exists, so the app stays small offline. */
import { db, SYNCED_TABLES, type Base, type SyncedTable } from './db';
import { onLocalWrite, getMeta, setMeta, delMeta } from './store';

export interface FirebaseLink {
  config: Record<string, string>;
  code: string;
}

export type SyncState = 'local' | 'connecting' | 'live' | 'offline' | 'error';
let state: SyncState = 'local';
let lastError = '';
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const syncStatus = () => ({ state, error: lastError });
export const onSyncStatus = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
const set = (s: SyncState, err = '') => {
  state = s;
  lastError = err;
  emit();
};

type FS = typeof import('firebase/firestore');
let fsMod: FS | null = null;
let fsDb: import('firebase/firestore').Firestore | null = null;
let prefix = '';
let unsubs: (() => void)[] = [];
let offWrite: (() => void) | null = null;

const clean = (o: unknown) => JSON.parse(JSON.stringify(o)); // Firestore rejects undefined

export async function getLink() {
  return getMeta<FirebaseLink>('firebase');
}

export function parseConfig(text: string): Record<string, string> | null {
  // Accept the whole "const firebaseConfig = { ... };" block, or plain JSON.
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const body = m[0]
    .replace(/\/\/.*$/gm, '')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,\s*}/g, '}');
  try {
    const o = JSON.parse(body);
    return o.apiKey && o.projectId ? o : null;
  } catch {
    return null;
  }
}

export function newCode() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

export async function connect(link: FirebaseLink) {
  await setMeta('firebase', link);
  await start();
}

export async function disconnect() {
  stop();
  await delMeta('firebase');
  set('local');
}

function stop() {
  unsubs.forEach((u) => u());
  unsubs = [];
  offWrite?.();
  offWrite = null;
}

export async function start() {
  const link = await getLink();
  if (!link) return set('local');
  stop();
  set(navigator.onLine ? 'connecting' : 'offline');
  try {
    const [{ initializeApp, getApps }, fs] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
    fsMod = fs;
    const app = getApps()[0] ?? initializeApp(link.config);
    try {
      fsDb = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch {
      fsDb = fs.getFirestore(app);
    }
    prefix = `athletes/${link.code}`;
    offWrite = onLocalWrite((table, rec) => void push(table, rec));
    let firstSnaps = 0;
    for (const table of SYNCED_TABLES) {
      let first = true;
      const un = fs.onSnapshot(
        fs.collection(fsDb, `${prefix}/${table}`),
        { includeMetadataChanges: false },
        async (snap) => {
          const remoteIds = new Set<string>();
          for (const ch of snap.docChanges()) {
            const r = ch.doc.data() as Base;
            remoteIds.add(ch.doc.id);
            if (ch.type === 'removed') continue;
            const local = (await db.table(table).get(ch.doc.id)) as Base | undefined;
            if (!local || (r.u ?? 0) > (local.u ?? 0)) await db.table(table).put({ ...r, id: ch.doc.id });
          }
          if (first) {
            first = false;
            // first contact: upload anything this phone has that the cloud doesn't (or has older)
            const all = (await db.table(table).toArray()) as Base[];
            for (const l of all) {
              const remote = snap.docs.find((d) => d.id === l.id)?.data() as Base | undefined;
              if (!remote || (l.u ?? 0) > (remote.u ?? 0)) void push(table, l);
            }
            if (++firstSnaps === SYNCED_TABLES.length) set(snap.metadata.fromCache && !navigator.onLine ? 'offline' : 'live');
          } else if (state !== 'live' && !snap.metadata.fromCache) set('live');
        },
        (err) => set('error', err.code || err.message),
      );
      unsubs.push(un);
    }
  } catch (e) {
    set('error', e instanceof Error ? e.message : String(e));
  }
}

async function push(table: SyncedTable, rec: Base) {
  if (!fsMod || !fsDb) return;
  try {
    await fsMod.setDoc(fsMod.doc(fsDb, `${prefix}/${table}/${rec.id}`), clean(rec));
  } catch (e) {
    console.warn('sync push', e);
  }
}

/** Upload every local record (after an import). */
export async function pushAll() {
  if (!fsMod || !fsDb) return;
  for (const t of SYNCED_TABLES) for (const r of (await db.table(t).toArray()) as Base[]) await push(t, r);
}

/** Delete this athlete's cloud copy (used by Reset all data). */
export async function wipeRemote() {
  if (!fsMod || !fsDb) return;
  for (const t of SYNCED_TABLES) {
    const snap = await fsMod.getDocs(fsMod.collection(fsDb, `${prefix}/${t}`));
    await Promise.all(snap.docs.map((d) => fsMod!.deleteDoc(d.ref)));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => state === 'offline' && set('connecting'));
  window.addEventListener('offline', () => state !== 'local' && set('offline'));
}

/** Link that carries the code + config so a second device (or a home-screen copy) joins the same data. */
export function joinLink(link: FirebaseLink) {
  const cfg = btoa(unescape(encodeURIComponent(JSON.stringify(link.config))));
  return `${location.origin}${location.pathname}#join=${link.code}&cfg=${encodeURIComponent(cfg)}`;
}

export function readJoinHash(hash: string): FirebaseLink | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const code = p.get('join');
  const cfg = p.get('cfg');
  if (!code || !cfg || code.length < 20) return null;
  try {
    return { code, config: JSON.parse(decodeURIComponent(escape(atob(cfg)))) };
  } catch {
    return null;
  }
}
