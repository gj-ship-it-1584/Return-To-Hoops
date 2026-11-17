/* Exercise diagram: an animation player (play/pause, scrub, speed, start-position ghost),
   a start/end side-by-side view, and a small thumbnail. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fitView, renderFrame } from '../figure/figure';
import type { Exercise } from '../plan/types';

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function DiagramPair({ ex }: { ex: Exercise }) {
  const [mode, setMode] = useState<'play' | 'pair'>('play');
  const view = useMemo(() => fitView(ex.diagram), [ex]);
  const labels = ex.diagram.labels ?? ['Start', 'End'];
  const v = ex.diagram.view;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{v === 'front' ? 'Front view' : v === 'back' ? 'Back view' : 'Side view'}</span>
        <button type="button" onClick={() => setMode(mode === 'play' ? 'pair' : 'play')} className="min-h-9 rounded-full px-3 text-[12px] text-accent active:bg-card2">
          {mode === 'play' ? 'Start + end side by side' : '▶ Animation'}
        </button>
      </div>
      {mode === 'play' ? (
        <AnimatedFigure ex={ex} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((t) => (
            <figure key={t} className="rounded-xl bg-card2 p-1">
              <div className="aspect-[5/4] w-full" dangerouslySetInnerHTML={{ __html: renderFrame(ex.diagram, { t, view, muscles: ex.muscles, ghost: t === 1 }) }} />
              <figcaption className="pb-1 text-center text-xs text-muted">{labels[t]}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/** Plays start → end → start. Pause, drag the bar to any point, or slow it down. */
export function AnimatedFigure({ ex, compact = false }: { ex: Exercise; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const view = useMemo(() => fitView(ex.diagram), [ex]);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const pos = useRef(0); // 0..1 position along the movement
  const phase = useRef(0); // 0..2 through one full rep (out and back)
  const labels = ex.diagram.labels ?? ['Start', 'End'];

  const draw = (t: number) => {
    if (ref.current) ref.current.innerHTML = renderFrame(ex.diagram, { t: ease(t), view, muscles: ex.muscles, ghost: true });
    if (scrub.current) scrub.current.value = String(Math.round(t * 100));
  };

  useEffect(() => {
    draw(pos.current);
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const HOLD = 0.18; // pause briefly at each end
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      phase.current = (phase.current + (dt * speed) / 1.5) % 2;
      const ph = phase.current;
      const out = ph < 1 ? ph : 2 - ph;
      const t = Math.min(1, Math.max(0, (out - HOLD / 2) / (1 - HOLD)));
      pos.current = t;
      draw(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex, view, playing, speed]);

  return (
    <div className="w-full">
      <div className="rounded-xl bg-card2 p-1">
        <div ref={ref} className="aspect-[5/4] w-full" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying(!playing)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/60 text-accent active:bg-card2"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>
          )}
        </button>
        <span className="text-[10px] uppercase tracking-[0.12em] text-faint">{labels[0]}</span>
        <input
          ref={scrub}
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={0}
          aria-label="Step through the movement"
          className="h-10 min-w-0 flex-1 accent-[#c9a96a]"
          onInput={(e) => {
            setPlaying(false);
            const t = Number((e.target as HTMLInputElement).value) / 100;
            pos.current = t;
            phase.current = t;
            draw(t);
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.12em] text-faint">{labels[1]}</span>
        {!compact && (
          <button
            type="button"
            onClick={() => setSpeed(speed === 1 ? 0.5 : speed === 0.5 ? 0.25 : 1)}
            className="min-h-10 shrink-0 rounded-full border border-line px-2.5 text-[12px] text-muted tnum active:bg-card2"
            aria-label="Change speed"
          >
            {speed}×
          </button>
        )}
      </div>
    </div>
  );
}

export function Thumb({ ex, size = 56 }: { ex: Exercise; size?: number }) {
  const html = useMemo(() => renderFrame(ex.diagram, { t: 1, muscles: ex.muscles }), [ex]);
  return (
    <div
      className="shrink-0 overflow-hidden rounded-lg bg-card2"
      style={{ width: size, height: Math.round(size * 0.8) }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
