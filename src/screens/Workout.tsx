import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Scale, Segmented, Sheet, toast } from '../components/ui';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { Dot, ExerciseNode, Line, PrehabGroup } from '../components/workout/Timeline';
import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { ADDED_PREFIX, toPlanItem } from '../lib/added';
import { sessionLabel } from '../lib/activities';
import { RestTimer } from '../components/workout/RestTimer';
import { TestCard } from '../components/workout/Extras';
import { db, uid, type Checkin, type PainKey, type Session } from '../lib/db';
import { patch, remove, save } from '../lib/store';
import { useSettings, go, back } from '../lib/hooks';
import { COURT_WARMUP, DAYS, PREHAB_NOTE, WARMUP, type DayId, type PlanItem, type RoutineItem, type Section } from '../plan/days';
import { EXERCISES } from '../plan/exercises';
import { SAFETY } from '../plan/content';
import { programPosition } from '../lib/schedule';
import { isTestWeek } from '../plan/phases';
import { dayItems, deleteSession, jumpsInWeek, moveSession, rxText, tendonFlag } from '../lib/workout';
import { applyOrder } from '../lib/plans';
import { ReorderSheet } from '../components/ReorderSheet';
import { saveSettings } from '../lib/store';
import { fmtClock, fmtDate, fmtDuration } from '../lib/dates';
import { NumInput, Field } from '../components/ui';
import { keepAwake, unlockAudio } from '../lib/alerts';

const SECTION_TITLE: Record<Section, string> = {
  main: 'Workout',
  accessory: 'Accessories',
  added: 'Added exercises',
  court: 'Court',
  conditioning: 'Conditioning',
  prehab: 'AC joint + upper back prehab',
};

/** The live workout, or (with an id) a finished session opened from History for editing. */
export default function Workout({ id }: { id?: string }) {
  const review = !!id;
  const settings = useSettings();
  const session = useLiveQuery(
    async () => (id ? ((await db.sessions.get(id)) ?? null) : ((await db.sessions.where('status').equals('active').filter((s) => !s.deleted).first()) ?? null)),
    [id],
  );
  const sets = useLiveQuery(() => (session ? db.sets.where('sessionId').equals(session.id).filter((s) => !s.deleted).toArray() : []), [session?.id]) ?? [];
  const cycleSwaps = useLiveQuery(() => (session ? db.swaps.where('cycle').equals(session.cycle).filter((s) => !s.deleted).toArray() : []), [session?.cycle]) ?? [];
  const pos = session ? programPosition(settings.startDate, session.date) : null;
  const tendon = useLiveQuery(() => (pos ? tendonFlag(pos.weekStart) : null), [pos?.weekStart]);
  const jumps = useLiveQuery(() => (pos ? jumpsInWeek(pos.weekStart) : 0), [pos?.weekStart, sets.length, session?.dunks?.length]) ?? 0;
  const [info, setInfo] = useState<string | null>(null);
  const [finish, setFinish] = useState(false);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const testDone = useLiveQuery(async () => (session ? !!(await db.tests.where('date').equals(session.date).filter((t) => !t.deleted && t.approach.length > 0).first()) : false), [session?.date]);

  useEffect(() => {
    if (review) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    void keepAwake(true);
    return () => {
      clearInterval(t);
      void keepAwake(false);
    };
  }, [review]);

  if (session === undefined) return <div className="p-6 text-muted">Loading…</div>;
  if (session === null || session.deleted) {
    return (
      <div className="safe-top mx-auto max-w-lg p-6 text-center">
        <p className="text-muted">{review ? 'This session was deleted.' : 'No workout in progress.'}</p>
        <Button kind="primary" className="mt-4" onClick={() => go('')}>Back to Today</Button>
      </div>
    );
  }

  const isDay = session.type in DAYS;
  const day = isDay ? DAYS[session.type as DayId] : null;
  const week = session.week;
  const items = [...(day ? dayItems(day.id, week) : []), ...(session.added ?? []).map(toPlanItem)];
  const warmup: RoutineItem[] = day?.courtWarmup ? [...WARMUP, ...COURT_WARMUP] : WARMUP;
  const warmDone = warmup.every((w) => session.ticked.includes(w.exercise));
  const hasJumps = items.some((i) => EXERCISES[i.exercise(week)]?.jump);
  const target = pos?.phase.jumpTarget ?? [0, 0];
  const halved = !!tendon;
  const elapsed = (now - session.startedAt) / 1000;

  const removeAdded = async (itemKey: string) => {
    const slotKey = `${session.type}:${itemKey}`;
    const logged = sets.filter((x) => x.slotKey === slotKey);
    if (!confirm(logged.length ? `Remove this exercise and its ${logged.length} logged set${logged.length === 1 ? '' : 's'}?` : 'Remove this exercise?')) return;
    for (const x of logged) await remove('sets', x.id);
    await patch<Session>('sessions', session.id, { added: (session.added ?? []).filter((m) => ADDED_PREFIX + m.key !== itemKey) });
  };

  const tick = (id: string) => {
    const t = session.ticked.includes(id) ? session.ticked.filter((x) => x !== id) : [...session.ticked, id];
    void patch<Session>('sessions', session.id, { ticked: t });
  };

  /* ---------- the thread ---------- */
  const isDone = (item: PlanItem) => {
    const rx = item.rx(week);
    if (!rx) return true;
    const sets0 = halved && EXERCISES[item.exercise(week)]?.jump ? Math.max(1, Math.ceil(rx.sets / 2)) : rx.sets;
    return sets.filter((x) => x.slotKey === `${session.type}:${item.key}` && x.done).length >= sets0;
  };
  const ORDER: Section[] = ['main', 'accessory', 'added', 'court', 'conditioning'];
  const linear = applyOrder(ORDER.flatMap((sec) => items.filter((i) => i.section === sec)), session.order ?? settings.dayOrder?.[session.type]);
  const prehab = items.filter((i) => i.section === 'prehab');
  const prehabDone = prehab.filter(isDone).length;
  const showTest = session.type === 'D' && isTestWeek(week);
  const nodes: { key: string; done: boolean }[] = [
    { key: 'warmup', done: warmDone },
    ...(showTest ? [{ key: 'test', done: !!testDone }] : []),
    ...linear.map((i) => ({ key: i.key, done: isDone(i) })),
    ...(prehab.length ? [{ key: 'prehab', done: prehabDone >= prehab.length }] : []),
  ];
  const firstOpen = nodes.find((n) => !n.done)?.key ?? null;
  const current = review ? openKey : openKey ?? firstOpen;
  const openNext = (after: string) => {
    const i = nodes.findIndex((n) => n.key === after);
    const next = nodes.slice(i + 1).find((n) => !n.done) ?? nodes.find((n) => !n.done && n.key !== after);
    setOpenKey(next?.key ?? '__none');
  };
  const totalSets = linear.reduce((a, i) => a + (i.rx(week)?.sets ?? 0), 0) + prehab.length;
  const doneSets = linear.reduce((a, i) => a + Math.min(i.rx(week)?.sets ?? 0, sets.filter((x) => x.slotKey === `${session.type}:${i.key}` && x.done).length), 0) + prehabDone;
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
  const base = { day: session.type, week, session, cycleSwaps, sets, settings, halved, review, onInfo: setInfo };
  const sectionLabel = (sec: Section) => (sec === 'main' ? null : SECTION_TITLE[sec]);
  let lastSec: Section | null = null;
  const warmCount = session.ticked.filter((t) => warmup.some((w) => w.exercise === t)).length;

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-36">
      <header className="safe-top sticky top-0 z-30 bg-bg/95 px-4 pb-2 backdrop-blur">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => (review ? back() : go(''))} className="-ml-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-3xl leading-none text-muted active:bg-card2" aria-label="Back">‹</button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              {review ? `${fmtDate(session.date)}${session.endedAt ? ' · ' + fmtDuration(session.endedAt - session.startedAt) : ''}` : `Week ${week} · ${pos?.phase.name ?? ''}`}
            </div>
            <div className="truncate font-display text-[26px] leading-[1.05]">{day ? day.title : sessionLabel(session.type)}</div>
          </div>
          {!review && <span className="tnum mr-1 text-[12px] text-faint">{fmtClock(elapsed)}</span>}
          {!review && (
            <button type="button" onClick={() => { unlockAudio(); setFinish(true); }} className={`min-h-10 rounded-full px-4 text-[13px] ${pct >= 90 ? 'bg-accent text-accent-ink' : 'border border-accent/60 text-accent'}`}>Finish</button>
          )}
        </div>
        <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-card2"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
      </header>

      <div className="px-4 pt-2">
        {review && <ReviewHeader session={session} startDate={settings.startDate} />}
        {session.type === 'pickup' && <PickupEditor session={session} />}
        {day?.banner && !review && <div className="mb-2 rounded-xl border border-warn/25 px-3 py-2 text-[12px] text-warn">{day.banner}</div>}
        <div className="mb-1 flex min-h-9 items-center justify-between gap-3 px-1 text-[11px] text-muted">
          <span className="tnum">
            {hasJumps && target[1] > 0 && !review ? <>Jumps this week{halved ? ' (halved)' : ''} · {jumps} / {halved ? `${Math.round(target[0] / 2)}–${Math.round(target[1] / 2)}` : `${target[0]}–${target[1]}`}</> : null}
          </span>
          {linear.length > 1 && (
            <button type="button" onClick={() => setReorder(true)} className="flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] text-muted active:bg-card2">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 5v14M8 5 5 8M8 5l3 3M16 19V5M16 19l-3-3M16 19l3-3" /></svg>
              Reorder
            </button>
          )}
        </div>

        {/* the gold thread */}
        <div className="relative pl-[26px]">
          <div className="absolute top-3 bottom-3 left-[6px] w-px bg-line" />

          {/* warm-up */}
          {current === 'warmup' ? (
            <div className="relative my-1.5 rounded-[20px] border border-accent/25 bg-card p-3">
              <Dot state="current" />
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[22px]">Warm-up</span>
                <span className="text-[11px] text-muted">{warmCount}/{warmup.length}</span>
              </div>
              <ul className="mt-1 divide-y divide-line">
                {warmup.map((w) => {
                  const on = session.ticked.includes(w.exercise);
                  return (
                    <li key={w.exercise} className="flex items-center gap-2">
                      <button type="button" className="min-h-12 min-w-0 flex-1 py-1 text-left" onClick={() => setInfo(w.exercise)}>
                        <div className={`truncate text-[14px] ${on ? 'text-faint' : ''}`}>{EXERCISES[w.exercise]?.name ?? w.exercise}</div>
                        <div className="truncate text-[11px] text-faint">{w.dose}{w.note ? ` · ${w.note}` : ''}</div>
                      </button>
                      <button type="button" onClick={() => tick(w.exercise)} aria-label="Done" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm ${on ? 'bg-accent text-accent-ink' : 'border border-line text-faint'}`}>✓</button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="mt-2 min-h-11 w-full rounded-full bg-accent text-[14px] font-medium text-accent-ink"
                onClick={async () => {
                  await patch<Session>('sessions', session.id, { ticked: [...new Set([...session.ticked, ...warmup.map((w) => w.exercise)])] });
                  openNext('warmup');
                }}
              >
                {warmDone ? 'Next ›' : 'Warm-up done'}
              </button>
            </div>
          ) : (
            <Line title="Warm-up" right={`${warmCount}/${warmup.length}`} state={warmDone ? 'done' : 'todo'} onClick={() => setOpenKey('warmup')} />
          )}
          {hasJumps && !review && warmDone && <StiffnessCheck date={session.date} />}

          {/* test day */}
          {showTest &&
            (current === 'test' ? (
              <div className="relative my-1.5">
                <Dot state="current" />
                <TestCard session={session} reach={settings.standingReach} />
                <button type="button" className="mt-2 min-h-11 w-full rounded-full border border-accent/50 text-[13px] text-accent" onClick={() => openNext('test')}>Next ›</button>
              </div>
            ) : (
              <Line title="Test day" right={testDone ? 'logged' : 'vertical + touch'} state={testDone ? 'done' : 'todo'} onClick={() => setOpenKey('test')} />
            ))}

          {/* exercises */}
          {linear.map((item) => {
            const label = item.section !== lastSec ? sectionLabel(item.section) : null;
            lastSec = item.section;
            return (
              <div key={item.key}>
                {label && <div className="mt-3 mb-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-faint">{label}</div>}
                <ExerciseNode
                  {...base}
                  item={item}
                  open={current === item.key}
                  onOpen={() => setOpenKey(item.key)}
                  onComplete={() => openNext(item.key)}
                  onRemove={item.section === 'added' ? () => void removeAdded(item.key) : undefined}
                />
              </div>
            );
          })}

          {/* prehab checklist */}
          {prehab.length > 0 && (
            <PrehabGroup items={prehab} note={PREHAB_NOTE} open={current === 'prehab'} onOpen={() => setOpenKey('prehab')} base={base} doneCount={prehabDone} />
          )}

          <button type="button" onClick={() => setAdding(true)} className="relative flex min-h-12 w-full items-center gap-2 py-2 text-left text-[14px] text-accent">
            <span className="absolute top-[14px] -left-[26px] flex h-[19px] w-[19px] items-center justify-center rounded-full border border-accent/60 bg-bg text-[13px] leading-none">+</span>
            Add an exercise
          </button>
        </div>

        <AddExerciseSheet
          open={adding}
          onClose={() => setAdding(false)}
          onAdd={async (m) => {
            await patch<Session>('sessions', session.id, { added: [...(session.added ?? []), m] });
            toast(`Added ${EXERCISES[m.exercise]?.name}`);
            setOpenKey(ADDED_PREFIX + m.key);
          }}
        />

        <ReorderSheet
          open={reorder}
          onClose={() => setReorder(false)}
          items={linear.map((i) => {
            const ex = EXERCISES[i.exercise(week)];
            return { key: i.key, title: ex?.name ?? i.key, sub: i.rx(week) ? rxText(i.rx(week)!) : undefined, done: isDone(i) };
          })}
          dayLabel={day ? day.title : undefined}
          canReset={!!session.order}
          onReset={async () => { await patch<Session>('sessions', session.id, { order: undefined }); }}
          onSave={async (keys, always) => {
            await patch<Session>('sessions', session.id, { order: keys });
            if (always && day) await saveSettings({ dayOrder: { ...(settings.dayOrder ?? {}), [day.id]: keys.filter((k) => !k.startsWith(ADDED_PREFIX)) } });
            toast(always && day ? `Saved as your ${day.title} order` : 'Order saved');
          }}
        />

        {session.type === 'mobility' && <p className="mt-3 px-1 text-sm text-muted">Then walk the dog. Log it from Today when you're back.</p>}

        {review ? (
          <>
            <PainEditor session={session} />
            <Button
              kind="danger"
              className="mt-4 w-full"
              onClick={async () => {
                if (!confirm('Delete this session and every set logged in it?')) return;
                await deleteSession(session);
                toast('Session deleted');
                back();
              }}
            >
              Delete this session
            </Button>
          </>
        ) : (
          <>
            <Button kind="primary" big className="mt-5 w-full" onClick={() => setFinish(true)}>Finish workout</Button>
            <button
              type="button"
              className="min-h-11 w-full text-[13px] text-faint"
              onClick={async () => {
                if (!confirm('Discard this workout? Logged sets will be deleted.')) return;
                for (const x of sets) await remove('sets', x.id);
                await remove('sessions', session.id);
                go('');
              }}
            >
              Discard workout
            </button>
          </>
        )}
      </div>

      {!review && <RestTimer sound={settings.sound} vibrate={settings.vibrate} />}

      <Sheet open={!!info} onClose={() => setInfo(null)} title={info ? EXERCISES[info]?.name : ''}>
        {info && EXERCISES[info] ? <ExerciseInfo ex={EXERCISES[info]} /> : <p className="text-muted">Not in the library yet.</p>}
        <p className="mt-4 text-center text-xs text-faint">{SAFETY.footer}</p>
      </Sheet>
      {!review && <FinishSheet open={finish} onClose={() => setFinish(false)} session={session} />}
    </div>
  );
}

function StiffnessCheck({ date }: { date: string }) {
  const c = useLiveQuery(() => db.checkins.where('date').equals(date).filter((x) => !x.deleted).first(), [date]);
  const answered = c?.stiff !== undefined;
  const set = async (stiff: boolean) => {
    await save<Checkin>('checkins', { ...(c ?? {}), id: c?.id ?? uid(), date, stiff });
    if (stiff) toast('Jump volume halved for this week');
  };
  if (answered && !c?.stiff) return null;
  return (
    <Card>
      <div className="text-sm font-semibold">After the warm-up: knees or Achilles still stiff?</div>
      {c?.stiff ? (
        <p className="mt-1 text-sm text-warn">{SAFETY.tendonRule}</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button onClick={() => set(false)}>No, loose</Button>
          <Button onClick={() => set(true)}>Yes, still stiff</Button>
        </div>
      )}
    </Card>
  );
}

const PAIN: { key: PainKey; label: string; advice: string }[] = [
  { key: 'shoulder', label: 'Shoulder', advice: SAFETY.shoulder },
  { key: 'hamstring', label: 'Hamstring', advice: SAFETY.hamstring },
  { key: 'knee', label: 'Knee', advice: SAFETY.tendonRule },
  { key: 'achilles', label: 'Achilles', advice: SAFETY.tendonRule },
];

function FinishSheet({ open, onClose, session }: { open: boolean; onClose: () => void; session: Session }) {
  const [pain, setPain] = useState<Partial<Record<PainKey, number>>>(session.pain ?? {});
  const [note, setNote] = useState(session.note ?? '');
  const [sharp, setSharp] = useState<'no' | 'yes'>('no');
  const high = PAIN.filter((p) => (pain[p.key] ?? 0) > 3);
  const finishNow = async () => {
    await patch<Session>('sessions', session.id, { pain, note: note || undefined, status: 'done', endedAt: Date.now() });
    // knee / Achilles above 3 after a session also halves this week's jumps
    if ((pain.knee ?? 0) > 3 || (pain.achilles ?? 0) > 3) {
      const c = await db.checkins.where('date').equals(session.date).filter((x) => !x.deleted).first();
      await save<Checkin>('checkins', { ...(c ?? {}), id: c?.id ?? uid(), date: session.date, knee: Math.max(c?.knee ?? 0, pain.knee ?? 0), achilles: Math.max(c?.achilles ?? 0, pain.achilles ?? 0) });
    }
    try {
      localStorage.removeItem('hoops.rest');
    } catch {
      /* ignore */
    }
    toast('Workout saved');
    go('');
  };
  return (
    <Sheet open={open} onClose={onClose} title="Pain check">
      <div className="space-y-4">
        <p className="text-sm text-muted">{SAFETY.painScale}</p>
        {PAIN.map((p) => (
          <div key={p.key}>
            <div className="mb-1 text-sm">{p.label}</div>
            <Scale value={pain[p.key]} onChange={(n) => setPain((o) => ({ ...o, [p.key]: n }))} />
          </div>
        ))}
        <div>
          <div className="mb-1 text-sm">Any sharp or pinching pain?</div>
          <Segmented options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} value={sharp} onChange={setSharp} />
        </div>
        {(high.length > 0 || sharp === 'yes') && (
          <div className="space-y-2 rounded-xl border border-bad/40 bg-bad/5 p-3 text-sm">
            <div className="font-semibold text-bad">Back off</div>
            <p>Stop the exercise that caused it and swap it next time.</p>
            {high.map((p) => <p key={p.key}>{p.advice}</p>)}
            <p className="text-xs text-faint">{SAFETY.footer}</p>
          </div>
        )}
        <textarea className="min-h-20 w-full rounded-xl bg-card2 p-3" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button kind="primary" big className="w-full" onClick={finishNow}>Save workout</Button>
      </div>
    </Sheet>
  );
}

/** History: change the date or length of a finished session. */
function ReviewHeader({ session, startDate }: { session: Session; startDate: string }) {
  const mins = session.endedAt ? Math.round((session.endedAt - session.startedAt) / 60000) : undefined;
  return (
    <Card className="space-y-3">
      <div className="text-sm text-muted">Changes save as you type. Edit any set below, add one, or tap ✕ to remove one.</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input
            type="date"
            className="min-h-11 w-full rounded-xl bg-card2 px-3"
            value={session.date}
            onChange={async (e) => {
              if (!e.target.value) return;
              await moveSession(session, e.target.value, startDate);
              toast('Moved to ' + fmtDate(e.target.value));
            }}
          />
        </Field>
        <Field label="Minutes">
          <NumInput value={mins} decimal={false} onChange={(v) => v && void patch<Session>('sessions', session.id, { endedAt: session.startedAt + v * 60000 })} />
        </Field>
      </div>
    </Card>
  );
}

function PickupEditor({ session }: { session: Session }) {
  const p = session.pickup ?? { minutes: 0, feel: 3 };
  const set = (c: Partial<typeof p>) => void patch<Session>('sessions', session.id, { pickup: { ...p, ...c } });
  return (
    <Card className="space-y-3">
      <Field label="Minutes played"><NumInput value={p.minutes} decimal={false} onChange={(v) => set({ minutes: v ?? 0 })} /></Field>
      <Field label="How you felt (1–5)">
        <Segmented options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} value={p.feel} onChange={(feel) => set({ feel })} />
      </Field>
    </Card>
  );
}

/** History: pain scores and the note, editable in place. */
function PainEditor({ session }: { session: Session }) {
  const [note, setNote] = useState(session.note ?? '');
  return (
    <Card className="mt-3 space-y-3">
      <div className="font-semibold">Pain check</div>
      {PAIN.map((p) => (
        <div key={p.key}>
          <div className="mb-1 text-sm">{p.label}</div>
          <Scale value={session.pain?.[p.key]} onChange={(n) => void patch<Session>('sessions', session.id, { pain: { ...(session.pain ?? {}), [p.key]: n } })} />
        </div>
      ))}
      <textarea
        className="min-h-20 w-full rounded-xl bg-card2 p-3"
        placeholder="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => void patch<Session>('sessions', session.id, { note: note || undefined })}
      />
    </Card>
  );
}
