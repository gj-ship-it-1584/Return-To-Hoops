/* One exercise in a session: prescription, last time, set rows, swap, rest timer. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Thumb } from '../Diagram';
import { Pill, Scale, NumInput } from '../ui';
import { SwapSheet } from './SwapSheet';
import { IntervalTimer } from './IntervalTimer';
import { DunkLogger } from './Extras';
import { startRest } from './RestTimer';
import { EXERCISES } from '../../plan/exercises';
import type { DayId, PlanItem, Rx } from '../../plan/days';
import type { LogField } from '../../plan/types';
import { db, uid, type CycleSwap, type Session, type SetLog, type Settings } from '../../lib/db';
import { patch, save } from '../../lib/store';
import { halveJumps, lastSets, resolveExercise, rxText, slotKeyOf } from '../../lib/workout';
import { deloadWeight, progressionHint } from '../../lib/progression';
import { fromDisplay, toDisplay, fmtFtIn } from '../../lib/units';
import { fmtShort } from '../../lib/dates';

const SPOTS = ['Left corner', 'Left wing', 'Top', 'Right wing', 'Right corner'];

type Vals = Partial<Record<LogField, number>>;

export function formatSet(s: Partial<SetLog>, fields: LogField[], units: Settings['units'], makesOf?: number): string {
  const p: string[] = [];
  for (const f of fields) {
    const v = s[f];
    if (v === undefined) continue;
    if (f === 'weight') p.push(`${toDisplay(v, units)}`);
    else if (f === 'reps') p.push(p.length ? `× ${v}` : `${v} reps`);
    else if (f === 'seconds') p.push(`${v} s`);
    else if (f === 'meters') p.push(`${v} m`);
    else if (f === 'boxIn') p.push(`${v}″ box`);
    else if (f === 'distanceIn') p.push(fmtFtIn(v));
    else if (f === 'touchIn') p.push(`${v}″ touch`);
    else if (f === 'rounds') p.push(`${v} rounds`);
    else if (f === 'makes') p.push(makesOf ? `${v}/${makesOf}` : `${v} makes`);
    else if (f === 'minutes') p.push(`${v} min`);
  }
  return p.join(' ');
}

export function ExerciseCard({
  day,
  item,
  week,
  session,
  cycleSwaps,
  sets,
  settings,
  halved,
  onInfo,
}: {
  day: DayId;
  item: PlanItem;
  week: number;
  session: Session;
  cycleSwaps: CycleSwap[];
  sets: SetLog[];
  settings: Settings;
  halved: boolean;
  onInfo: (id: string) => void;
}) {
  const { id, planned, swapped } = resolveExercise(day, item, week, session, cycleSwaps);
  const ex = EXERCISES[id];
  const plannedEx = EXERCISES[planned];
  const slotKey = slotKeyOf(day, item);
  const [swapOpen, setSwapOpen] = useState(false);
  // stable ids for rows not yet in the database, so quick typing can't create duplicate sets
  const rowIds = useRef(new Map<string, string>());
  let rx = item.rx(week) as Rx;
  if (halved && ex?.jump) rx = halveJumps(rx);
  const last = useLiveQuery(() => lastSets(id, session.id), [id, session.id]);
  const mine = useMemo(() => sets.filter((s) => s.slotKey === slotKey && s.exerciseId === id).sort((a, b) => a.idx - b.idx), [sets, slotKey, id]);
  const scapReady = useLiveQuery(async () => {
    if (id !== 'scap-pushup') return false;
    const all = await db.sets.where('exerciseId').equals('scap-pushup').filter((s) => !s.deleted && s.done && s.sessionId !== session.id && (s.reps ?? 0) >= 12).toArray();
    const bySession = new Map<string, number>();
    for (const s of all) bySession.set(s.sessionId, (bySession.get(s.sessionId) ?? 0) + 1);
    return [...bySession.values()].filter((n) => n >= 2).length >= 2;
  }, [id, session.id]);

  if (!ex) {
    return <div className="rounded-2xl bg-card p-4 text-sm text-muted">Missing exercise “{id}” in the library.</div>;
  }

  const restSecs = plannedEx?.main ? settings.restMain : settings.restOther;
  const rows = Math.max(rx.sets, mine.length ? Math.max(...mine.map((s) => s.idx)) + 1 : 0);
  const doneCount = mine.filter((s) => s.done).length;
  const hint = last ? progressionHint(ex, rx, last.sets) : null;
  const deload = week === 13;
  const fields = ex.log;

  const draftFor = (idx: number): Vals => {
    // the set before this one today wins (you just changed the weight), then last session, then the prescription
    const prevToday = [...mine].reverse().find((s) => s.idx < idx);
    const src = prevToday ?? last?.sets[idx] ?? last?.sets[last.sets.length - 1];
    const v: Vals = {};
    for (const f of fields) {
      const fromLast = src?.[f];
      if (fromLast !== undefined) v[f] = f === 'weight' && deload && !prevToday ? deloadWeight(fromLast, ex.upperDb) : fromLast;
      else if (f === 'reps' && rx.reps !== undefined) v.reps = Array.isArray(rx.reps) ? rx.reps[1] : rx.reps;
      else if (f === 'seconds' && rx.seconds !== undefined) v.seconds = Array.isArray(rx.seconds) ? rx.seconds[1] : rx.seconds;
      else if (f === 'meters' && rx.meters) v.meters = rx.meters;
      else if (f === 'rounds' && rx.rounds) v.rounds = rx.rounds;
      else if (f === 'minutes' && rx.minutes) v.minutes = rx.minutes;
    }
    if (fields.includes('reps') && rx.reps !== undefined && src?.reps === undefined) v.reps = Array.isArray(rx.reps) ? rx.reps[1] : rx.reps;
    return v;
  };

  const write = async (idx: number, vals: Vals, done: boolean) => {
    const existing = mine.find((s) => s.idx === idx);
    const key = `${id}:${idx}`;
    if (!rowIds.current.has(key)) rowIds.current.set(key, existing?.id ?? uid());
    await save<SetLog>('sets', {
      ...(existing ?? {}),
      ...vals,
      id: existing?.id ?? rowIds.current.get(key)!,
      sessionId: session.id,
      date: session.date,
      exerciseId: id,
      slotKey,
      idx,
      done,
      swappedFrom: id !== planned ? planned : undefined,
    });
  };

  const special = id === 'dunk-attempt' ? 'dunk' : item.key === 'intervals' || id === 'bike-intervals' || id === 'rower-intervals' || id === 'jump-rope-intervals' ? 'intervals' : null;

  return (
    <div className="rounded-2xl bg-card p-3">
      <div className="flex gap-3">
        <button type="button" onClick={() => onInfo(id)} aria-label={`About ${ex.name}`}>
          <Thumb ex={ex} size={72} />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" className="text-left text-[17px] leading-tight font-semibold" onClick={() => onInfo(id)}>
            {ex.name}
          </button>
          <div className="mt-0.5 text-sm text-accent">{rxText(rx)}{rx.note ? <span className="text-muted"> · {rx.note}</span> : null}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {swapped && <Pill tone="info">swapped{swapped === 'cycle' ? ' · cycle' : ''}</Pill>}
            {ex.caution && <Pill tone="warn">{ex.caution}</Pill>}
            {doneCount > 0 && <Pill tone={doneCount >= rx.sets ? 'good' : 'muted'}>{doneCount}/{rx.sets} done</Pill>}
          </div>
        </div>
        <button type="button" onClick={() => setSwapOpen(true)} className="min-h-11 self-start rounded-xl bg-card2 px-3 text-sm text-muted active:bg-line">
          Swap
        </button>
      </div>

      {item.note && <p className="mt-2 text-xs text-faint">{item.note}</p>}
      {ex.jump && <p className="mt-2 text-xs text-faint">Max effort every rep, full rest. End the set if height drops.</p>}

      {last && last.sets.length > 0 && (
        <div className="mt-2 rounded-lg bg-card2 px-3 py-2 text-sm">
          <span className="text-muted">Last time ({fmtShort(last.date)}): </span>
          <span className="tnum">{last.sets.map((s) => formatSet(s, fields, settings.units, rx.makes)).join(', ')}</span>
        </div>
      )}
      {hint && <div className="mt-2 rounded-lg bg-good/10 px-3 py-2 text-sm font-semibold text-good">↑ {hint}</div>}
      {scapReady && (
        <div className="mt-2 rounded-lg bg-good/10 px-3 py-2 text-sm text-good">
          2 × 12 for two sessions — ready for push-up plus? Tap Swap and pick it.
        </div>
      )}

      {special === 'dunk' ? (
        <div className="mt-3"><DunkLogger session={session} max={rx.reps as number} /></div>
      ) : special === 'intervals' ? (
        <div className="mt-3 space-y-2">
          <IntervalTimer
            rounds={rx.rounds ?? 10}
            sound={settings.sound}
            vibrate={settings.vibrate}
            onDone={(n) => void write(0, { rounds: n }, true)}
          />
          <SetRow idx={0} label="Rounds" fields={['rounds']} existing={mine.find((s) => s.idx === 0)} draft={{ rounds: rx.rounds }} units={settings.units} onChange={(v) => write(0, v, mine.find((s) => s.idx === 0)?.done ?? false)} onTick={(v, d) => write(0, v, d)} />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {Array.from({ length: rows }, (_, idx) => (
            <SetRow
              key={idx}
              idx={idx}
              label={id === 'spot-shooting' ? SPOTS[idx] : undefined}
              fields={fields}
              existing={mine.find((s) => s.idx === idx)}
              draft={draftFor(idx)}
              units={settings.units}
              makesOf={rx.makes}
              onChange={(v) => write(idx, v, mine.find((s) => s.idx === idx)?.done ?? false)}
              onTick={(v, d) => {
                void write(idx, v, d);
                if (d) startRest(restSecs, ex.name);
              }}
            />
          ))}
          <button
            type="button"
            className="min-h-11 w-full rounded-xl text-sm text-muted active:bg-card2"
            onClick={() => void write(rows, draftFor(rows), false)}
          >
            + Add set
          </button>
        </div>
      )}

      {id === 'wall-slide-liftoff' && (
        <div className="mt-3">
          <div className="mb-1 text-sm text-muted">Overhead restriction during the wall slides (0 = free, 10 = very tight)</div>
          <Scale value={session.overhead} onChange={(n) => void patch<Session>('sessions', session.id, { overhead: n })} danger={10} />
        </div>
      )}

      {swapOpen && (
        <SwapSheet open={swapOpen} onClose={() => setSwapOpen(false)} item={item} session={session} currentId={id} plannedId={planned} slotKey={slotKey} />
      )}
    </div>
  );
}

function SetRow({
  idx,
  label,
  fields,
  existing,
  draft,
  units,
  makesOf,
  onChange,
  onTick,
}: {
  idx: number;
  label?: string;
  fields: LogField[];
  existing?: SetLog;
  draft: Vals;
  units: Settings['units'];
  makesOf?: number;
  onChange: (v: Vals) => void;
  onTick: (v: Vals, done: boolean) => void;
}) {
  const initial = (): Vals => {
    const v: Vals = {};
    for (const f of fields) v[f] = existing?.[f] ?? draft[f];
    return v;
  };
  const [vals, setVals] = useState<Vals>(initial);
  const existingKey = existing ? `${existing.id}:${existing.u}` : 'none';
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    setVals(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingKey, existing ? '' : draftKey]);
  const done = !!existing?.done;
  const shown = fields.length ? fields : [];
  const update = (f: LogField, v: number | undefined) => {
    const stored = f === 'weight' ? fromDisplay(v, units) : v;
    const next = { ...vals, [f]: stored };
    setVals(next);
    onChange(next);
  };
  const suffix = (f: LogField) =>
    ({ weight: units, reps: 'reps', seconds: 's', meters: 'm', boxIn: 'in box', distanceIn: 'in', touchIn: 'in', rounds: 'rds', makes: makesOf ? `/ ${makesOf}` : 'made', minutes: 'min' })[f];
  return (
    <div className={`flex items-center gap-2 ${done ? 'opacity-70' : ''}`}>
      <div className={`tnum w-6 shrink-0 text-center text-sm ${done ? 'text-good' : 'text-faint'}`}>{label ? '' : idx + 1}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {label && <div className="text-xs text-muted">{label}</div>}
        <div className="flex min-w-0 gap-2">
          {shown.map((f) => (
            <NumInput
              key={f}
              className="min-w-0 flex-1"
              value={f === 'weight' ? toDisplay(vals[f], units) : vals[f]}
              decimal={f === 'weight' || f === 'boxIn' || f === 'distanceIn' || f === 'touchIn'}
              suffix={suffix(f)}
              placeholder={f === 'weight' ? '0' : '—'}
              onChange={(v) => update(f, v)}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        aria-label={done ? 'Mark set not done' : 'Complete set'}
        onClick={() => onTick(vals, !done)}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${done ? 'bg-good text-bg' : 'bg-card2 text-faint active:bg-line'}`}
      >
        ✓
      </button>
    </div>
  );
}
