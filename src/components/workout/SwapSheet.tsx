import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Pill, Sheet } from '../ui';
import { Thumb } from '../Diagram';
import { ALL_EXERCISES, EXERCISES } from '../../plan/exercises';
import { SLOT_LABEL } from '../../plan/content';
import type { PlanItem } from '../../plan/days';
import { db, uid, type CycleSwap, type Session } from '../../lib/db';
import { patch, save } from '../../lib/store';
import { swapCount } from '../../lib/workout';
import { toast } from '../ui';

export function SwapSheet({
  open,
  onClose,
  item,
  session,
  currentId,
  plannedId,
  slotKey,
}: {
  open: boolean;
  onClose: () => void;
  item: PlanItem;
  session: Session;
  currentId: string;
  plannedId: string;
  slotKey: string;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const count = useLiveQuery(() => swapCount(session.cycle), [session.cycle, open]) ?? 0;
  const options = ALL_EXERCISES.filter((e) => e.slots.includes(item.slot) && e.id !== currentId && e.id !== plannedId);

  const clearCycle = async () => {
    const cur = await db.swaps.where('slotKey').equals(slotKey).filter((s) => !s.deleted && s.cycle === session.cycle && s.from === plannedId).toArray();
    for (const c of cur) await save<CycleSwap>('swaps', { ...c, deleted: true });
  };
  const apply = async (to: string, scope: 'today' | 'cycle') => {
    const swaps = { ...(session.swaps ?? {}) };
    if (scope === 'today') {
      swaps[item.key] = to;
    } else {
      delete swaps[item.key];
      await clearCycle();
      await save<CycleSwap>('swaps', { id: uid(), cycle: session.cycle, slotKey, from: plannedId, to });
    }
    await patch<Session>('sessions', session.id, { swaps });
    toast(`Swapped to ${EXERCISES[to]?.name}${scope === 'cycle' ? ' for the rest of this cycle' : ' for today'}`);
    setPick(null);
    onClose();
  };
  const backToPlan = async () => {
    const swaps = { ...(session.swaps ?? {}) };
    delete swaps[item.key];
    await clearCycle();
    await patch<Session>('sessions', session.id, { swaps });
    toast(`Back to ${EXERCISES[plannedId]?.name}`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Swap · ${SLOT_LABEL[item.slot]}`}>
      <div className="space-y-2">
        <p className="text-sm text-muted">The swap keeps today's sets, reps and rest. Your history stays with each exercise, so switching back later shows your old numbers.</p>
        {count >= 2 && (
          <div className="rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
            You've swapped {count} exercise{count === 1 ? '' : 's'} this cycle. More than 2 makes progress hard to track.
          </div>
        )}
        {currentId !== plannedId && (
          <Button className="w-full" onClick={backToPlan}>↩ Back to the plan: {EXERCISES[plannedId]?.name}</Button>
        )}
        {options.map((e) => (
          <div key={e.id} className="rounded-2xl bg-card">
            <button type="button" className="flex w-full items-center gap-3 p-3 text-left active:bg-card2" onClick={() => setPick(pick === e.id ? null : e.id)}>
              <Thumb ex={e} size={64} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{e.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {e.inPlan && <Pill tone="accent">In my plan</Pill>}
                  {e.caution && <Pill tone="warn">{e.caution}</Pill>}
                </div>
              </div>
            </button>
            {pick === e.id && (
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <Button kind="primary" onClick={() => apply(e.id, 'today')}>Just today</Button>
                <Button onClick={() => apply(e.id, 'cycle')}>Rest of this cycle</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
