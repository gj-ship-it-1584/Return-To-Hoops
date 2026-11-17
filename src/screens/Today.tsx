import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Pill, SectionTitle, Sheet } from '../components/ui';
import { TargetsCard } from '../components/TargetsCard';
import { BodySheet, CardioSheet, CheckinCard, DogWalkSheet, PickupSheet } from '../components/QuickForms';
import { useActiveSession, useSessions, useSettings, useSyncStatus, useToday, go } from '../lib/hooks';
import { currentStreak, planForDay, projectAgenda, weeklyCounts, type AgendaDay } from '../lib/schedule';
import { movesFor, swapsFor } from '../lib/plans';
import { ACTIVITY_LABEL, logActivity, sessionLabel, sessionShort } from '../lib/activities';
import { removePlannedActivity } from '../lib/plans';
import { addDays, diffDays, dowLetter, fmtDate, fmtDuration, weekday, dowName } from '../lib/dates';
import { DAYS, DESK_RESET, LIFT_ORDER, type DayId } from '../plan/days';
import { SAFETY } from '../plan/content';
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
  const plans = useLiveQuery(() => db.plans.filter((p) => !p.deleted).toArray(), []) ?? [];
  const todayPlan = plans.find((p) => p.date === today);
  const plan = planForDay(today, settings, sessions, plans);
  const agenda = projectAgenda(today, 7, settings, sessions, plans);
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
    await startSession(type, settings.startDate, today, swapsFor(todayPlan, type), movesFor(todayPlan, type), todayPlan?.order?.[type]);
    go('workout');
  };

  const sessionToday = sessions.find((s) => s.date === today && s.status === 'done' && (plan.lift ? s.type === plan.lift : plan.kind === 'dayD' ? s.type === 'D' : false));

  return (
    <div>
      <header className="flex items-center justify-between pt-1 pb-2">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          {fmtDate(today)}
          {sync.state !== 'local' && (
            <span className={`h-1.5 w-1.5 rounded-full ${sync.state === 'live' ? 'bg-good' : sync.state === 'error' ? 'bg-bad' : 'bg-faint'}`} title={sync.state} />
          )}
        </div>
        <button type="button" onClick={() => go('settings')} aria-label="Settings" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-card2">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></svg>
        </button>
      </header>

      <DataStrip pos={pos} startDate={settings.startDate} dunkTarget={settings.dunkTarget} jumps={jumps} jumpTarget={tgt} sessions={sessions} today={today} />

      <Card className="mt-3">
        {active ? (
          <>
            <div className="font-display text-[28px] leading-tight">{active.type in DAYS ? `${DAYS[active.type as DayId].title} in progress` : 'Session in progress'}</div>
            <p className="text-sm text-muted">Everything is saved as you go.</p>
            <Button kind="primary" big className="mt-3 w-full" onClick={() => go('workout')}>Resume workout</Button>
          </>
        ) : plan.kind === 'lift' && plan.lift ? (
          sessionToday ? (
            <DoneCard title={DAYS[plan.lift].title} duration={sessionToday.endedAt ? sessionToday.endedAt - sessionToday.startedAt : 0} next={`Next: ${DAYS[plan.next].title}`} />
          ) : (
            <>
              <div className="font-display text-[32px] leading-tight">{DAYS[plan.lift].title}</div>
              <div className="text-muted">{DAYS[plan.lift].subtitle}</div>
              {pos.started && <div className="mt-1 text-xs text-accent">{pos.phase.effort}</div>}
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
            <DoneCard title={DAYS.D.title} duration={sessionToday.endedAt ? sessionToday.endedAt - sessionToday.startedAt : 0} next={`Next lift: ${DAYS[plan.next].title}`} />
          ) : (
            <>
              <div className="flex items-center gap-2"><span className="font-display text-[32px] leading-tight">{DAYS.D.title}</span><Pill>Optional</Pill></div>
              <div className="text-muted">{DAYS.D.subtitle}</div>
              <Button kind="primary" big className="mt-3 w-full" onClick={() => begin('D')}>Start workout</Button>
              {pos.week >= 9 && pos.week <= 12 && <Button className="mt-2 w-full" onClick={() => setSheet('pickup')}>Played pickup instead</Button>}
            </>
          )
        ) : plan.kind === 'rehab' ? (
          sessions.some((s) => s.date === today && s.type === 'R' && s.status === 'done') ? (
            <DoneCard title={DAYS.R.title} duration={0} next={`Next lift: ${DAYS[plan.next].title}`} />
          ) : (
            <>
              <div className="flex items-center gap-2"><span className="font-display text-[32px] leading-tight">{DAYS.R.title}</span><Pill>Optional</Pill></div>
              <div className="text-muted">{DAYS.R.subtitle}</div>
              <Button kind="primary" big className="mt-3 w-full" onClick={() => begin('R')}>Start workout</Button>
            </>
          )
        ) : plan.kind === 'cardio' ? (
          <>
            <div className="flex items-center gap-2"><span className="font-display text-[32px] leading-tight">Easy cardio</span><Pill>Optional</Pill></div>
            <p className="mt-1 text-sm text-muted">
              {plan.cardioSuggested ? 'Incline walk, bike or rower, 30–40 min. Talking pace.' : `Skip cardio today — tomorrow is ${plan.next === 'A' ? DAYS.A.title : DAYS.D.title} and you want fresh legs. A walk with the dog is plenty.`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button kind={plan.cardioSuggested ? 'primary' : 'secondary'} onClick={() => setSheet('cardio')}>Log cardio</Button>
              <Button onClick={() => setSheet('dog')}>Dog walk</Button>
            </div>
            <p className="mt-3 text-xs text-faint">Next lift: {DAYS[plan.next].title} · plus the 5-minute desk reset below.</p>
          </>
        ) : (
          <>
            <div className="font-display text-[32px] leading-tight">{plan.kind === 'bloodDraw' ? 'Mobility + walking' : 'Rest day'}</div>
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
        <button type="button" className="min-h-11 w-full text-sm text-faint active:text-ink" onClick={() => go(`day/${today}`)}>
          {plan.overridden ? 'Today was changed · edit or add' : 'Add to or change today'}
        </button>
      </Card>

      {(todayPlan?.activities ?? []).map((act) => (
        <Card key={act.key} className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Planned today</div>
              <div className="font-display text-[26px] leading-tight">{act.label ?? ACTIVITY_LABEL[act.type] ?? act.type}</div>
              <div className="text-sm text-muted">{act.minutes} min</div>
            </div>
            <Button kind="primary" onClick={async () => {
              await logActivity({ date: today, type: act.type, minutes: act.minutes, label: act.label, startDate: settings.startDate });
              await removePlannedActivity(today, act.key);
            }}>Log it</Button>
          </div>
        </Card>
      ))}

      {plan.extra.map((t, i) => (
        <Card key={i} className="mt-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Also today</div>
          <div className="font-display text-[26px] leading-tight">{sessionLabel(t)}</div>
          <div className="text-sm text-muted">{t in DAYS ? DAYS[t as DayId].subtitle : 'Desk reset and the hip flexor routine'}</div>
          {!sessions.some((x) => x.date === today && x.type === t && x.status === 'done') && (
            <Button className="mt-3 w-full" onClick={() => begin(t as SessionType)}>{active ? 'Resume workout' : 'Start this workout'}</Button>
          )}
        </Card>
      ))}

      <TargetsCard date={today} settings={settings} canLog />

      {/* alerts, one line each; tap for details */}
      {(plan.kind === 'bloodDraw' || halved || plan.testDay) && (
        <div className="mt-3 space-y-2">
          {plan.kind === 'bloodDraw' && (
            <Alert tone="warn" title={`Blood draw ${plan.bloodDrawIn === 0 ? 'today' : `in ${plan.bloodDrawIn} day${plan.bloodDrawIn === 1 ? '' : 's'}`}`}>{SAFETY.bloodDraw}</Alert>
          )}
          {halved && (
            <Alert tone="warn" title="Jump volume halved this week">
              {tendon?.stiff ? 'Knee or Achilles stiffness lasted past the warm-up.' : `Knee pain ${tendon?.knee ?? 0}, Achilles ${tendon?.achilles ?? 0} out of 10 this week.`} {SAFETY.tendons} Half the jump sets keeps you jumping while the tendon calms down.
            </Alert>
          )}
          {plan.testDay && (
            <Alert tone="info" title="Test day: standing vertical + approach touch">
              After the warm-up: standing vertical (3 tries) and approach touch (3 tries).{settings.standingReach ? '' : ' Set your standing reach in Settings first.'}
            </Alert>
          )}
        </div>
      )}

      {/* this week */}
      <SectionTitle right={<button type="button" onClick={() => go('plan')} className="min-h-8 px-1 text-xs text-accent">Schedule ›</button>}>This week</SectionTitle>
      <WeekStrip weekStart={weekStart} today={today} agenda={agenda} sessions={sessions} cardioDates={cardioWeek.map((c) => c.date)} liftDays={settings.liftDays} />

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
        <div className="font-display text-2xl">{title} done</div>
        <div className="text-sm text-muted">{duration ? fmtDuration(duration) + ' · ' : ''}{next}</div>
      </div>
    </div>
  );
}

function WeekStrip({ weekStart, today, liftDays, agenda, sessions, cardioDates }: { weekStart: string; today: string; liftDays: number[]; agenda: AgendaDay[]; sessions: { date: string; type: string; status: string }[]; cardioDates: string[] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const wd = weekday(d);
        const li = liftDays.indexOf(wd);
        const ag = agenda.find((a) => a.date === d);
        const plannedType = ag ? (ag.kind === 'lift' ? ag.lift! : ag.kind === 'dayD' ? 'D' : null) : li >= 0 ? LIFT_ORDER[li] : wd === 0 || wd === 6 ? 'D' : null;
        const plannedLabel = plannedType ? DAYS[plannedType].short : '·';
        const isLift = ag ? ag.kind === 'lift' : li >= 0;
        const done = sessions.filter((s) => s.date === d && s.status === 'done' && s.type !== 'mobility');
        const cardio = cardioDates.includes(d);
        const isToday = d === today;
        return (
          <button type="button" key={d} onClick={() => go(`day/${d}`)} className={`flex flex-col items-center rounded-xl py-2 active:bg-card2 ${isToday ? 'bg-card2 ring-1 ring-accent/60' : 'bg-card'}`} title={dowName(wd)}>
            <div className="text-[11px] text-faint">{dowLetter(wd)}</div>
            <div className={`mt-1.5 flex h-7 w-full max-w-[46px] items-center justify-center rounded-full px-0.5 text-[8.5px] font-medium uppercase tracking-[0.04em] ${done.length ? 'bg-accent text-accent-ink' : isLift ? 'bg-card2 text-ink' : plannedType ? 'text-muted' : 'text-faint'}`}>
              {done.length ? sessionShort(done[0].type) : plannedLabel}
            </div>
            <div className="mt-1 flex h-1.5 gap-0.5">
              {cardio && <div className="h-1.5 w-1.5 rounded-full bg-info" />}
              {ag?.overridden && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SessionPicker({ open, onClose, onPick, week }: { open: boolean; onClose: () => void; onPick: (t: SessionType | 'cardio' | 'pickup') => void; week: number }) {
  const opts: { t: SessionType | 'cardio' | 'pickup'; title: string; sub: string; optional?: boolean }[] = [
    ...(['A', 'B', 'C'] as DayId[]).map((d) => ({ t: d, title: DAYS[d].title, sub: DAYS[d].subtitle })),
    { t: 'D', title: DAYS.D.title, sub: DAYS.D.subtitle, optional: true },
    { t: 'R', title: DAYS.R.title, sub: DAYS.R.subtitle, optional: true },
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

/** Four numbers in one row: where you are, how close the dunk is, jump volume, consistency. */
function DataStrip({ pos, startDate, dunkTarget, jumps, jumpTarget, sessions, today }: {
  pos: ReturnType<typeof planForDay>['pos'];
  startDate: string;
  dunkTarget: number;
  jumps: number;
  jumpTarget: [number, number];
  sessions: { date: string; type: string; status: 'active' | 'done'; deleted?: boolean }[];
  today: string;
}) {
  const best = useLiveQuery(async () => {
    const tests = await db.tests.filter((t) => !t.deleted).toArray();
    const sets = await db.sets.where('exerciseId').equals('approach-jump').filter((x) => !x.deleted && x.done && !!x.touchIn).toArray();
    const all = [...tests.flatMap((t) => t.approach), ...sets.map((x) => x.touchIn!)];
    return all.length ? Math.max(...all) : null;
  }, []);
  const toGo = best ? Math.max(0, dunkTarget - best) : null;
  const streak = currentStreak(weeklyCounts(startDate, sessions, today));
  const cell = 'flex min-w-0 flex-1 flex-col items-start px-3 py-2.5';
  const label = 'text-[9.5px] font-medium uppercase tracking-[0.16em] text-muted';
  const value = 'font-display text-[26px] leading-none mt-1';
  const sub = 'mt-1 truncate text-[10.5px] text-faint w-full';
  return (
    <button type="button" onClick={() => go('trends')} className="hairline flex w-full divide-x divide-line rounded-[20px] bg-card text-left active:bg-card2">
      <div className={cell}>
        <span className={label}>{pos.started ? 'Week' : 'Starts'}</span>
        <span className={value}>{pos.started ? pos.week : pos.daysUntilStart}</span>
        <span className={sub}>{pos.started ? pos.phase.name : pos.daysUntilStart === 1 ? 'day' : 'days'}</span>
      </div>
      <div className={cell}>
        <span className={label}>Dunk</span>
        <span className={`${value} ${toGo === 0 ? 'text-good' : 'text-accent'}`}>{toGo === null ? '—' : toGo === 0 ? '✓' : `${toGo % 1 ? toGo.toFixed(1) : toGo}″`}</span>
        <span className={sub}>{toGo === null ? 'log a touch' : toGo === 0 ? 'target hit' : 'to go'}</span>
      </div>
      <div className={cell}>
        <span className={label}>Jumps</span>
        <span className={value}>{jumps}</span>
        <span className={sub}>{jumpTarget[1] ? `of ${jumpTarget[0]}–${jumpTarget[1]}` : 'test week'}</span>
      </div>
      <div className={cell}>
        <span className={label}>Streak</span>
        <span className={value}>{streak}</span>
        <span className={sub}>{streak === 1 ? 'week' : 'weeks'} at 3+</span>
      </div>
    </button>
  );
}

function Alert({ tone, title, children }: { tone: 'warn' | 'info'; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen(!open)} className={`hairline w-full rounded-2xl bg-card px-4 py-2.5 text-left ${tone === 'warn' ? 'border-warn/30' : 'border-info/30'}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'warn' ? 'bg-warn' : 'bg-info'}`} />
        <span className={`min-w-0 flex-1 truncate text-sm ${tone === 'warn' ? 'text-warn' : 'text-info'}`}>{title}</span>
        <span className="text-xs text-faint">{open ? '−' : '+'}</span>
      </div>
      {open && <p className="mt-1.5 text-sm text-muted">{children}</p>}
    </button>
  );
}
