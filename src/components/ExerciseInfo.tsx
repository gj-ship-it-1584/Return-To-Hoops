/* The explanation block shared by the library page and the in-workout info sheet. */
import type { Exercise } from '../plan/types';
import { MUSCLES } from '../figure/figure';
import { DiagramPair } from './Diagram';
import { Pill } from './ui';
import { DayTags, useCycleSwapDays } from './DayTags';
import { SAFETY, SLOT_LABEL } from '../plan/content';

export function ExerciseInfo({ ex }: { ex: Exercise }) {
  const swapDays = useCycleSwapDays();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <DayTags id={ex.id} inPlan={ex.inPlan} swappedIn={swapDays[ex.id]} />
        {ex.slots.map((s) => <Pill key={s}>{SLOT_LABEL[s]}</Pill>)}
        {ex.main && <Pill tone="info">Main lift</Pill>}
        {ex.caution && <Pill tone="warn">{ex.caution}</Pill>}
      </div>
      <DiagramPair ex={ex} />
      {ex.muscles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="text-muted">Target:</span>
          {ex.muscles.map((m) => <span key={m} className="rounded-full bg-card2 px-2 py-0.5 text-xs">{MUSCLES[m]?.label ?? m}</span>)}
        </div>
      )}
      <Block title="Why it's in your plan"><p>{ex.why}</p></Block>
      {ex.jump && <Block title="Jump rules"><p>{SAFETY.jumpRules}</p></Block>}
      <Block title="Setup"><p>{ex.setup}</p></Block>
      <Block title="How to do it">
        <ol className="list-decimal space-y-1 pl-5">{ex.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </Block>
      <Block title="Key cues">
        <div className="flex flex-wrap gap-1.5">{ex.cues.map((c) => <span key={c} className="rounded-full bg-accent/15 px-3 py-1 text-sm text-accent">{c}</span>)}</div>
      </Block>
      <Block title="Common mistakes">
        <ul className="list-disc space-y-1 pl-5">{ex.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
      </Block>
      {ex.injuryNote && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 p-3 text-sm">
          <div className="mb-1 font-semibold text-warn">Injury note</div>
          <p className="text-ink/90">{ex.injuryNote}</p>
        </div>
      )}
      {(ex.easier || ex.harder) && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {ex.easier && <div className="rounded-xl bg-card2 p-3"><div className="mb-1 text-xs font-semibold text-muted">EASIER</div>{ex.easier}</div>}
          {ex.harder && <div className="rounded-xl bg-card2 p-3"><div className="mb-1 text-xs font-semibold text-muted">HARDER</div>{ex.harder}</div>}
        </div>
      )}
      <a
        className="flex min-h-11 items-center justify-center rounded-xl bg-card2 text-sm font-medium text-ink active:bg-line"
        href={`https://www.youtube.com/results?search_query=${encodeURIComponent((ex.search ?? ex.name) + ' exercise')}`}
        target="_blank"
        rel="noreferrer"
      >
        ▶ Watch a demo (YouTube search)
      </a>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="text-[15px] leading-relaxed">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}
