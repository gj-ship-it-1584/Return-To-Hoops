/* One date: what's planned (with this week's sets and reps), what was logged, and controls to
   change the workout, add one, or swap moves for this day only. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Pill, SectionTitle, Sheet, toast } from '../components/ui';
import { Thumb } from '../components/Diagram';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { back, go, useActiveSession, useSessions, useSettings, useToday } from '../lib/hooks';
import { db, uid, type CycleSwap, type PlannedDay, type Session, type SessionType } from '../lib/db';
import { save } from '../lib/store';
import { projectAgenda, type AgendaDay } from '../lib/schedule';
import { addExtra, addPlannedMove, movesFor, plannedSession, removeExtra, removePlannedMove, setDayType, setPlannedSwap, swapsFor } from '../lib/plans';
import { ADDED_PREFIX, toPlanItem } from '../lib/added';
import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { ExerciseOption } from '../components/ExerciseOption';
import { ReorderSheet } from '../components/ReorderSheet';
import { applyOrder, setPlannedOrder } from '../lib/plans';
import { saveSettings } from '../lib/store';
import { AddToDaySheet, type DayAddition } from '../components/AddToDaySheet';
import { TargetsCard } from '../components/TargetsCard';
import { ACTIVITY_LABEL, logActivity, sessionBadge, sessionLabel } from '../lib/activities';
import { addPlannedActivity, removePlannedActivity } from '../lib/plans';
import { patch } from '../lib/store';
import { createPastSession, dayItems, resolveExercise, rxText, slotKeyOf, startSession } from '../lib/workout';
import { DAYS, DESK_RESET, type DayId, type PlanItem } from '../plan/days';
import { ALL_EXERCISES, EXERCISES } from '../plan/exercises';
import { SLOT_LABEL } from '../plan/content';
import { fmtDate, fmtDuration } from '../lib/dates';
import { unlockAudio } from '../lib/alerts';

export const KIND_LABEL: Record<string, string> = {
  dayD: 'Court day',
  cardio: 'Easy cardio',
  rest: 'Rest day',
  mobility: 'Mobility + walk',
  bloodDraw: 'Mobility + walking (blood draw)',
  pickup: 'Pickup',
};

export function agendaTitle(a: AgendaDay) {
  return a.kind === 'lift' && a.lift ? DAYS[a.lift].title : KIND_LABEL[a.kind];
}
export function agendaSub(a: AgendaDay) {
  if (a.kind === 'lift' && a.lift) return DAYS[a.lift].subtitle;
  if (a.kind === 'dayD') return DAYS.D.subtitle;
  if (a.kind === 'cardio') return 'Incline walk, bike, rower or a dog walk';
  if (a.kind === 'rest' || a.kind === 'mobility') return '5-minute desk reset, then walk the dog';
  return 'No hard lifting, jumps or sprints';
}

const TYPE_OPTIONS: { value: PlannedDay['type']; label: string; sub: string }[] = [
  { value: 'A', label: DAYS.A.title, sub: DAYS.A.subtitle },
  { value: 'B', label: DAYS.B.title, sub: DAYS.B.subtitle },
  { value: 'C', label: DAYS.C.title, sub: DAYS.C.subtitle },
  { value: 'D', label: DAYS.D.title, sub: DAYS.D.subtitle },
  { value: 'mobility', label: 'Mobility + walk', sub: 'Desk reset and the hip flexor routine' },
  { value: 'cardio', label: 'Easy cardio', sub: 'Optional, talking pace' },
  { value: 'rest', label: 'Rest day', sub: 'Nothing planned' },
];

export default function DayView({ date }: { date: string }) {
  const settings = useSettings();
  const today = useToday();
  const sessions = useSessions();
  const active = useActiveSession();
  const plans = useLiveQuery(() => db.plans.filter((p) => !p.deleted).toArray(), []) ?? [];
  const plan = plans.find((p) => p.date === date);
  const from = date < today ? date : today;
  const agenda = projectAgenda(from, Math.max(1, Math.round((new Date(date + 'T12:00').getTime() - new Date(from + 'T12:00').getTime()) / 86400000) + 1), settings, sessions, plans);
  const a = agenda[agenda.length - 1];
  const cycleSwaps = useLiveQuery(() => db.swaps.where('cycle').equals(a.pos.cycle).filter((s) => !s.deleted).toArray(), [a.pos.cycle]) ?? [];
  const logged = sessions.filter((s) => s.date === date);
  const loggedCardio = useLiveQuery(() => db.cardio.where('date').equals(date).filter((c) => !c.deleted).toArray(), [date]) ?? [];
  const [sheet, setSheet] = useState<null | 'change' | 'add'>(null);
  const isPast = date < today;
  const isToday = date === today;
  const mainType: SessionType | null = a.kind === 'lift' && a.lift ? a.lift : a.kind === 'dayD' ? 'D' : a.kind === 'rest' || a.kind === 'mobility' || a.kind === 'bloodDraw' ? 'mobility' : null;

  const begin = async (type: SessionType) => {
    unlockAudio();
    if (active) return go('workout');
    await startSession(type, settings.startDate, date, swapsFor(plan, type), movesFor(plan, type), plan?.order?.[type]);
    go('workout');
  };
  /** where a single exercise can go on this day */
  const targets = [
    ...(mainType ? [{ value: mainType as string, label: sessionLabel(mainType) }] : []),
    ...a.extra.filter((t) => t !== 'custom' && t !== mainType).map((t) => ({ value: t, label: sessionLabel(t) })),
    { value: 'custom', label: 'Separate' },
  ];

  const handleAdd = async (x: DayAddition) => {
    if (x.kind === 'workout') {
      await addExtra(date, x.type);
      toast(`Added ${sessionLabel(x.type)}`);
    } else if (x.kind === 'activity') {
      const name = x.label ?? ACTIVITY_LABEL[x.type];
      if (date <= today) {
        await logActivity({ date, type: x.type, minutes: x.minutes, effort: x.effort, label: x.label, note: x.note, startDate: settings.startDate });
        toast(`Logged ${name} · ${x.minutes} min`);
      } else {
        await addPlannedActivity(date, { type: x.type, minutes: x.minutes, label: x.label });
        toast(`Planned ${name} · ${x.minutes} min`);
      }
    } else {
      const t = x.target as SessionType;
      const name = EXERCISES[x.move.exercise]?.name;
      const existing = logged.find((s) => s.type === t && (s.status === 'active' || isPast));
      if (existing) {
        await patch<Session>('sessions', existing.id, { added: [...(existing.added ?? []), x.move] });
        toast(`Added ${name} to ${sessionLabel(t)}`);
      } else if (isPast) {
        const s = await createPastSession(t, date, settings.startDate, 30);
        await save<Session>('sessions', { ...s, added: [...movesFor(plan, t), x.move] });
        go(`history/${s.id}`);
      } else {
        await addPlannedMove(date, t, x.move);
        if (t === 'custom' && !a.extra.includes('custom')) await addExtra(date, 'custom');
        toast(`Added ${name}`);
      }
    }
  };

  const logPast = async (type: SessionType) => {
    const s = await createPastSession(type, date, settings.startDate);
    await save<Session>('sessions', { ...s, swaps: swapsFor(plan, type), added: movesFor(plan, type), order: plan?.order?.[type] });
    go(`history/${s.id}`);
  };

  return (
    <div>
      <div className="flex items-start gap-2 pt-1">
        <button type="button" onClick={back} className="min-h-11 min-w-11 rounded-full text-2xl text-muted active:bg-card2" aria-label="Back">‹</button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {isToday ? 'Today' : isPast ? 'Past day' : 'Upcoming'} · week {a.pos.week} · {a.pos.phase.name}
          </div>
          <h1 className="font-display text-[32px] leading-tight">{fmtDate(date)}</h1>
        </div>
      </div>

      {(logged.length > 0 || loggedCardio.length > 0) && (
        <>
          <SectionTitle>Logged</SectionTitle>
          <div className="divide-y divide-line overflow-hidden hairline rounded-[20px] bg-card">
            {loggedCardio.map((c) => (
              <div key={c.id} className="flex min-h-14 w-full items-center gap-3 px-4">
                <span className="flex h-7 w-[58px] shrink-0 items-center justify-center rounded-full border border-line text-[9px] font-medium uppercase tracking-[0.08em] text-muted">Cardio</span>
                <span className="flex-1">
                  <span className="block text-[15px]">{c.label ?? ACTIVITY_LABEL[c.type] ?? c.type}</span>
                  <span className="block text-xs text-muted">{c.minutes} min{c.effort ? ` · ${c.effort}` : ''}{c.note ? ` · ${c.note}` : ''}</span>
                </span>
                <button type="button" className="min-h-10 px-2 text-xs text-muted" onClick={() => go('history')}>Edit</button>
              </div>
            ))}
            {logged.map((s) => (
              <button key={s.id} type="button" onClick={() => go(s.status === 'active' ? 'workout' : `history/${s.id}`)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-card2">
                <span className="flex h-7 w-[58px] shrink-0 items-center justify-center rounded-full border border-accent/50 text-[9px] font-medium uppercase tracking-[0.08em] text-accent">{sessionBadge(s.type)}</span>
                <span className="flex-1">
                  <span className="block text-[15px]">{sessionLabel(s.type)}</span>
                  <span className="block text-xs text-muted">{s.status === 'active' ? 'In progress' : s.type === 'pickup' ? `${s.pickup?.minutes ?? 0} min` : s.endedAt ? fmtDuration(s.endedAt - s.startedAt) : 'Done'}</span>
                </span>
                <span className="text-faint">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      <SectionTitle right={a.overridden ? <Pill tone="accent">Changed</Pill> : undefined}>Planned</SectionTitle>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[28px] leading-tight">{agendaTitle(a)}</span>
              {a.optional && <Pill>Optional</Pill>}
              {a.testDay && <Pill tone="info">Test day</Pill>}
            </div>
            <div className="text-sm text-muted">{agendaSub(a)}</div>
          </div>
          {a.kind !== 'bloodDraw' && <Button onClick={() => setSheet('change')}>Change</Button>}
        </div>
        {a.kind === 'lift' && a.lift && <PlannedList day={a.lift} week={a.pos.week} date={date} plan={plan} cycle={a.pos.cycle} cycleSwaps={cycleSwaps} />}
        {a.kind === 'dayD' && <PlannedList day="D" week={a.pos.week} date={date} plan={plan} cycle={a.pos.cycle} cycleSwaps={cycleSwaps} />}
        {(a.kind === 'rest' || a.kind === 'mobility' || a.kind === 'bloodDraw') && (
          <>
            <ul className="mt-3 space-y-1 text-sm text-muted">{DESK_RESET.map((r) => <li key={r.exercise}>{EXERCISES[r.exercise]?.name} · {r.dose}</li>)}</ul>
            <PlannedList day="mobility" week={a.pos.week} date={date} plan={plan} cycle={a.pos.cycle} cycleSwaps={cycleSwaps} />
          </>
        )}
        {mainType && (isToday ? (
          <Button kind="primary" big className="mt-4 w-full" onClick={() => begin(mainType)}>{active ? 'Resume workout' : 'Start workout'}</Button>
        ) : isPast && !logged.some((s) => s.type === mainType) ? (
          <Button className="mt-4 w-full" onClick={() => logPast(mainType)}>Log this workout</Button>
        ) : null)}
      </Card>

      {(plan?.activities ?? []).length > 0 && (
        <Card className="mt-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Planned activities</div>
          <div className="mt-1 divide-y divide-line">
            {plan!.activities!.map((act) => (
              <div key={act.key} className="flex items-center gap-3 py-2.5">
                <span className="flex-1">
                  <span className="block text-[15px]">{act.label ?? ACTIVITY_LABEL[act.type] ?? act.type}</span>
                  <span className="block text-xs text-muted">{act.minutes} min</span>
                </span>
                {date <= today && (
                  <Button kind="primary" onClick={async () => {
                    await logActivity({ date, type: act.type, minutes: act.minutes, label: act.label, startDate: settings.startDate });
                    await removePlannedActivity(date, act.key);
                    toast('Logged');
                  }}>Log it</Button>
                )}
                <button type="button" className="min-h-10 px-2 text-xs text-muted" onClick={() => void removePlannedActivity(date, act.key)}>Remove</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {a.extra.map((t, i) => (
        <Card key={i} className="mt-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Added</div>
              <div className="font-display text-[26px] leading-tight">{sessionLabel(t)}</div>
              <div className="text-sm text-muted">{t in DAYS ? DAYS[t as DayId].subtitle : t === 'custom' ? 'Your own exercises' : 'Desk reset and the hip flexor routine'}</div>
            </div>
            <Button kind="ghost" onClick={() => void removeExtra(date, i).then(() => toast('Removed'))}>Remove</Button>
          </div>
          <PlannedList day={t} week={a.pos.week} date={date} plan={plan} cycle={a.pos.cycle} cycleSwaps={cycleSwaps} />
          {isToday ? (
            <Button kind="primary" className="mt-4 w-full" onClick={() => begin(t as SessionType)}>Start this workout</Button>
          ) : isPast ? (
            <Button className="mt-4 w-full" onClick={() => logPast(t as SessionType)}>Log this workout</Button>
          ) : null}
        </Card>
      ))}

      <TargetsCard date={date} settings={settings} canLog={date <= today} showWeight={date <= today} />

      <Button kind="primary" className="mt-4 w-full" onClick={() => setSheet('add')}>+ Add to this day</Button>
      <p className="mt-2 px-2 text-center text-xs text-faint">An activity like basketball, a workout, or a single exercise. Search for anything.</p>
      <AddToDaySheet open={sheet === 'add'} onClose={() => setSheet(null)} onAdd={handleAdd} mode={date <= today ? 'log' : 'plan'} targets={targets} />

      <Sheet open={sheet === 'change'} onClose={() => setSheet(null)} title="Change this day">
        <div className="space-y-2">
          {TYPE_OPTIONS.map((o) => (
            <Card key={o.value} onClick={async () => { await setDayType(date, o.value); setSheet(null); toast(`${fmtDate(date)}: ${o.label}`); }}>
              <div className="flex items-center justify-between">
                <div><div className="text-[15px]">{o.label}</div><div className="text-xs text-muted">{o.sub}</div></div>
                {plan?.type === o.value && <span className="text-accent">✓</span>}
              </div>
            </Card>
          ))}
          {plan?.type && (
            <Button className="w-full" onClick={async () => { await setDayType(date, undefined); setSheet(null); toast('Back to the normal schedule'); }}>↩ Use the normal schedule</Button>
          )}
          <p className="px-1 pt-1 text-xs text-faint">Lifting days still run in order (legs → upper → lateral), so moving one shifts the ones after it.</p>
        </div>
      </Sheet>
    </div>
  );
}

/** The moves for a planned workout, with this week's prescription and a per-day swap. */
function PlannedList({ day, week, date, plan, cycle, cycleSwaps }: { day: string; week: number; date: string; plan?: PlannedDay; cycle: number; cycleSwaps: CycleSwap[] }) {
  const settings = useSettings();
  const all = [...(day in DAYS ? dayItems(day as DayId, week) : []), ...movesFor(plan, day).map(toPlanItem)];
  const movable = applyOrder(all.filter((i) => i.section !== 'prehab'), plan?.order?.[day] ?? settings.dayOrder?.[day]);
  const items = [...movable, ...all.filter((i) => i.section === 'prehab')];
  const [adding, setAdding] = useState(false);
  const [reorder, setReorder] = useState(false);
  const fake = plannedSession(plan, day, cycle);
  const [swap, setSwap] = useState<PlanItem | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  return (
    <div className={`mt-3 divide-y divide-line ${items.length ? 'border-t border-line' : ''}`}>
      {items.map((item) => {
        const r = resolveExercise(day, item, week, fake, cycleSwaps);
        const ex = EXERCISES[r.id];
        if (!ex) return null;
        return (
          <div key={item.key} className="flex items-center gap-3 py-2.5">
            <button type="button" onClick={() => setInfo(r.id)} aria-label={`About ${ex.name}`}><Thumb ex={ex} size={52} /></button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px]">{ex.name}</div>
              <div className="text-xs text-muted">
                {rxText(item.rx(week)!)}
                {r.swapped && <span className="text-info"> · swapped{r.swapped === 'cycle' ? ' for the cycle' : ' this day'}</span>}
                {item.section === 'added' && <span className="text-accent"> · added</span>}
              </div>
            </div>
            {item.section === 'added' ? (
              <button type="button" onClick={() => void removePlannedMove(date, day, item.key.slice(ADDED_PREFIX.length)).then(() => toast('Removed'))} className="min-h-10 rounded-full border border-line px-3 text-[13px] text-muted active:bg-card2">Remove</button>
            ) : (
              <button type="button" onClick={() => setSwap(item)} className="min-h-10 rounded-full border border-line px-3 text-[13px] text-muted active:bg-card2">Swap</button>
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setAdding(true)} className="flex min-h-12 items-center gap-2 text-left text-sm text-accent">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/50">+</span> Add an exercise
        </button>
        {movable.length > 1 && (
          <button type="button" onClick={() => setReorder(true)} className="flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] text-muted active:bg-card2">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 5v14M8 5 5 8M8 5l3 3M16 19V5M16 19l-3-3M16 19l3-3" /></svg>
            Reorder
          </button>
        )}
      </div>
      <ReorderSheet
        open={reorder}
        onClose={() => setReorder(false)}
        items={movable.map((i) => ({ key: i.key, title: EXERCISES[resolveExercise(day, i, week, plannedSession(plan, day, cycle), cycleSwaps).id]?.name ?? i.key, sub: i.rx(week) ? rxText(i.rx(week)!) : undefined }))}
        dayLabel={day in DAYS ? DAYS[day as DayId].title : undefined}
        canReset={!!plan?.order?.[day]}
        onReset={async () => { await setPlannedOrder(date, day, undefined); }}
        onSave={async (keys, always) => {
          await setPlannedOrder(date, day, keys);
          if (always && day in DAYS) await saveSettings({ dayOrder: { ...(settings.dayOrder ?? {}), [day]: keys.filter((k) => !k.startsWith(ADDED_PREFIX)) } });
          toast(always && day in DAYS ? `Saved as your ${DAYS[day as DayId].title} order` : 'Order saved for this day');
        }}
      />
      <AddExerciseSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={async (m) => {
          await addPlannedMove(date, day, m);
          toast(`Added ${EXERCISES[m.exercise]?.name}`);
        }}
      />
      {swap && (
        <PlanSwapSheet
          item={swap}
          day={day as DayId}
          date={date}
          cycle={cycle}
          currentId={resolveExercise(day, swap, week, fake, cycleSwaps).id}
          plannedId={swap.exercise(week)}
          onClose={() => setSwap(null)}
        />
      )}
      <Sheet open={!!info} onClose={() => setInfo(null)} title={info ? EXERCISES[info]?.name : ''}>
        {info && EXERCISES[info] && <ExerciseInfo ex={EXERCISES[info]} />}
      </Sheet>
    </div>
  );
}

function PlanSwapSheet({ item, day, date, cycle, currentId, plannedId, onClose }: { item: PlanItem; day: DayId; date: string; cycle: number; currentId: string; plannedId: string; onClose: () => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const slotKey = slotKeyOf(day, item);
  const options = ALL_EXERCISES.filter((e) => e.slots.includes(item.slot) && e.id !== currentId && e.id !== plannedId);
  const clearCycle = async () => {
    for (const c of await db.swaps.where('slotKey').equals(slotKey).filter((s) => !s.deleted && s.cycle === cycle && s.from === plannedId).toArray())
      await save<CycleSwap>('swaps', { ...c, deleted: true });
  };
  const apply = async (to: string, scope: 'day' | 'cycle') => {
    if (scope === 'day') await setPlannedSwap(date, slotKey, to);
    else {
      await setPlannedSwap(date, slotKey, undefined);
      await clearCycle();
      await save<CycleSwap>('swaps', { id: uid(), cycle, slotKey, from: plannedId, to });
    }
    toast(`${EXERCISES[to]?.name} ${scope === 'day' ? 'on ' + fmtDate(date) : 'for the rest of this cycle'}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Swap · ${SLOT_LABEL[item.slot]}`}>
      <div className="space-y-2">
        <p className="text-sm text-muted">Same sets, reps and rest. Pick this day only, or every {DAYS[day].title} day for the rest of this cycle.</p>
        {currentId !== plannedId && (
          <Button className="w-full" onClick={async () => { await setPlannedSwap(date, slotKey, undefined); await clearCycle(); toast(`Back to ${EXERCISES[plannedId]?.name}`); onClose(); }}>
            ↩ Back to the plan: {EXERCISES[plannedId]?.name}
          </Button>
        )}
        <p className="px-1 text-xs text-faint">Tap ⓘ to watch a move before you pick it.</p>
        {options.map((e) => (
          <ExerciseOption key={e.id} ex={e} onSelect={() => setPick(pick === e.id ? null : e.id)}>
            {pick === e.id && (
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <Button kind="primary" onClick={() => apply(e.id, 'day')}>This day only</Button>
                <Button onClick={() => apply(e.id, 'cycle')}>Rest of cycle</Button>
              </div>
            )}
          </ExerciseOption>
        ))}
      </div>
    </Sheet>
  );
}

