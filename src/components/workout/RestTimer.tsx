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
      <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4">
        <div className="pointer-events-auto mx-auto mb-2 flex max-w-lg items-center gap-2.5 rounded-full border border-accent/70 bg-card/95 py-1.5 pr-1.5 pl-4 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{done ? 'Go' : 'Rest'}</span>
          <span className={`tnum font-display text-[26px] leading-none ${done ? 'text-good' : 'text-accent'}`}>{fmtClock(left)}</span>
          <span className="h-[2px] min-w-0 flex-1 overflow-hidden rounded-full bg-line">
            <span className="block h-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </span>
          <button
            type="button"
            className="min-h-10 rounded-full border border-line px-3 text-[12px] text-muted active:bg-card2"
            onClick={() => {
              const r = { ...rest, endsAt: Math.max(rest.endsAt, Date.now()) + 30000, total: rest.total + 30 };
              localStorage.setItem(KEY, JSON.stringify(r));
              alerted.current = 0;
              setRest(r);
            }}
          >
            +30
          </button>
          <button type="button" className="min-h-10 rounded-full bg-accent px-4 text-[12px] font-medium text-accent-ink active:brightness-90" onClick={clear}>
            Skip
          </button>
        </div>
      </div>
    </>
  );
}
