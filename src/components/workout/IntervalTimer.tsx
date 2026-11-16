/* Bike / rower interval timer: 20 s all-out, 40 s easy, with audio cues. */
import { useEffect, useRef, useState } from 'react';
import { beep, buzz, keepAwake } from '../../lib/alerts';
import { fmtClock } from '../../lib/dates';
import { Button } from '../ui';

const WORK = 20, EASY = 40;

export function IntervalTimer({ rounds, onDone, sound, vibrate }: { rounds: number; onDone: (completed: number) => void; sound: boolean; vibrate: boolean }) {
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const lastCue = useRef('');
  const lastTick = useRef('');

  useEffect(() => {
    if (!startAt) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [startAt]);

  const elapsed = startAt ? (now - startAt) / 1000 : 0;
  const per = WORK + EASY;
  const round = Math.min(rounds, Math.floor(elapsed / per) + 1);
  const inRound = elapsed - (round - 1) * per;
  const working = inRound < WORK;
  const left = working ? WORK - inRound : per - inRound;
  const finished = startAt !== null && elapsed >= rounds * per - EASY; // last easy block isn't needed
  const completed = startAt ? Math.min(rounds, Math.floor((elapsed + EASY) / per)) : 0;

  useEffect(() => {
    if (!startAt) return;
    const cue = finished ? 'end' : `${round}-${working ? 'w' : 'e'}`;
    if (cue !== lastCue.current) {
      lastCue.current = cue;
      if (cue === 'end') {
        if (sound) beep(4, 660, 0.25, 0.1);
        if (vibrate) buzz([400, 100, 400]);
        void keepAwake(false);
        onDone(rounds);
        setStartAt(null);
      } else if (working) {
        if (sound) beep(1, 1100, 0.35);
        if (vibrate) buzz(300);
      } else {
        if (sound) beep(2, 520, 0.18);
      }
    }
    // 3-2-1 ticks before each switch
    const s = Math.ceil(left);
    const tick = `${cue}-${s}`;
    if (!finished && s <= 3 && s >= 1 && lastTick.current !== tick) {
      lastTick.current = tick;
      if (sound) beep(1, 760, 0.07);
    }
  }, [now, startAt, round, working, finished, left, rounds, sound, vibrate, onDone]);

  if (!startAt) {
    return (
      <Button
        kind="primary"
        big
        className="w-full"
        onClick={() => {
          lastCue.current = '';
          setStartAt(Date.now());
          setNow(Date.now());
          void keepAwake(true);
        }}
      >
        ▶ Start {rounds} rounds (20 s / 40 s)
      </Button>
    );
  }
  return (
    <div className={`rounded-2xl p-4 text-center ${working ? 'bg-accent text-accent-ink' : 'bg-card2'}`}>
      <div className="text-sm font-semibold uppercase tracking-wider">{working ? 'All out' : 'Easy'}</div>
      <div className="tnum text-6xl font-black">{fmtClock(left)}</div>
      <div className="tnum mt-1 text-sm">Round {round} of {rounds}</div>
      <button
        type="button"
        className="mt-3 min-h-11 rounded-xl bg-black/20 px-4 text-sm font-semibold"
        onClick={() => {
          void keepAwake(false);
          onDone(Math.max(0, completed));
          setStartAt(null);
        }}
      >
        Stop and log {Math.max(0, completed)} rounds
      </button>
    </div>
  );
}
