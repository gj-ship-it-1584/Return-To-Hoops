import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Pill, SectionTitle, Sheet } from '../components/ui';
import { BodySheet, CardioSheet, CheckinCard, DogWalkSheet, PickupSheet } from '../components/QuickForms';
import { useActiveSession, useSessions, useSettings, useSyncStatus, useToday, go } from '../lib/hooks';
import { planForDay } from '../lib/schedule';
import { addDays, diffDays, dowLetter, fmtDate, fmtDuration, weekday, dowName } from '../lib/dates';
import { DAYS, DESK_RESET, LIFT_ORDER, type DayId } from '../plan/days';
import { NUTRITION, SAFETY } from '../plan/content';
import { db, type SessionType } from '../lib/db';
import { jumpsInWeek, startSession, tendonFlag } from '../lib/workout';
import { unlockAudio } from '../lib/alerts';
import { daysSinceBackup } from '../lib/backup';
import { EXERCISES } from '../plan/exercises';

export default function Today() {
  const settings = useSettings();
  const sessions = useSessions();
  const today = useToday();
  const active = useActiveSession();
  const sync = useSyncStatus();
  const plan = planForDay(today, settings, sessions);
  const { pos } = plan;
  const [sheet, setSheet] = useState<null | 'weight' | 'cardio' | 'dog' | 'pick' | 'pickup'>(null);

  const checkin = useLiveQuery(() => db.checkins.where('date').equals(today).filter((c) => !c.deleted).first(), [today]);
  const weekStart = pos.started ? pos.weekStart : today;
  const jumps = useLiveQuery(() => jumpsInWeek(weekStart), [weekStart, sessions.length]) ?? 0;
  const tendon = useLiveQuery(() => tendonFlag(weekStart), [weekStart, checkin?.u]);
  const lastWaist = useLiveQuery(() => db.body.orderBy('date').filter((b) => !b.deleted && b.waist !== undefined).last(), []);
  const backupDays = useLiveQuery(() => daysSinceBackup(), []);
  const cardioWeek = useLiveQuery(() => db.cardio.where('date').between(weekStart, addDays(weekStart, 7), true, false).filter((c) => !c.deleted).toArray(), [weekStart]) ?? [];

  const waistDue = !lastWaist || diffDays(lastWaist.date, today) >= 14;
  const target = pos.phase.jumpTarget;
  const halved = !!tendon;
  const tgt: [number, number] = halved ? [Math.round(target[0] / 2), Math.round(target[1] / 2)] : target;

  const begin = async (type: SessionType) => {
    unlockAudio();
    if (active) return go('workout');
    await startSession(type, settings.startDate, today);
    go('workout');
  };

  const sessionToday = sessions.find((s) => s.date === today && s.status === 'done' && (plan.lift ? s.type === plan.lift : plan.kind === 'dayD' ? s.type === 'D' : false));

  return (
    <div>
      <header className="pt-2 pb-3">
        <div className="text-sm text-muted">{fmtDate(today)}</div>
        {pos.started ? (
          <>
            <h1 className="mt-0.5 text-2xl font-bold">
              Week {pos.week} <span className="text-muted">· {pos.phase.name}</span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Pill>Cycle {pos.cycle}</Pill>
              <Pill tone="accent">{pos.phase.effort}</Pill>
              {sync.state !== 'local' && <Pill tone={sync.state === 'live' ? 'good' : sync.state === 'error' ? 'bad' : 'muted'}>{sync.state === 'live' ? 'Synced' : sync.state === 'error' ? 'Sync error' : sync.state === 'offline' ? 'Offline · saved on phone' : 'Connecting…'}</Pill>}
            </div>
          </>
        ) : (
          <h1 className="mt-0.5 text-2xl font-bold">
            Program starts {fmtDate(settings.startDate)} <span className="text-muted">(in {pos.daysUntilStart} day{pos.daysUntilStart === 1 ? '' : 's'})</span>
          </h1>
        )}
      </header>

      {/* alerts */}
      <div className="space-y-3">
        {plan.kind === 'bloodDraw' && (
          <Card className="border border-warn/40">
            <div className="font-semibold text-warn">Blood draw {plan.bloodDrawIn === 0 ? 'today' : `in ${plan.bloodDrawIn} day${plan.bloodDrawIn === 1 ? '' : 's'}`}</div>
            <p className="mt-1 text-sm text-muted">{SAFETY.bloodDraw}</p>
          </Card>
        )}
        {halved && (
          <Card className="border border-warn/40">
            <div className="font-semibold text-warn">Jump volume halved this week</div>
            <p className="mt-1 text-sm text-muted">
              {tendon?.stiff ? 'Knee or Achilles stiffness lasted past the warm-up.' : `Knee pain ${tendon?.knee ?? 0}, Achilles ${tendon?.achilles ?? 0} out of 10 this week.`} {SAFETY.tendons} Half the jump sets keeps you jumping while the tendon calms down.
            </p>
          </Card>
        )}
        {plan.testDay && (
          <Card className="border border-info/40">
            <div className="font-semibold text-info">Test day</div>
            <p className="mt-1 text-sm text-muted">After the warm-up: standing vertical (3 tries) and approach touch (3 tries).{settings.standingReach ? '' : ' Set your standing reach in Settings first.'}</p>
          </Card>
        )}
      </div>

      {/* today's session */}
      <SectionTitle>Today</SectionTitle>
      <Card>
        {active ? (
          <>
            <div className="text-lg font-semibold">{active.type in DAYS ? `${DAYS[active.type as DayId].title} in progress` : 'Session in progress'}</div>
            <p className="text-sm text-muted">Everything is saved as you go.</p>
            <Button kind="primary" big className="mt-3 w-full" onClick={() => go('workout')}>Resume workout</Button>
          </>
        ) : plan.kind === 'lift' && plan.lift ? (
          sessionToday ? (
            <DoneCard title={DAYS[plan.lift].title} duration={sessionToday.endedAt ? sessionToday.endedAt - sessionToday.startedAt : 0} next={`Next: ${DAYS[plan.next].title}`} />
          ) : (
            <>
              <div className="text-xl font-bold">{DAYS[plan.lift].title}</div>
              <div className="text-muted">{DAYS[plan.lift].subtitle}</div>
              {plan.behind && plan.calendarLift && (
                <p className="mt-2 rounded-xl bg-card2 p-3 text-sm text-muted">
                  The calendar says {DAYS[plan.calendarLift].title}, but {DAYS[plan.lift].title} is next in order, so you're picking up where you left off.
                </p>
              )}
              <Button kind="primary" big className="mt-3 w-full" onClick={() => begin(plan.lift!)}>Start workout</Button>
            </>
          )
        ) : plan.kind === 'dayD' ? (
          sessionToday ? (
            <DoneCard title="Day D" duration={sessionToday.endedAt ? sessionToday.endedAt - sessionToday.startedAt : 0} next={`Next lift: ${DAYS[plan.next].title}`} />
          ) : (
            <>
              <div className="flex items-center gap-2"><span className="text-xl font-bold">Day D</span><Pill>Optional</Pill></div>
              <div className="text-muted">{DAYS.D.subtitle}</div>
              <Button kind="primary" big className="mt-3 w-full" onClick={() => begin('D')}>Start workout</Button>
              {pos.week >= 9 && pos.week <= 12 && <Button className="mt-2 w-full" onClick={() => setSheet('pickup')}>Played pickup instead</Button>}
            </>
          )
        ) : plan.kind === 'cardio' ? (
          <>
            <div className="flex items-center gap-2"><span className="text-xl font-bold">Easy cardio</span><Pill>Optional</Pill></div>
            <p className="mt-1 text-sm text-muted">
              {plan.cardioSuggested ? 'Incline walk, bike or rower, 30–40 min. Talking pace.' : `Skip cardio today — tomorrow is ${plan.next === 'A' ? 'Day A' : 'Day D'} and you want fresh legs. A walk with the dog is plenty.`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button kind={plan.cardioSuggested ? 'primary' : 'secondary'} onClick={() => setSheet('cardio')}>Log cardio</Button>
              <Button onClick={() => setSheet('dog')}>Dog walk</Button>
            </div>
            <p className="mt-3 text-xs text-faint">Next lift: {DAYS[plan.next].title} · plus the 5-minute desk reset below.</p>
          </>
        ) : (
          <>
            <div className="text-xl font-bold">{plan.kind === 'bloodDraw' ? 'Mobility + walking' : 'Rest day'}</div>
            <p className="mt-1 text-sm text-muted">5-minute desk reset, then walk the dog.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {DESK_RESET.map((r) => (
                <li key={r.exercise} className="flex justify-between gap-3">
                  <button type="button" className="text-left text-ink underline decoration-line underline-offset-4" onClick={() => go(`library/${r.exercise}`)}>{EXERCISES[r.exercise]?.name ?? r.exercise}</button>
                  <span className="shrink-0 text-muted">{r.dose}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button kind="primary" onClick={() => begin('mobility')}>Start desk reset</Button>
              <Button onClick={() => setSheet('dog')}>Dog walk</Button>
            </div>
          </>
        )}
        {!active && (
          <button type="button" className="mt-3 min-h-11 w-full text-sm text-muted active:text-ink" onClick={() => setSheet('pick')}>
            Pick a different session
          </button>
        )}
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button big onClick={() => setSheet('weight')}>Log weight</Button>
        <Button big onClick={() => setSheet('dog')}>Log dog walk</Button>
      </div>

      {/* this week */}
      <SectionTitle right={<span className="text-xs text-faint">{pos.started ? `Week ${pos.week}` : 'This week'}</span>}>This week</SectionTitle>
      <WeekStrip weekStart={weekStart} today={today} liftDays={settings.liftDays} sessions={sessions} cardioDates={cardioWeek.map((c) => c.date)} />
      {pos.started && tgt[1] > 0 && (
        <Card className="mt-3">
          <div className="flex items-baseline justify-between">
            <div className="text-sm text-muted">Jumps this week</div>
            <div className="tnum text-lg font-semibold">{jumps} <span className="text-sm font-normal text-muted">/ {tgt[0]}–{tgt[1]}</span></div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-card2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (jumps / tgt[1]) * 100)}%` }} />
          </div>
        </Card>
      )}

      {/* nudges */}
      <div className="mt-3 space-y-3">
        {checkin?.knee === undefined || checkin?.achilles === undefined ? (
          <Card><CheckinCard date={today} existing={checkin} /></Card>
        ) : null}
        {waistDue && (
          <Card onClick={() => setSheet('weight')}>
            <div className="font-semibold">Waist measurement due</div>
            <p className="text-sm text-muted">{lastWaist ? `Last one was ${diffDays(lastWaist.date, today)} days ago.` : 'Measure at the belly button, relaxed, every 2 weeks.'}</p>
          </Card>
        )}
        {sync.state === 'local' && backupDays !== null && backupDays !== undefined && backupDays > 14 && (
          <Card onClick={() => go('settings')}>
            <div className="font-semibold">Back up your data</div>
            <p className="text-sm text-muted">It's been {backupDays} days. Export a backup file from Settings (or turn on sync so it backs up automatically).</p>
          </Card>
        )}
      </div>

      <SectionTitle>Fuel</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted">Calories</div>
            <div className="tnum text-xl font-semibold">~{settings.calories.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Protein</div>
            <div className="tnum text-xl font-semibold">{NUTRITION.protein[0]}–{NUTRITION.protein[1]} g</div>
            <div className="text-xs text-faint">{NUTRITION.proteinNote}</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">{NUTRITION.fiber} {NUTRITION.avoid}</p>
      </Card>

      <SessionPicker
        open={sheet === 'pick'}
        onClose={() => setSheet(null)}
        week={pos.week}
        onPick={(t) => {
          setSheet(null);
          if (t === 'cardio') setSheet('cardio');
          else if (t === 'pickup') setSheet('pickup');
          else void begin(t);
        }}
      />
      <BodySheet open={sheet === 'weight'} onClose={() => setSheet(null)} date={today} units={settings.units} />
      <CardioSheet open={sheet === 'cardio'} onClose={() => setSheet(null)} date={today} />
      <DogWalkSheet open={sheet === 'dog'} onClose={() => setSheet(null)} date={today} />
      <PickupSheet open={sheet === 'pickup'} onClose={() => setSheet(null)} date={today} startDate={settings.startDate} />
    </div>
  );
}

function DoneCard({ title, duration, next }: { title: string; duration: number; next: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-good/15 text-2xl text-good">✓</div>
      <div>
        <div className="text-lg font-semibold">{title} done</div>
        <div className="text-sm text-muted">{duration ? fmtDuration(duration) + ' · ' : ''}{next}</div>
      </div>
    </div>
  );
}

function WeekStrip({ weekStart, today, liftDays, sessions, cardioDates }: { weekStart: string; today: string; liftDays: number[]; sessions: { date: string; type: string; status: string }[]; cardioDates: string[] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const wd = weekday(d);
        const li = liftDays.indexOf(wd);
        const plannedLabel = li >= 0 ? LIFT_ORDER[li] : wd === 0 || wd === 6 ? 'D' : '·';
        const done = sessions.filter((s) => s.date === d && s.status === 'done' && s.type !== 'mobility');
        const cardio = cardioDates.includes(d);
        const isToday = d === today;
        return (
          <div key={d} className={`flex flex-col items-center rounded-xl py-2 ${isToday ? 'bg-card2 ring-1 ring-accent' : 'bg-card'}`} title={dowName(wd)}>
            <div className="text-[11px] text-faint">{dowLetter(wd)}</div>
            <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${done.length ? 'bg-good text-bg' : li >= 0 ? 'bg-card2 text-ink' : 'text-faint'}`}>
              {done.length ? (done[0].type === 'pickup' ? 'P' : done[0].type) : plannedLabel}
            </div>
            <div className="mt-1 h-1.5">{cardio && <div className="h-1.5 w-1.5 rounded-full bg-info" />}</div>
          </div>
        );
      })}
    </div>
  );
}

function SessionPicker({ open, onClose, onPick, week }: { open: boolean; onClose: () => void; onPick: (t: SessionType | 'cardio' | 'pickup') => void; week: number }) {
  const opts: { t: SessionType | 'cardio' | 'pickup'; title: string; sub: string; optional?: boolean }[] = [
    ...(['A', 'B', 'C'] as DayId[]).map((d) => ({ t: d, title: DAYS[d].title, sub: DAYS[d].subtitle })),
    { t: 'D', title: 'Day D', sub: DAYS.D.subtitle, optional: true },
    { t: 'mobility', title: 'Mobility + walk', sub: 'Desk reset and the hip flexor routine' },
    { t: 'cardio', title: 'Easy cardio', sub: 'Log an incline walk, bike, rower or dog walk', optional: true },
    ...(week >= 9 && week <= 12 ? [{ t: 'pickup' as const, title: 'Played pickup instead', sub: 'Log minutes and how you felt' }] : []),
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Pick a session">
      <div className="space-y-2">
        {opts.map((o) => (
          <Card key={o.t} onClick={() => onPick(o.t)} className="bg-card">
            <div className="flex items-center gap-2 font-semibold">{o.title}{o.optional && <Pill>Optional</Pill>}</div>
            <div className="text-sm text-muted">{o.sub}</div>
          </Card>
        ))}
      </div>
    </Sheet>
  );
}

export { dowName };
