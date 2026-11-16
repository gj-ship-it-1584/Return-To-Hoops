/* Exercise diagram: start/end side by side, an animated toggle, and a small thumbnail. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fitView, renderFrame } from '../figure/figure';
import type { Exercise } from '../plan/types';

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function DiagramPair({ ex }: { ex: Exercise }) {
  const [anim, setAnim] = useState(false);
  const view = useMemo(() => fitView(ex.diagram), [ex]);
  const labels = ex.diagram.labels ?? ['Start', 'End'];
  return (
    <div>
      {anim ? (
        <AnimatedFigure ex={ex} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((t) => (
            <figure key={t} className="rounded-xl bg-card2 p-1">
              <div className="aspect-[5/4] w-full" dangerouslySetInnerHTML={{ __html: renderFrame(ex.diagram, { t, view, muscles: ex.muscles }) }} />
              <figcaption className="pb-1 text-center text-xs text-muted">{labels[t]}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-center">
        <button type="button" onClick={() => setAnim(!anim)} className="min-h-11 rounded-full bg-card2 px-4 text-sm text-ink active:bg-line">
          {anim ? '◼ Show start and end' : '▶ Animate the movement'}
        </button>
      </div>
    </div>
  );
}

function AnimatedFigure({ ex }: { ex: Exercise }) {
  const ref = useRef<HTMLDivElement>(null);
  const view = useMemo(() => fitView(ex.diagram), [ex]);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const MOVE = 1100, HOLD = 450, CYCLE = 2 * (MOVE + HOLD);
    const tick = (now: number) => {
      const p = (now - t0) % CYCLE;
      let t: number;
      if (p < HOLD) t = 0;
      else if (p < HOLD + MOVE) t = ease((p - HOLD) / MOVE);
      else if (p < 2 * HOLD + MOVE) t = 1;
      else t = 1 - ease((p - 2 * HOLD - MOVE) / MOVE);
      if (ref.current) ref.current.innerHTML = renderFrame(ex.diagram, { t, view, muscles: ex.muscles });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ex, view]);
  return (
    <div className="mx-auto w-full max-w-sm rounded-xl bg-card2 p-1">
      <div ref={ref} className="aspect-[5/4] w-full" />
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
