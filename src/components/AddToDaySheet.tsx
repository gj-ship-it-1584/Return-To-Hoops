/* "Add to this day": one searchable list of workouts, activities and single exercises.
   Step 2 asks for the details (minutes for an activity, sets × reps for an exercise). */
import { useMemo, useState } from 'react';
import { Button, Field, NumInput, Segmented, Sheet } from './ui';
import { ExerciseOption } from './ExerciseOption';
import { Thumb } from './Diagram';
import { ALL_EXERCISES, EXERCISES } from '../plan/exercises';
import { SLOTS } from '../plan/content';
import { MUSCLES } from '../figure/figure';
import { DAYS } from '../plan/days';
import { ACTIVITIES, type Effort } from '../lib/activities';
import { defaultMove, targetField } from '../lib/added';
import type { AddedMove, SessionType } from '../lib/db';

export type DayAddition =
  | { kind: 'workout'; type: SessionType }
  | { kind: 'activity'; type: string; minutes: number; effort: Effort; label?: string; note?: string }
  | { kind: 'exercise'; move: AddedMove; target: string };

const WORKOUTS: { type: SessionType; label: string; sub: string }[] = [
  { type: 'A', label: DAYS.A.title, sub: DAYS.A.subtitle },
  { type: 'B', label: DAYS.B.title, sub: DAYS.B.subtitle },
  { type: 'C', label: DAYS.C.title, sub: DAYS.C.subtitle },
  { type: 'D', label: DAYS.D.title, sub: DAYS.D.subtitle },
  { type: 'mobility', label: 'Mobility + walk', sub: 'Desk reset and the hip flexor routine' },
];

const UNIT: Record<ReturnType<typeof targetField>, string> = { reps: 'reps', seconds: 'seconds', meters: 'meters', makes: 'makes', rounds: 'rounds', minutes: 'minutes' };

export function AddToDaySheet({
  open,
  onClose,
  onAdd,
  mode,
  targets,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (a: DayAddition) => void | Promise<void>;
  /** 'log' for today and past days (activities are recorded), 'plan' for future days */
  mode: 'log' | 'plan';
  /** where a single exercise can go: the day's workouts, plus "a separate workout" */
  targets: { value: string; label: string }[];
}) {
  const [q, setQ] = useState('');
  const [act, setAct] = useState<{ type: string; minutes?: number; effort: Effort; label?: string; note?: string } | null>(null);
  const [move, setMove] = useState<AddedMove | null>(null);
  const [target, setTarget] = useState(targets[0]?.value ?? 'custom');
  const needle = q.trim().toLowerCase();
  const has = (s: string) => !needle || s.toLowerCase().includes(needle);

  const workouts = WORKOUTS.filter((w) => has(w.label) || has(w.sub));
  const activities = ACTIVITIES.filter((a) => has(a.label) || has(a.hint));
  const groups = useMemo(
    () =>
      SLOTS.map((s) => ({
        ...s,
        list: ALL_EXERCISES.filter((e) => e.slots[0] === s.id && (!needle || e.name.toLowerCase().includes(needle) || s.label.toLowerCase().includes(needle) || e.muscles.some((m) => MUSCLES[m]?.label.toLowerCase().includes(needle)))),
      })).filter((g) => g.list.length),
    [needle],
  );

  const close = () => {
    setQ('');
    setAct(null);
    setMove(null);
    onClose();
  };
  const done = async (a: DayAddition) => {
    await onAdd(a);
    close();
  };

  /* step 2: activity details */
  if (act) {
    const def = ACTIVITIES.find((a) => a.id === act.type)!;
    return (
      <Sheet open={open} onClose={close} title={def.label}>
        <div className="space-y-4">
          {act.type === 'other' && (
            <Field label="What was it?">
              <input className="min-h-11 w-full rounded-xl border border-line bg-card2/70 px-3" value={act.label ?? ''} placeholder="Soccer, climbing, kayaking…" onChange={(e) => setAct({ ...act, label: e.target.value })} />
            </Field>
          )}
          <Field label="Minutes">
            <div className="flex gap-2">
              {[20, 30, 45, 60, 90].map((m) => (
                <button key={m} type="button" onClick={() => setAct({ ...act, minutes: m })} className={`min-h-11 flex-1 rounded-full text-sm ${act.minutes === m ? 'bg-card2 text-accent ring-1 ring-accent/45' : 'hairline text-muted'}`}>{m}</button>
              ))}
            </div>
            <NumInput className="mt-2" value={act.minutes} decimal={false} placeholder="Other" suffix="min" onChange={(v) => setAct({ ...act, minutes: v })} />
          </Field>
          <Field label="Intensity">
            <Segmented options={[{ value: 'easy', label: 'Easy' }, { value: 'moderate', label: 'Moderate' }, { value: 'hard', label: 'Hard' }]} value={act.effort} onChange={(effort) => setAct({ ...act, effort })} />
          </Field>
          {mode === 'log' && (
            <Field label="Note (optional)">
              <input className="min-h-11 w-full rounded-xl border border-line bg-card2/70 px-3" value={act.note ?? ''} onChange={(e) => setAct({ ...act, note: e.target.value })} placeholder={act.type === 'basketball' ? 'Full court, 4 games, felt springy' : ''} />
            </Field>
          )}
          <Button
            kind="primary"
            big
            className="w-full"
            onClick={() => act.minutes && done({ kind: 'activity', type: act.type, minutes: act.minutes, effort: act.effort, label: act.label || undefined, note: act.note || undefined })}
            disabled={!act.minutes}
          >
            {mode === 'log' ? `Log ${act.minutes ?? ''} min` : `Plan ${act.minutes ?? ''} min`}
          </Button>
          <Button kind="ghost" className="w-full" onClick={() => setAct(null)}>‹ Back</Button>
        </div>
      </Sheet>
    );
  }

  /* step 2: exercise details */
  if (move) {
    const ex = EXERCISES[move.exercise];
    const f = targetField(move);
    return (
      <Sheet open={open} onClose={close} title={ex?.name ?? 'Add'}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {ex && <Thumb ex={ex} size={72} />}
            <p className="text-sm text-muted">{ex?.why}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sets"><NumInput value={move.sets} decimal={false} onChange={(v) => setMove({ ...move, sets: Math.max(1, Math.min(10, v ?? 1)) })} /></Field>
            <Field label={`Target ${UNIT[f]}`}><NumInput value={move[f]} decimal={false} onChange={(v) => setMove({ ...move, [f]: v })} /></Field>
          </div>
          {targets.length > 1 && (
            <Field label="Add it to">
              <Segmented options={targets} value={target} onChange={setTarget} />
            </Field>
          )}
          <Button kind="primary" big className="w-full" onClick={() => done({ kind: 'exercise', move, target })}>
            Add {move.sets} × {move[f] ?? ''} {f === 'reps' ? '' : UNIT[f]}
          </Button>
          <Button kind="ghost" className="w-full" onClick={() => setMove(null)}>‹ Back</Button>
        </div>
      </Sheet>
    );
  }

  /* step 1: search and pick */
  const sec = 'mb-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted';
  return (
    <Sheet open={open} onClose={close} title="Add to this day">
      <div className="sticky top-12 z-10 -mx-4 bg-bg px-4 pb-3">
        <div className="hairline flex min-h-11 items-center gap-2 rounded-full bg-card px-4">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" strokeLinecap="round" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: basketball, curl, glutes, Day B…" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
          {q && <button type="button" onClick={() => setQ('')} className="text-muted" aria-label="Clear search">×</button>}
        </div>
      </div>
      <div className="space-y-5">
        {activities.length > 0 && (
          <section>
            <h3 className={sec}>Activities</h3>
            <div className="flex flex-wrap gap-2">
              {activities.map((a) => (
                <button key={a.id} type="button" onClick={() => setAct({ type: a.id, effort: 'moderate', minutes: a.id === 'basketball' ? 60 : 30 })} className="hairline min-h-11 rounded-full bg-card px-4 text-[14px] active:bg-card2">
                  {a.label}
                </button>
              ))}
            </div>
          </section>
        )}
        {workouts.length > 0 && (
          <section>
            <h3 className={sec}>Workouts</h3>
            <div className="divide-y divide-line overflow-hidden hairline rounded-[20px] bg-card">
              {workouts.map((w) => (
                <button key={w.type} type="button" onClick={() => done({ kind: 'workout', type: w.type })} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-card2">
                  <span className="flex-1"><span className="block text-[15px]">{w.label}</span><span className="block text-xs text-muted">{w.sub}</span></span>
                  <span className="text-lg text-accent">+</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {groups.map((g) => (
          <section key={g.id}>
            <h3 className={sec}>{g.label}</h3>
            <div className="divide-y divide-line overflow-hidden hairline rounded-[20px] bg-card">
              {g.list.map((e) => (
                <ExerciseOption key={e.id} ex={e} variant="row" onSelect={() => { setTarget(targets[0]?.value ?? 'custom'); setMove(defaultMove(e.id)); }} trailing={<span className="text-lg text-accent">+</span>} />
              ))}
            </div>
          </section>
        ))}
        {!activities.length && !workouts.length && !groups.length && <p className="px-1 text-sm text-muted">Nothing matches “{q}”. Try “Other activity” to name it yourself.</p>}
      </div>
    </Sheet>
  );
}
