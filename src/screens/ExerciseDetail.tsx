import { useLiveQuery } from 'dexie-react-hooks';
import { Card, SectionTitle } from '../components/ui';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { LineChart, CHART } from '../components/Charts';
import { formatSet } from '../components/workout/ExerciseCard';
import { EXERCISES } from '../plan/exercises';
import { SAFETY } from '../plan/content';
import { db, type SetLog } from '../lib/db';
import { back, useSettings } from '../lib/hooks';
import { epley } from '../lib/progression';
import { fmtShort } from '../lib/dates';
import { toDisplay } from '../lib/units';

export default function ExerciseDetail({ id }: { id: string }) {
  const ex = EXERCISES[id];
  const settings = useSettings();
  const sets = useLiveQuery(() => db.sets.where('exerciseId').equals(id).filter((s) => !s.deleted && s.done).toArray(), [id]) ?? [];
  if (!ex) return <p className="pt-6 text-muted">Exercise not found.</p>;

  const weighted = ex.log.includes('weight') && ex.log.includes('reps') && sets.some((s) => (s.weight ?? 0) > 0);
  const bySession = new Map<string, SetLog[]>();
  for (const s of sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  const sessions = [...bySession.values()].map((l) => l.sort((a, b) => a.idx - b.idx)).sort((a, b) => (a[0].date < b[0].date ? 1 : -1));
  const e1rm = sessions
    .map((l) => ({ date: l[0].date, y: Math.max(...l.map((s) => epley(s.weight ?? 0, s.reps ?? 0))) }))
    .filter((p) => p.y > 0)
    .map((p) => ({ ...p, y: toDisplay(p.y, settings.units)! }));
  const metric = (s: SetLog) =>
    weighted ? epley(s.weight ?? 0, s.reps ?? 0) : s.touchIn ?? s.distanceIn ?? s.boxIn ?? s.seconds ?? s.meters ?? s.makes ?? s.rounds ?? s.reps ?? 0;
  const best = sets.length ? sets.reduce((a, b) => (metric(b) > metric(a) ? b : a)) : null;

  return (
    <div>
      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={back} className="min-h-11 min-w-11 rounded-full text-2xl text-muted active:bg-card2" aria-label="Back">‹</button>
        <h1 className="text-xl font-bold leading-tight">{ex.name}</h1>
      </div>
      <div className="mt-2">
        <ExerciseInfo ex={ex} />
      </div>

      <SectionTitle>My history</SectionTitle>
      {!sets.length ? (
        <Card><p className="text-sm text-muted">No sets logged yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {best && (
            <Card>
              <div className="text-xs text-muted">Best set</div>
              <div className="tnum text-xl font-semibold">{formatSet(best, ex.log, settings.units)}</div>
              <div className="text-xs text-faint">{fmtShort(best.date)}{weighted ? ` · est. 1RM ${toDisplay(epley(best.weight ?? 0, best.reps ?? 0), settings.units)?.toFixed(0)} ${settings.units}` : ''}</div>
            </Card>
          )}
          {weighted && (
            <Card>
              <div className="mb-1 text-sm text-muted">Estimated 1-rep max (Epley)</div>
              <LineChart series={[{ points: e1rm, color: CHART.accent, label: 'Est. 1RM' }]} yFmt={(v) => `${Math.round(v)}`} />
            </Card>
          )}
          <Card>
            <div className="mb-2 text-sm text-muted">Recent sessions</div>
            <ul className="space-y-2 text-sm">
              {sessions.slice(0, 8).map((l) => (
                <li key={l[0].sessionId} className="flex gap-3">
                  <span className="w-14 shrink-0 text-muted">{fmtShort(l[0].date)}</span>
                  <span className="tnum">{l.map((s) => formatSet(s, ex.log, settings.units)).join(', ')}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      <p className="mt-6 text-center text-xs text-faint">{SAFETY.footer}</p>
    </div>
  );
}
