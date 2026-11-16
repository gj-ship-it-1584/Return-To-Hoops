import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Pill, Scale, SectionTitle, Segmented, Sheet, toast } from '../components/ui';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { RestTimer } from '../components/workout/RestTimer';
import { TestCard } from '../components/workout/Extras';
import { db, uid, type Checkin, type PainKey, type Session } from '../lib/db';
import { patch, remove, save } from '../lib/store';
import { useSettings, go } from '../lib/hooks';
import { COURT_WARMUP, DAYS, PREHAB_NOTE, WARMUP, type DayId, type RoutineItem, type Section } from '../plan/days';
import { EXERCISES } from '../plan/exercises';
import { SAFETY } from '../plan/content';
import { programPosition } from '../lib/schedule';
import { isTestWeek } from '../plan/phases';
import { dayItems, jumpsInWeek, tendonFlag } from '../lib/workout';
import { fmtClock } from '../lib/dates';
import { keepAwake, unlockAudio } from '../lib/alerts';

const SECTION_TITLE: Record<Section, string> = {
  main: 'Workout',
  court: 'Court',
  conditioning: 'Conditioning',
  prehab: 'AC joint + upper back prehab',
};

export default function Workout() {
  const settings = useSettings();
  const session = useLiveQuery(async () => (await db.sessions.where('status').equals('active').filter((s) => !s.deleted).first()) ?? null, []);
  const sets = useLiveQuery(() => (session ? db.sets.where('sessionId').equals(session.id).filter((s) => !s.deleted).toArray() : []), [session?.id]) ?? [];
  const cycleSwaps = useLiveQuery(() => (session ? db.swaps.where('cycle').equals(session.cycle).filter((s) => !s.deleted).toArray() : []), [session?.cycle]) ?? [];
  const pos = session ? programPosition(settings.startDate, session.date) : null;
  const tendon = useLiveQuery(() => (pos ? tendonFlag(pos.weekStart) : null), [pos?.weekStart]);
  const jumps = useLiveQuery(() => (pos ? jumpsInWeek(pos.weekStart) : 0), [pos?.weekStart, sets.length, session?.dunks?.length]) ?? 0;
  const [info, setInfo] = useState<string | null>(null);
  const [finish, setFinish] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    void keepAwake(true);
    return () => {
      clearInterval(id);
      void keepAwake(false);
    };
  }, []);

  if (session === undefined) return <div className="p-6 text-muted">Loading…</div>;
  if (session === null) {
    return (
      <div className="safe-top mx-auto max-w-lg p-6 text-center">
        <p className="text-muted">No workout in progress.</p>
        <Button kind="primary" className="mt-4" onClick={() => go('')}>Back to Today</Button>
      </div>
    );
  }

  const isDay = session.type in DAYS;
  const day = isDay ? DAYS[session.type as DayId] : null;
  const week = session.week;
  const items = day ? dayItems(day.id, week) : [];
  const warmup: RoutineItem[] = day?.courtWarmup ? [...WARMUP, ...COURT_WARMUP] : WARMUP;
  const warmDone = warmup.every((w) => session.ticked.includes(w.exercise));
  const hasJumps = items.some((i) => EXERCISES[i.exercise(week)]?.jump);
  const target = pos?.phase.jumpTarget ?? [0, 0];
  const halved = !!tendon;
  const sections = (['main', 'court', 'conditioning', 'prehab'] as Section[]).filter((s) => items.some((i) => i.section === s));
  const elapsed = (now - session.startedAt) / 1000;

  const tick = (id: string) => {
    const t = session.ticked.includes(id) ? session.ticked.filter((x) => x !== id) : [...session.ticked, id];
    void patch<Session>('sessions', session.id, { ticked: t });
  };

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-40">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/95 px-4 pb-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go('')} className="min-h-11 min-w-11 rounded-full text-2xl text-muted active:bg-card2" aria-label="Back to Today">‹</button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{day ? `${day.title} · ${day.subtitle}` : session.type === 'mobility' ? 'Mobility + walk' : 'Session'}</div>
            <div className="tnum text-xs text-muted">Week {week} · {fmtClock(elapsed)} elapsed</div>
          </div>
          <Button kind="primary" onClick={() => { unlockAudio(); setFinish(true); }}>Finish</Button>
        </div>
      </header>

      <div className="space-y-3 px-4 pt-3">
        {day?.banner && <div className="rounded-xl border border-warn/30 bg-warn/5 p-3 text-sm text-warn">{day.banner}</div>}

        {/* warm-up */}
        <details className="rounded-2xl bg-card" open={!warmDone}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4">
            <span className="font-semibold">Warm-up / hip flexor routine</span>
            <Pill tone={warmDone ? 'good' : 'muted'}>{session.ticked.filter((t) => warmup.some((w) => w.exercise === t)).length}/{warmup.length}</Pill>
          </summary>
          <ul className="px-2 pb-2">
            {warmup.map((w) => {
              const on = session.ticked.includes(w.exercise);
              return (
                <li key={w.exercise} className="flex items-center gap-2">
                  <button type="button" onClick={() => tick(w.exercise)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-good text-bg' : 'bg-card2 text-faint'}`} aria-label="Done">✓</button>
                  <button type="button" className="min-h-12 min-w-0 flex-1 py-1 text-left" onClick={() => setInfo(w.exercise)}>
                    <div className={`text-[15px] ${on ? 'text-muted line-through' : ''}`}>{EXERCISES[w.exercise]?.name ?? w.exercise}</div>
                    <div className="text-xs text-faint">{w.dose}{w.note ? ` · ${w.note}` : ''}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>

        {hasJumps && <StiffnessCheck date={session.date} />}

        {session.type === 'D' && isTestWeek(week) && <TestCard session={session} reach={settings.standingReach} />}

        {hasJumps && target[1] > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-card2 px-3 py-2 text-sm">
            <span className="text-muted">Jumps this week{halved ? ' (halved)' : ''}</span>
            <span className="tnum font-semibold">{jumps} / {halved ? `${Math.round(target[0] / 2)}–${Math.round(target[1] / 2)}` : `${target[0]}–${target[1]}`}</span>
          </div>
        )}

        {sections.map((sec) => (
          <div key={sec}>
            <SectionTitle>{SECTION_TITLE[sec]}</SectionTitle>
            {sec === 'prehab' && <p className="-mt-1 mb-2 px-1 text-sm text-warn">{PREHAB_NOTE}</p>}
            <div className="space-y-3">
              {items.filter((i) => i.section === sec).map((item) => (
                <ExerciseCard key={item.key} day={day!.id} item={item} week={week} session={session} cycleSwaps={cycleSwaps} sets={sets} settings={settings} halved={halved} onInfo={setInfo} />
              ))}
            </div>
          </div>
        ))}

        {session.type === 'mobility' && (
          <Card>
            <div className="font-semibold">Then walk the dog</div>
            <p className="text-sm text-muted">Log it from Today when you're back. Easy pace counts.</p>
          </Card>
        )}

        <Button kind="primary" big className="mt-4 w-full" onClick={() => setFinish(true)}>Finish workout</Button>
        <button
          type="button"
          className="min-h-11 w-full text-sm text-faint"
          onClick={async () => {
            if (!confirm('Discard this workout? Logged sets will be deleted.')) return;
            for (const s of sets) await remove('sets', s.id);
            await remove('sessions', session.id);
            go('');
          }}
        >
          Discard workout
        </button>
      </div>

      <RestTimer sound={settings.sound} vibrate={settings.vibrate} />

      <Sheet open={!!info} onClose={() => setInfo(null)} title={info ? EXERCISES[info]?.name : ''}>
        {info && EXERCISES[info] ? <ExerciseInfo ex={EXERCISES[info]} /> : <p className="text-muted">Not in the library yet.</p>}
        <p className="mt-4 text-center text-xs text-faint">{SAFETY.footer}</p>
      </Sheet>
      <FinishSheet open={finish} onClose={() => setFinish(false)} session={session} />
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
