/* "Vertical + legs", "Lateral + conditioning · wk 4–5", "Warm-up" tags, plus moves swapped in for this cycle. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Pill } from './ui';
import { DAY_TAGS } from '../plan/usage';
import { DAYS, type DayId } from '../plan/days';
import { db } from '../lib/db';
import { programPosition } from '../lib/schedule';
import { useSettings, useToday } from '../lib/hooks';

/** exercise id → days it was swapped into for the current cycle */
export function useCycleSwapDays(): Record<string, string[]> {
  const settings = useSettings();
  const today = useToday();
  const cycle = programPosition(settings.startDate, today).cycle;
  return (
    useLiveQuery(async () => {
      const out: Record<string, string[]> = {};
      for (const s of await db.swaps.where('cycle').equals(cycle).filter((x) => !x.deleted).toArray()) {
        const day = s.slotKey.split(':')[0];
        (out[s.to] ??= []).includes(day) || out[s.to].push(day);
      }
      return out;
    }, [cycle]) ?? {}
  );
}

export function DayTags({ id, inPlan, swappedIn = [], showSwapOption = true }: { id: string; inPlan: boolean; swappedIn?: string[]; showSwapOption?: boolean }) {
  const tags = DAY_TAGS[id] ?? [];
  return (
    <>
      {tags.map((t) => (
        <Pill key={t.key} tone={t.key.length === 1 ? 'accent' : 'muted'}>{t.label}</Pill>
      ))}
      {swappedIn.map((d) => (
        <Pill key={'s' + d} tone="info">{d in DAYS ? DAYS[d as DayId].title : d} · swapped in</Pill>
      ))}
      {!tags.length && !swappedIn.length && (inPlan ? <Pill tone="accent">In my plan</Pill> : showSwapOption ? <Pill>Swap option</Pill> : null)}
    </>
  );
}
