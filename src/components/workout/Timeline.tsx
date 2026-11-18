/* The Timeline workout UI: the session is a gold thread. Finished moves collapse to one line,
   the current move opens with big serif numbers and ± steppers, and the prehab circuit is a
   compact checklist. Tap any line to jump to it (finished ones too, to check or fix a set). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Thumb } from '../Diagram';
import { Pill, Scale } from '../ui';
import { SwapSheet } from './SwapSheet';
import { IntervalTimer } from './IntervalTimer';
import { DunkLogger } from './Extras';
import { startRest } from './RestTimer';
import { SetTimer } from './SetTimer';
import { formatSet } from './ExerciseCard';
import { EXERCISES } from '../../plan/exercises';
import type { PlanItem, Rx } from '../../plan/days';
import type { LogField } from '../../plan/types';
import { uid, type CycleSwap, type Session, type SetLog, type Settings } from '../../lib/db';
import { patch, remove, save } from '../../lib/store';
import { halveJumps, lastSets, resolveExercise, rxText, slotKeyOf } from '../../lib/workout';
import { deloadWeight, progressionHint } from '../../lib/progression';
import { fromDisplay, toDisplay } from '../../lib/units';
import { fmtShort } from '../../lib/dates';

/** runs that log how long they took, so they get a stopwatch rather than a countdown */
const FOR_TIME = new Set(['suicides', 'seventeens']);
const SPOTS = ['Left corner', 'Left wing', 'Top', 'Right wing', 'Right corner'];
type Vals = Partial<Record<LogField, number>>;

export interface NodeProps {
  day: string;
  item: PlanItem;
  week: number;
  session: Session;
  cycleSwaps: CycleSwap[];
  sets: SetLog[];
  settings: Settings;
  halved: boolean;
  review: boolean;
  onInfo: (id: string) => void;
  onRemove?: () => void;
}

/** Everything one exercise needs: what it is today, what was logged, last time, and how to write a set. */
export function useExercise(p: NodeProps) {
  const { id, planned, swapped } = resolveExercise(p.day, p.item, p.week, p.session, p.cycleSwaps);
  const ex = EXERCISES[id];
  const plannedEx = EXERCISES[planned];
  const slotKey = slotKeyOf(p.day, p.item);
  let rx = p.item.rx(p.week) as Rx;
  if (p.halved && ex?.jump) rx = halveJumps(rx);
  const last = useLiveQuery(() => lastSets(id, p.session.id, p.session.date), [id, p.session.id, p.session.date]);
  const mine = useMemo(() => p.sets.filter((s) => s.slotKey === slotKey && s.exerciseId === id).sort((a, b) => a.idx - b.idx), [p.sets, slotKey, id]);
  const rowIds = useRef(new Map<number, string>());
  const fields: LogField[] = ex?.log ?? [];
  const deload = p.week === 13;
  const total = Math.max(rx.sets, mine.length ? Math.max(...mine.map((s) => s.idx)) + 1 : 0);
  const doneCount = mine.filter((s) => s.done).length;
  const complete = doneCount >= rx.sets;
  const restSecs = plannedEx?.main ? p.settings.restMain : p.settings.restOther;

  const draftFor = (idx: number): Vals => {
    const prevToday = [...mine].reverse().find((s) => s.idx < idx);
    const src = prevToday ?? last?.sets[idx] ?? last?.sets[last.sets.length - 1];
    const v: Vals = {};
    for (const f of fields) {
      const from = src?.[f];
      if (from !== undefined) v[f] = f === 'weight' && deload && !prevToday ? deloadWeight(from, ex?.upperDb) : from;
      else if (f === 'reps' && rx.reps !== undefined) v.reps = Array.isArray(rx.reps) ? rx.reps[1] : rx.reps;
      else if (f === 'seconds' && rx.seconds !== undefined) v.seconds = Array.isArray(rx.seconds) ? rx.seconds[1] : rx.seconds;
      else if (f === 'meters' && rx.meters) v.meters = rx.meters;
      else if (f === 'rounds' && rx.rounds) v.rounds = rx.rounds;
      else if (f === 'minutes' && rx.minutes) v.minutes = rx.minutes;
    }
    return v;
  };
  const valuesFor = (idx: number): Vals => {
    const s = mine.find((x) => x.idx === idx);
    const d = draftFor(idx);
    const v: Vals = {};
    for (const f of fields) v[f] = s?.[f] ?? d[f];
    return v;
  };
  const write = async (idx: number, vals: Vals, done: boolean) => {
    const existing = mine.find((s) => s.idx === idx);
    if (!rowIds.current.has(idx)) rowIds.current.set(idx, existing?.id ?? uid());
    await save<SetLog>('sets', {
      ...(existing ?? {}),
      ...vals,
      id: existing?.id ?? rowIds.current.get(idx)!,
      sessionId: p.session.id,
      date: p.session.date,
      exerciseId: id,
      slotKey,
      idx,
      done,
      swappedFrom: id !== planned ? planned : undefined,
    });
  };
  /** tick every prescribed set at the pre-filled values (prehab checklist) */
  const completeAll = async () => {
    for (let i = 0; i < rx.sets; i++) if (!mine.find((s) => s.idx === i)?.done) await write(i, valuesFor(i), true);
  };
  const uncompleteAll = async () => {
    for (const s of mine) if (s.done) await write(s.idx, {}, false);
  };
  const summary = (() => {
    const d = mine.filter((s) => s.done);
    if (!d.length) return rxText(rx);
    if (!complete) return `${d.length}/${rx.sets}`;
    const lastDone = d[d.length - 1];
    const f = formatSet(lastDone, fields, p.settings.units, rx.makes);
    return f ? `✓ ${f}` : `✓ ${rx.sets} sets`;
  })();
  return { id, planned, swapped, ex, rx, last, mine, fields, total, doneCount, complete, restSecs, draftFor, valuesFor, write, completeAll, uncompleteAll, summary, slotKey };
}

/* ---------------- thread pieces ---------------- */

export function Dot({ state }: { state: 'done' | 'current' | 'todo' }) {
  return (
    <span
      className={`absolute top-[18px] -left-[23px] rounded-full ${
        state === 'done' ? 'h-[13px] w-[13px] bg-accent' : state === 'current' ? 'h-[15px] w-[15px] -translate-x-px border-2 border-accent bg-bg' : 'h-[13px] w-[13px] border border-line bg-bg'
      }`}
    />
  );
}

/** A collapsed line on the thread. */
export function Line({ title, right, state, onClick, tag }: { title: ReactNode; right?: ReactNode; state: 'done' | 'current' | 'todo'; onClick: () => void; tag?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="relative flex min-h-12 w-full items-center gap-2 py-2 text-left active:opacity-70">
      <Dot state={state} />
      <span className={`min-w-0 flex-1 truncate text-[15px] ${state === 'done' ? 'text-faint' : 'text-ink/85'}`}>
        {title}
        {tag}
      </span>
      {right && <span className={`shrink-0 text-xs ${state === 'done' ? 'text-faint' : 'text-muted'}`}>{right}</span>}
    </button>
  );
}

/* ---------------- steppers ---------------- */

const STEP: Record<LogField, number> = { weight: 5, reps: 1, seconds: 5, meters: 5, boxIn: 1, distanceIn: 1, touchIn: 0.5, rounds: 1, makes: 1, minutes: 1 };
const UNIT: Record<LogField, string> = { weight: 'lb', reps: 'reps', seconds: 'sec', meters: 'm', boxIn: 'box in', distanceIn: 'in', touchIn: 'touch in', rounds: 'rounds', makes: 'made', minutes: 'min' };

function Stepper({ field, value, onChange, units, upperDb, makesOf }: { field: LogField; value: number | undefined; onChange: (v: number | undefined) => void; units: Settings['units']; upperDb?: boolean; makesOf?: number }) {
  const isW = field === 'weight';
  const step = isW ? (units === 'kg' ? (upperDb ? 1 : 2.5) : upperDb ? 2.5 : 5) : STEP[field];
  const shown = isW ? toDisplay(value, units) : value;
  const [draft, setDraft] = useState(shown === undefined ? '' : String(shown));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(shown === undefined ? '' : String(shown));
  }, [shown]);
  const set = (n: number | undefined) => onChange(isW ? fromDisplay(n, units) : n);
  const bump = (d: number) => set(Math.max(0, Math.round(((shown ?? 0) + d) * 10) / 10));
  const btn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-lg text-muted active:bg-card2 active:text-ink';
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-line px-2 py-2 text-center">
      <div className="text-[9.5px] font-medium uppercase tracking-[0.16em] text-muted">{isW ? units : field === 'makes' && makesOf ? `made of ${makesOf}` : UNIT[field]}</div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <button type="button" className={btn} aria-label={`Less ${field}`} onClick={() => bump(-step)}>−</button>
        <input
          className="tnum w-full min-w-0 bg-transparent text-center font-display text-[34px] leading-none outline-none placeholder:text-faint"
          inputMode="decimal"
          enterKeyHint="done"
          value={draft}
          placeholder="—"
          onFocus={(e) => {
            focused.current = true;
            e.target.select();
          }}
          onBlur={() => {
            focused.current = false;
            setDraft(shown === undefined ? '' : String(shown));
          }}
          onChange={(e) => {
            const t = e.target.value.replace(',', '.');
            setDraft(t);
            if (t === '') return set(undefined);
            const n = Number(t);
            if (!Number.isNaN(n)) set(n);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <button type="button" className={btn} aria-label={`More ${field}`} onClick={() => bump(step)}>+</button>
      </div>
    </div>
  );
}

/* ---------------- the open exercise ---------------- */

export function ExerciseNode(p: NodeProps & { open: boolean; onOpen: () => void; onComplete: () => void; compact?: boolean }) {
  const m = useExercise(p);
  const [swapOpen, setSwapOpen] = useState(false);
  const firstOpen = m.mine.find((s) => !s.done)?.idx ?? (m.complete ? m.total - 1 : m.doneCount);
  const [sel, setSel] = useState<number>(Math.min(firstOpen, Math.max(0, m.total - 1)));
  const [vals, setVals] = useState<Vals>({});
  const ref = useRef<HTMLDivElement>(null);
  const selKey = `${m.id}:${sel}:${m.mine.find((s) => s.idx === sel)?.u ?? 'n'}:${m.last?.date ?? ''}`;
  useEffect(() => {
    setVals(m.valuesFor(sel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);
  useEffect(() => {
    if (p.open) {
      setSel(Math.min(firstOpen, Math.max(0, m.total - 1)));
      // wait for the previous card to collapse before scrolling, or we land in the wrong place
      setTimeout(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);

  if (!m.ex) return <div className="py-2 text-sm text-muted">Missing exercise “{m.id}”.</div>;
  const ex = m.ex;
  const state = m.complete ? 'done' : p.open ? 'current' : 'todo';
  const tag = (
    <>
      {m.swapped && <span className="ml-1.5 text-[10px] text-info">swapped</span>}
      {p.item.section === 'added' && <span className="ml-1.5 text-[10px] text-accent">added</span>}
    </>
  );
  if (!p.open) return <div ref={ref} className="scroll-mt-28"><Line title={ex.name} tag={tag} right={m.summary} state={state} onClick={p.onOpen} /></div>;

  const special = m.id === 'dunk-attempt' ? 'dunk' : ['bike-intervals', 'rower-intervals', 'jump-rope-intervals'].includes(m.id) ? 'intervals' : null;
  const timed = m.fields.includes('seconds') ? 'seconds' : m.fields.includes('minutes') ? 'minutes' : null;
  const selDone = !!m.mine.find((s) => s.idx === sel)?.done;
  const hint = m.last && !p.review ? progressionHint(ex, m.rx, m.last.sets) : null;
  const persist = (v: Vals) => {
    setVals(v);
    void m.write(sel, v, selDone);
  };
  const doneSet = async (override?: Vals) => {
    const v = override ? { ...vals, ...override } : vals;
    if (override) setVals(v);
    await m.write(sel, v, true);
    if (!p.review) startRest(m.restSecs, ex.name);
    const next = Array.from({ length: m.total }, (_, i) => i).find((i) => i !== sel && !m.mine.find((s) => s.idx === i)?.done);
    if (next === undefined && m.doneCount + 1 >= m.rx.sets) p.onComplete();
    else if (next !== undefined) setSel(next);
  };

  return (
    <div ref={ref} className={`relative scroll-mt-28 ${p.compact ? 'p-1.5' : 'my-1.5 rounded-[20px] border border-accent/25 bg-card p-3.5'}`}>
      {!p.compact && <Dot state="current" />}
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => p.onInfo(m.id)} aria-label={`About ${ex.name}`} className="shrink-0"><Thumb ex={ex} size={56} /></button>
        <div className="min-w-0 flex-1">
          <button type="button" className="text-left font-display text-[24px] leading-[1.05]" onClick={() => p.onInfo(m.id)}>{ex.name}</button>
          <div className="mt-0.5 text-[11.5px] text-muted">
            {rxText(m.rx)}
            {m.rx.note ? ` · ${m.rx.note}` : ''}
          </div>
          {m.last && m.last.sets.length > 0 && <div className="mt-0.5 truncate text-[11.5px] text-faint">last {fmtShort(m.last.date)}: {m.last.sets.map((s) => formatSet(s, m.fields, p.settings.units, m.rx.makes)).join(', ')}</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button type="button" onClick={() => setSwapOpen(true)} className="min-h-9 rounded-full border border-line px-3 text-[12px] text-muted active:bg-card2">Swap</button>
          {p.onRemove && <button type="button" onClick={p.onRemove} className="min-h-8 px-2 text-[11px] text-faint active:text-bad">Remove</button>}
        </div>
      </div>
      {(m.swapped || p.item.section === 'added' || ex.caution) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.swapped && <Pill tone="info">swapped{m.swapped === 'cycle' ? ' for the cycle' : ''}</Pill>}
          {p.item.section === 'added' && <Pill tone="accent">added by you</Pill>}
          {ex.caution && <Pill tone="warn">{ex.caution}</Pill>}
        </div>
      )}
      {hint && <div className="mt-2.5 rounded-xl bg-good/10 px-3 py-1.5 text-[12px] text-good">↑ {hint}</div>}
      {ex.jump && <div className="mt-2 text-[11px] text-faint">Max effort every rep, full rest. End the set if height drops.</div>}

      {special === 'dunk' ? (
        <div className="mt-3"><DunkLogger session={p.session} max={m.rx.reps as number} /></div>
      ) : special === 'intervals' ? (
        <div className="mt-3 space-y-2">
          {!p.review && <IntervalTimer rounds={m.rx.rounds ?? 10} sound={p.settings.sound} vibrate={p.settings.vibrate} onDone={(n) => { void m.write(0, { rounds: n }, true); p.onComplete(); }} />}
          <div className="flex gap-2">
            <Stepper field="rounds" value={vals.rounds} onChange={(v) => persist({ ...vals, rounds: v })} units={p.settings.units} />
          </div>
          <button type="button" onClick={() => void doneSet()} className="min-h-12 w-full rounded-full bg-accent font-medium text-accent-ink active:brightness-90">{selDone ? 'Update rounds' : 'Log rounds'}</button>
        </div>
      ) : (
        <>
          {/* set tabs */}
          <div className="no-scrollbar -mx-1 mt-3 flex gap-1 overflow-x-auto px-1">
            {Array.from({ length: m.total }, (_, i) => {
              const s = m.mine.find((x) => x.idx === i);
              const label = p.item.exercise(p.week) === 'spot-shooting' || m.id === 'spot-shooting' ? SPOTS[i]?.split(' ').map((w) => w[0]).join('') : String(i + 1);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSel(i)}
                  className={`min-h-9 shrink-0 rounded-full px-3 text-[12px] tnum ${i === sel ? 'bg-card2 text-accent ring-1 ring-accent/50' : s?.done ? 'text-muted' : 'text-faint'}`}
                >
                  {s?.done ? `${label} · ${formatSet(s, m.fields, p.settings.units, m.rx.makes) || '✓'}` : label}
                </button>
              );
            })}
            <button type="button" onClick={() => setSel(m.total)} className="min-h-9 shrink-0 rounded-full px-3 text-[12px] text-faint">+ set</button>
          </div>
          {m.id === 'spot-shooting' && <div className="mt-1 text-[11px] text-muted">{SPOTS[sel] ?? `Spot ${sel + 1}`}</div>}
          {/* steppers */}
          {m.fields.length > 0 && (
            <div className="mt-2.5 flex gap-2">
              {m.fields.map((f) => (
                <Stepper key={f} field={f} value={vals[f]} onChange={(v) => persist({ ...vals, [f]: v })} units={p.settings.units} upperDb={ex.upperDb} makesOf={m.rx.makes} />
              ))}
            </div>
          )}
          {timed && !p.review && (
            <div className="mt-2.5">
              <SetTimer
                key={`${m.id}:${sel}`}
                seconds={timed === 'minutes' ? (vals.minutes ?? 0) * 60 : vals.seconds}
                perSide={!!m.rx.perSide}
                up={FOR_TIME.has(m.id)}
                sound={p.settings.sound}
                vibrate={p.settings.vibrate}
                onFinish={(ran) => void doneSet(ran !== undefined ? { seconds: ran } : undefined)}
              />
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void doneSet()} className="min-h-12 flex-1 rounded-full bg-accent text-[15px] font-medium text-accent-ink active:brightness-90">
              {selDone ? `Update set ${sel + 1}` : m.fields.length ? `Done · set ${sel + 1} of ${Math.max(m.rx.sets, sel + 1)}` : 'Done'}
            </button>
            {selDone && (
              <button type="button" onClick={() => void m.write(sel, vals, false)} className="min-h-12 rounded-full border border-line px-4 text-[13px] text-muted">Undo</button>
            )}
            {p.review && m.mine.find((s) => s.idx === sel) && (
              <button type="button" onClick={() => confirm('Delete this set?') && void remove('sets', m.mine.find((s) => s.idx === sel)!.id)} className="min-h-12 rounded-full border border-line px-4 text-[13px] text-muted">Delete</button>
            )}
          </div>
        </>
      )}

      {m.id === 'wall-slide-liftoff' && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] text-muted">Overhead restriction during the wall slides (0 = free, 10 = very tight)</div>
          <Scale value={p.session.overhead} onChange={(n) => void patch<Session>('sessions', p.session.id, { overhead: n })} danger={10} />
        </div>
      )}
      {swapOpen && <SwapSheet open={swapOpen} onClose={() => setSwapOpen(false)} item={p.item} session={p.session} currentId={m.id} plannedId={m.planned} slotKey={m.slotKey} />}
    </div>
  );
}

/* ---------------- prehab checklist ---------------- */

function PrehabRow(p: NodeProps & { expanded: boolean; onExpand: () => void }) {
  const m = useExercise(p);
  if (!m.ex) return null;
  return (
    <div className="flex min-h-12 items-center gap-2 px-3 py-1.5">
      <button type="button" onClick={p.onExpand} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-[14px] ${m.complete ? 'text-faint' : 'text-ink/90'}`}>{m.ex.name}</span>
        <span className="block truncate text-[11px] text-faint">{rxText(m.rx)}{m.rx.note ? ` · ${m.rx.note}` : ''}</span>
      </button>
      <button
        type="button"
        aria-label={m.complete ? `Mark ${m.ex.name} not done` : `Mark ${m.ex.name} done`}
        onClick={() => void (m.complete ? m.uncompleteAll() : m.completeAll())}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm ${m.complete ? 'bg-accent text-accent-ink' : 'border border-line text-faint active:border-accent active:text-accent'}`}
      >
        ✓
      </button>
    </div>
  );
}

export function PrehabGroup({ items, note, open, onOpen, base, doneCount }: { items: PlanItem[]; note: string; open: boolean; onOpen: () => void; base: Omit<NodeProps, 'item'>; doneCount: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const state = doneCount >= items.length ? 'done' : open ? 'current' : 'todo';
  if (!open) return <Line title="AC joint + upper back prehab" right={`${doneCount}/${items.length}`} state={state} onClick={onOpen} />;
  return (
    <div className="relative my-1.5">
      <Dot state={state === 'done' ? 'done' : 'current'} />
      <div className="flex items-baseline justify-between pt-3">
        <span className="font-display text-[21px]">AC joint prehab</span>
        <span className="text-[11px] text-muted">{doneCount} of {items.length}</span>
      </div>
      <div className="mb-2 text-[11px] text-warn">{note}</div>
      <div className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-card">
        {items.map((item) =>
          expanded === item.key ? (
            <div key={item.key} className="p-2">
              <ExerciseNode {...base} item={item} open compact onOpen={() => {}} onComplete={() => setExpanded(null)} />
              <button type="button" onClick={() => setExpanded(null)} className="min-h-9 w-full text-[12px] text-faint">Collapse</button>
            </div>
          ) : (
            <PrehabRow key={item.key} {...base} item={item} expanded={false} onExpand={() => setExpanded(item.key)} />
          ),
        )}
      </div>
      <div className="mt-1.5 px-1 text-[11px] text-faint">Tick a move to log every set at the dose shown. Tap its name to change weights or reps.</div>
    </div>
  );
}
