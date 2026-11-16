/* Pick any exercise from the library, set sets × reps (or seconds / meters…), and add it. */
import { useMemo, useState } from 'react';
import { Button, Field, NumInput, Sheet } from './ui';
import { ExerciseOption } from './ExerciseOption';
import { Thumb } from './Diagram';
import { ALL_EXERCISES, EXERCISES } from '../plan/exercises';
import { SLOTS } from '../plan/content';
import { MUSCLES } from '../figure/figure';
import { defaultMove, targetField } from '../lib/added';
import type { AddedMove } from '../lib/db';

const UNIT: Record<ReturnType<typeof targetField>, string> = { reps: 'reps', seconds: 'seconds', meters: 'meters', makes: 'makes', rounds: 'rounds', minutes: 'minutes' };

export function AddExerciseSheet({ open, onClose, onAdd, title = 'Add an exercise' }: { open: boolean; onClose: () => void; onAdd: (m: AddedMove) => void | Promise<void>; title?: string }) {
  const [q, setQ] = useState('');
  const [move, setMove] = useState<AddedMove | null>(null);
  const needle = q.trim().toLowerCase();
  const groups = useMemo(
    () =>
      SLOTS.map((s) => ({
        ...s,
        list: ALL_EXERCISES.filter(
          (e) => e.slots[0] === s.id && (!needle || e.name.toLowerCase().includes(needle) || e.muscles.some((m) => MUSCLES[m]?.label.toLowerCase().includes(needle))),
        ),
      })).filter((g) => g.list.length),
    [needle],
  );
  const close = () => {
    setMove(null);
    setQ('');
    onClose();
  };

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
            <Field label="Sets">
              <NumInput value={move.sets} decimal={false} onChange={(v) => setMove({ ...move, sets: Math.max(1, Math.min(10, v ?? 1)) })} />
            </Field>
            <Field label={`Target ${UNIT[f]}`}>
              <NumInput value={move[f]} decimal={false} onChange={(v) => setMove({ ...move, [f]: v })} />
            </Field>
          </div>
          <Button kind="primary" big className="w-full" onClick={async () => { await onAdd(move); close(); }}>
            Add {move.sets} × {move[f] ?? ''} {f === 'reps' ? '' : UNIT[f]}
          </Button>
          <Button kind="ghost" className="w-full" onClick={() => setMove(null)}>‹ Pick a different exercise</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search: curl, lateral raise, glutes…"
        className="hairline mb-3 min-h-11 w-full rounded-full bg-card px-4 text-[15px] outline-none"
      />
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.id}>
            <h3 className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{g.label}</h3>
            <div className="divide-y divide-line overflow-hidden hairline rounded-[20px] bg-card">
              {g.list.map((e) => (
                <ExerciseOption key={e.id} ex={e} variant="row" onSelect={() => setMove(defaultMove(e.id))} trailing={<span className="text-lg text-accent">+</span>} />
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <p className="px-1 text-sm text-muted">No match. Try a muscle (biceps, glutes) or a move name.</p>}
      </div>
    </Sheet>
  );
}
