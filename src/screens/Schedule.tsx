/* The agenda: every upcoming day for the next few weeks. Tap a day to see its moves or change it. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Pill } from '../components/ui';
import { back, go, useSessions, useSettings, useToday } from '../lib/hooks';
import { db } from '../lib/db';
import { projectAgenda, type AgendaDay } from '../lib/schedule';
import { addDays, dowShort, fmtShort } from '../lib/dates';
import { agendaSub, agendaTitle } from './DayView';
import { ACTIVITY_LABEL, sessionLabel } from '../lib/activities';

export default function Schedule() {
  const settings = useSettings();
  const today = useToday();
  const sessions = useSessions();
  const plans = useLiveQuery(() => db.plans.filter((p) => !p.deleted).toArray(), []) ?? [];
  const [weeks, setWeeks] = useState(4);
  const agenda = projectAgenda(today, weeks * 7, settings, sessions, plans);

  // group by program week
  const groups: { key: string; label: string; days: AgendaDay[] }[] = [];
  for (const d of agenda) {
    const key = `${d.pos.cycle}-${d.pos.week}-${d.pos.started}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const end = addDays(d.pos.weekStart, 6);
      groups.push((g = { key, label: d.pos.started ? `Week ${d.pos.week} · ${d.pos.phase.name} · ${fmtShort(d.pos.weekStart)}–${end.slice(5, 7) === d.pos.weekStart.slice(5, 7) ? Number(end.slice(8)) : fmtShort(end)}` : 'Before the program starts', days: [] }));
    }
    g.days.push(d);
  }

  return (
    <div>
      <div className="flex items-center gap-1 pt-1">
        <button type="button" onClick={back} className="-ml-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-3xl leading-none text-muted active:bg-card2" aria-label="Back">‹</button>
        <h1 className="font-display text-[34px] leading-tight">Schedule</h1>
      </div>
      <p className="mt-1 text-sm text-muted">What's coming up. Tap a day to see its moves, swap one, change the workout or add another.</p>

      {groups.map((g) => (
        <section key={g.key} className="mt-6">
          <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{g.label}</h2>
          <div className="divide-y divide-line overflow-hidden hairline rounded-[20px] bg-card">
            {g.days.map((d) => {
              const done = sessions.some((s) => s.date === d.date && s.status === 'done' && s.type !== 'mobility');
              const isToday = d.date === today;
              const strong = d.kind === 'lift' || d.kind === 'dayD';
              return (
                <button key={d.date} type="button" onClick={() => go(`day/${d.date}`)} className="flex min-h-[60px] w-full items-center gap-3 px-3 py-2 text-left active:bg-card2">
                  <span className={`flex w-11 shrink-0 flex-col items-center leading-tight ${isToday ? 'text-accent' : 'text-muted'}`}>
                    <span className="text-[10px] uppercase tracking-[0.14em]">{isToday ? 'Today' : dowShort(d.date)}</span>
                    <span className="font-display text-xl">{Number(d.date.slice(8))}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`truncate ${strong ? 'text-[15px] text-ink' : 'text-sm text-muted'}`}>{agendaTitle(d)}</span>
                      {d.overridden && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="changed" />}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {strong ? agendaSub(d) : d.optional ? 'Optional' : ''}
                      {d.extra.length > 0 && ` · + ${d.extra.map((e) => sessionLabel(e)).join(', ')}`}
                      {(plans.find((p) => p.date === d.date)?.activities ?? []).map((a) => ` · + ${a.label ?? ACTIVITY_LABEL[a.type] ?? a.type} ${a.minutes}′`).join('')}
                    </span>
                  </span>
                  {d.testDay && <Pill tone="info">Test</Pill>}
                  {done && <span className="text-good">✓</span>}
                  <span className="text-faint">›</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <Button className="mt-4 w-full" onClick={() => setWeeks(weeks + 4)}>Show 4 more weeks</Button>
    </div>
  );
}
