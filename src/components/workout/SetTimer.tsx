/* Start/stop timer for a timed set. Holds and stretches count down from the selected time
   (both sides in turn when the move is per side) and log the set when it hits zero.
   Runs "for time" (suicides, 17s) use a stopwatch: Stop logs the time you ran.
   Timestamp-based, so a locked phone doesn't throw it off. */
import { useEffect, useRef, useState } from 'react';
import { beep, buzz, unlockAudio } from '../../lib/alerts';

const LEAD = 3; // get set
const SWITCH = 5; // change sides

type Seg = { kind: 'lead' | 'work' | 'switch'; secs: number; side?: 1 | 2 };

function plan(total: number, perSide: boolean, up: boolean): Seg[] {
  if (up) return [{ kind: 'lead', secs: LEAD }, { kind: 'work', secs: Infinity }];
  if (!perSide) return [{ kind: 'lead', secs: LEAD }, { kind: 'work', secs: total }];
  return [
    { kind: 'lead', secs: LEAD },
    { kind: 'work', secs: total, side: 1 },
    { kind: 'switch', secs: SWITCH },
    { kind: 'work', secs: total, side: 2 },
  ];
}

/** where we are: segment index and seconds into it */
function locate(segs: Seg[], elapsed: number) {
  let t = elapsed;
  for (let i = 0; i < segs.length; i++) {
    if (t < segs[i].secs) return { i, into: t };
    t -= segs[i].secs;
  }
  return { i: segs.length, into: 0 };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function SetTimer({
  seconds,
  perSide = false,
  up = false,
  sound,
  vibrate,
  onFinish,
}: {
  /** the selected time in seconds (ignored by the stopwatch) */
  seconds: number | undefined;
  perSide?: boolean;
  /** stopwatch mode, for runs that log how long they took */
  up?: boolean;
  sound: boolean;
  vibrate: boolean;
  /** countdown: called at zero. stopwatch: called on Stop with the time run. */
  onFinish: (elapsedWorkSeconds?: number) => void;
}) {
  const [segs, setSegs] = useState<Seg[] | null>(null); // null = not started
  const [acc, setAcc] = useState(0); // seconds banked before the current run
  const [startedAt, setStartedAt] = useState<number | null>(null); // null = paused
  const [now, setNow] = useState(Date.now());
  const lastSec = useRef<string>('');
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const running = startedAt !== null;
  const elapsed = acc + (running ? (now - startedAt) / 1000 : 0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  const reset = () => {
    setSegs(null);
    setAcc(0);
    setStartedAt(null);
    finished.current = false;
    lastSec.current = '';
  };

  // cues and the finish
  const pos = segs ? locate(segs, elapsed) : null;
  useEffect(() => {
    if (!segs || !pos || !running) return;
    if (pos.i >= segs.length) {
      if (finished.current) return;
      finished.current = true;
      if (sound) beep(3, 990);
      if (vibrate) buzz([300, 120, 300]);
      setStartedAt(null);
      onFinishRef.current();
      reset();
      return;
    }
    const seg = segs[pos.i];
    const left = Math.ceil(seg.secs - pos.into);
    const key = `${pos.i}:${left}`;
    if (key === lastSec.current) return;
    const prev = lastSec.current;
    lastSec.current = key;
    if (!prev) return;
    const [pi] = prev.split(':').map(Number);
    if (pi !== pos.i) {
      // a new segment just began
      if (seg.kind === 'work') {
        if (sound) beep(1, 1175, 0.32);
        if (vibrate) buzz(250);
      } else if (seg.kind === 'switch') {
        if (sound) beep(2, 990);
        if (vibrate) buzz([200, 100, 200]);
      }
    } else if (seg.secs !== Infinity && left <= 3 && left >= 1) {
      if (sound) beep(1, 660, 0.08);
    }
  });

  const start = () => {
    unlockAudio();
    if (!up && !seconds) return;
    setSegs(plan(seconds ?? 0, perSide, up));
    setAcc(0);
    finished.current = false;
    lastSec.current = '';
    setNow(Date.now());
    setStartedAt(Date.now());
  };
  const pause = () => {
    setAcc(elapsed);
    setStartedAt(null);
  };
  const resume = () => {
    setNow(Date.now());
    setStartedAt(Date.now());
  };
  const stopAndLog = () => {
    const work = Math.max(0, elapsed - LEAD);
    reset();
    if (sound) beep(2, 990);
    onFinishRef.current(Math.round(work * 10) / 10);
  };

  const btn = 'min-h-12 rounded-full text-[15px] font-medium active:brightness-90';

  /* not started */
  if (!segs || !pos) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={!up && !seconds}
        className={`${btn} flex w-full items-center justify-center gap-2 border border-accent/60 text-accent disabled:opacity-40`}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden><path d="M7 5l12 7-12 7z" /></svg>
        {up ? 'Start stopwatch' : `Start ${clock(seconds ?? 0)}${perSide ? ' per side' : ''}`}
      </button>
    );
  }

  const seg = segs[Math.min(pos.i, segs.length - 1)];
  const isUpWork = up && seg.kind === 'work';
  const shown = isUpWork ? pos.into : Math.max(0, seg.secs - pos.into);
  const label =
    seg.kind === 'lead' ? 'Get set' : seg.kind === 'switch' ? 'Switch sides' : up ? 'Go' : seg.side ? `Side ${seg.side} of 2` : 'Hold';
  const pct = isUpWork ? 0 : Math.min(100, (pos.into / seg.secs) * 100);

  return (
    <div className="rounded-2xl border border-accent/40 bg-card2/50 px-3 py-3">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium uppercase tracking-[0.16em] ${seg.kind === 'work' ? 'text-accent' : 'text-muted'}`}>{label}</span>
        {!running && <span className="text-[10px] uppercase tracking-[0.16em] text-faint">Paused</span>}
      </div>
      <div className={`tnum mt-1 text-center font-display text-[56px] leading-none ${seg.kind === 'work' ? 'text-ink' : 'text-muted'}`}>
        {isUpWork ? `${clock(shown)}.${Math.floor((shown * 10) % 10)}` : clock(Math.ceil(shown))}
      </div>
      {!isUpWork && (
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line">
          <div className={`h-full ${seg.kind === 'work' ? 'bg-accent' : 'bg-muted'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {up && seg.kind === 'work' ? (
          <button type="button" onClick={stopAndLog} className={`${btn} flex-1 bg-accent text-accent-ink`}>Stop · log time</button>
        ) : running ? (
          <button type="button" onClick={pause} className={`${btn} flex-1 bg-accent text-accent-ink`}>Stop</button>
        ) : (
          <button type="button" onClick={resume} className={`${btn} flex-1 bg-accent text-accent-ink`}>Resume</button>
        )}
        <button type="button" onClick={reset} className="min-h-12 rounded-full border border-line px-4 text-[13px] text-muted active:bg-card2">Reset</button>
      </div>
    </div>
  );
}
