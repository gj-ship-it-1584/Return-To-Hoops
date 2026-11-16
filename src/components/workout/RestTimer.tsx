/* Rest timer pinned to the bottom of the workout. Timestamp-based, so it stays correct
   if the phone locks; it is kept in localStorage so a reopened app picks it back up. */
import { useEffect, useRef, useState } from 'react';
import { beep, buzz } from '../../lib/alerts';
import { fmtClock } from '../../lib/dates';

const KEY = 'hoops.rest';
type Rest = { endsAt: number; total: number; label: string };

let setter: ((r: Rest | null) => void) | null = null;
export function startRest(seconds: number, label: string) {
  const r = { endsAt: Date.now() + seconds * 1000, total: seconds, label };
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* private mode */
  }
  setter?.(r);
}

function load(): Rest | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null') as Rest | null;
    return r && r.endsAt > Date.now() - 5000 ? r : null;
  } catch {
    return null;
  }
}

export function RestTimer({ sound, vibrate }: { sound: boolean; vibrate: boolean }) {
  const [rest, setRest] = useState<Rest | null>(load);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState(false);
  const alerted = useRef<number>(0);

  useEffect(() => {
    setter = setRest;
    return () => {
      setter = null;
    };
  }, []);

  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);

  const clear = () => {
    setRest(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!rest) return;
    const left = (rest.endsAt - now) / 1000;
    if (left <= 0 && alerted.current !== rest.endsAt) {
      alerted.current = rest.endsAt;
      if (sound) beep(3, 990);
      if (vibrate) buzz([300, 120, 300]);
      setFlash(true);
      setTimeout(() => {
        setFlash(false);
        clear();
      }, 2600);
    }
  }, [now, rest, sound, vibrate]);

  if (!rest) return null;
  const left = Math.max(0, (rest.endsAt - now) / 1000);
  const pct = Math.min(100, ((rest.total - left) / rest.total) * 100);
  const done = left <= 0;
  return (
    <>
      {flash && <div className="animate-flash pointer-events-none fixed inset-0 z-40" />}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-lg px-4 pt-2">
          <div className="h-1 overflow-hidden rounded-full bg-card2">
            <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted">{done ? 'Rest done — go' : `Rest · ${rest.label}`}</div>
              <div className={`tnum text-3xl font-bold ${done ? 'text-accent' : ''}`}>{fmtClock(left)}</div>
            </div>
            <button
              type="button"
              className="min-h-12 min-w-16 rounded-xl bg-card2 font-semibold active:bg-line"
              onClick={() => {
                const r = { ...rest, endsAt: Math.max(rest.endsAt, Date.now()) + 30000, total: rest.total + 30 };
                localStorage.setItem(KEY, JSON.stringify(r));
                alerted.current = 0;
                setRest(r);
              }}
            >
              +30 s
            </button>
            <button type="button" className="min-h-12 min-w-16 rounded-xl bg-accent font-semibold text-accent-ink active:brightness-90" onClick={clear}>
              Skip
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
