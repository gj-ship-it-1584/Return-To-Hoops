import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Settings, type Session } from './db';
import { defaultSettings, SETTINGS_ID } from './store';
import { todayKey } from './dates';
import { onSyncStatus, syncStatus } from './sync';

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get(SETTINGS_ID), []);
  return { ...defaultSettings(), ...(s ?? {}) };
}

export function useSessions(): Session[] {
  return useLiveQuery(() => db.sessions.filter((s) => !s.deleted).toArray(), []) ?? [];
}

export function useActiveSession(): Session | undefined {
  return useLiveQuery(() => db.sessions.where('status').equals('active').filter((s) => !s.deleted).first(), []);
}

/** today's date key, refreshed when the app comes back to the foreground or at midnight */
export function useToday() {
  const [t, setT] = useState(todayKey());
  useEffect(() => {
    const check = () => setT(todayKey());
    const id = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return t;
}

export function useSyncStatus() {
  const [s, setS] = useState(syncStatus());
  useEffect(() => onSyncStatus(() => setS(syncStatus())), []);
  return s;
}

/* ---------- tiny hash router ----------
   '#/library/box-jump' → ['library', 'box-jump']. Hashes that don't start with '#/'
   (setup / join links) are left alone so "Add to Home Screen" keeps them. */
export function useRoute(): string[] {
  const read = () => (location.hash.startsWith('#/') ? location.hash.slice(2).split('/').filter(Boolean).map(decodeURIComponent) : []);
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => {
      setR(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export const go = (path: string) => {
  location.hash = '#/' + path;
};
export const back = () => {
  if (history.length > 1) history.back();
  else go('');
};
