import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Pill, SectionTitle, Segmented, toast } from '../components/ui';
import { BarChart, CHART, LineChart } from '../components/Charts';
import { db } from '../lib/db';
import { useSettings, useToday } from '../lib/hooks';
import { addDays, fmtShort } from '../lib/dates';
import { fmtFtIn, toDisplay } from '../lib/units';
import { saveSettings } from '../lib/store';
import { currentStreak, programPosition, weeklyCounts } from '../lib/schedule';
import { phaseForWeek, CYCLE_WEEKS } from '../plan/phases';
import { DAYS, type DayId } from '../plan/days';
import { EXERCISES } from '../plan/exercises';
import { LABS, NUTRITION } from '../plan/content';
import {
  bestPerDay, byDate, cardioByWeek, doneSessions, e1rmSeries, inWeek, rateStatus, relative, standingVertical, touchSeries, weekBuckets, weightSeries,
} from '../lib/trends';

const MAIN_LIFTS = ['trap-bar-deadlift', 'rfess', 'safety-bar-squat', 'hk-landmine-press', 'db-bench-neutral', 'chest-supported-row'];
const COLORS6 = [CHART.accent, CHART.blue, CHART.green, CHART.yellow, CHART.purple, CHART.red];

export default function Trends() {
  const settings = useSettings();
  const today = useToday();
  const [range, setRange] = useState<'4w' | '12w' | 'all'>('12w');
  const from = range === '4w' ? addDays(today, -28) : range === '12w' ? addDays(today, -84) : undefined;
  const inRange = <T extends { date: string }>(x: T) => !from || x.date >= from;

  const data = useLiveQuery(async () => {
    const [body, sessions, sets, cardio, tests, labs] = await Promise.all([
      db.body.filter((x) => !x.deleted).toArray(),
      db.sessions.filter((x) => !x.deleted).toArray(),
      db.sets.filter((x) => !x.deleted && x.done).toArray(),
      db.cardio.filter((x) => !x.deleted).toArray(),
      db.tests.filter((x) => !x.deleted).toArray(),
      db.labs.filter((x) => !x.deleted).toArray(),
    ]);
    return { body, sessions, sets, cardio, tests, labs };
  }, []);
  if (!data) return <p className="pt-6 text-muted">Loading…</p>;

  const u = settings.units;
  const conv = (pts: { date: string; y: number }[]) => pts.map((p) => ({ ...p, y: toDisplay(p.y, u)! }));
  const sets = data.sets;
  const sessions = doneSessions(data.sessions);

  /* dunk */
  const touches = touchSeries(data.tests, sets);
  const bestTouch = touches.length ? Math.max(...touches.map((t) => t.y)) : null;
  const toGo = bestTouch !== null ? Math.max(0, settings.dunkTarget - bestTouch) : null;
  const standing = standingVertical(data.tests, settings.standingReach);

  /* weight */
  const { days, avg } = weightSeries(data.body);
  const rate = rateStatus(days, today);
  const goal = settings.goalWeight;
  const waist = data.body.filter((b) => b.waist !== undefined).map((b) => ({ date: b.date, y: b.waist! })).sort(byDate);

  /* weeks */
  const weeks = weekBuckets(settings.startDate, today, from);
  const started = programPosition(settings.startDate, today).started;
  const weekLabel = (w: { start: string }) => fmtShort(w.start);
  const jumpsPerWeek = weeks.map((w) => {
    let n = 0;
    for (const s of sets) if (inWeek(s.date, w.start) && EXERCISES[s.exerciseId]?.jump) n += s.reps ?? 0;
    for (const s of sessions) if (inWeek(s.date, w.start)) n += s.dunks?.length ?? 0;
    return n;
  });
  const curPhase = phaseForWeek((Math.max(0, weeks[weeks.length - 1]?.index ?? 0) % CYCLE_WEEKS) + 1);
  const counts = weeklyCounts(settings.startDate, sessions, today);
  const streak = currentStreak(counts);
  const totalSessions = sessions.filter((s) => ['A', 'B', 'C', 'D', 'pickup'].includes(s.type)).length;

  /* strength */
  const lifts = MAIN_LIFTS.map((id, i) => ({ id, name: EXERCISES[id]?.name ?? id, color: COLORS6[i], pts: e1rmSeries(sets, id).filter(inRange) })).filter((l) => l.pts.length);
  const dl = e1rmSeries(sets, 'trap-bar-deadlift');
  const sq = e1rmSeries(sets, 'safety-bar-squat');
  const relDl = relative(dl, avg.length ? avg : days).filter(inRange);
  const relSq = relative(sq, avg.length ? avg : days).filter(inRange);

  /* conditioning, shooting, pain */
  const rounds = bestPerDay(sets, ['bike-intervals', 'rower-intervals', 'jump-rope-intervals'], (s) => s.rounds).filter(inRange);
  const suicides = bestPerDay(sets, ['suicides'], (s) => s.seconds && -s.seconds).map((p) => ({ ...p, y: -p.y })).filter(inRange);
  const seventeens = bestPerDay(sets, ['seventeens'], (s) => s.seconds && -s.seconds).map((p) => ({ ...p, y: -p.y })).filter(inRange);
  const shotPct = (ids: string[]) => {
    const m = new Map<string, { made: number; att: number }>();
    for (const s of sets) {
      if (!ids.includes(s.exerciseId) || s.makes === undefined) continue;
      const [d, key] = s.slotKey.split(':');
      const item = DAYS[d as DayId]?.items.find((i) => i.key === key);
      const att = item?.rx(1)?.makes ?? 10;
      const cur = m.get(s.date) ?? { made: 0, att: 0 };
      m.set(s.date, { made: cur.made + s.makes, att: cur.att + att });
    }
    return [...m.entries()].map(([date, v]) => ({ date, y: Math.round((v.made / v.att) * 100) })).sort(byDate).filter(inRange);
  };
  const spots = shotPct(['spot-shooting']);
  const fts = shotPct(['free-throws']);
  const painPts = (k: 'shoulder' | 'hamstring' | 'knee' | 'achilles') => sessions.filter((s) => s.pain?.[k] !== undefined).map((s) => ({ date: s.date, y: s.pain![k]! })).filter(inRange);
  const overhead = sessions.filter((s) => s.overhead !== undefined).map((s) => ({ date: s.date, y: s.overhead! })).filter(inRange);
  const cardio = cardioByWeek(data.cardio, weeks);

  return (
    <div>
      <h1 className="pt-2 text-2xl font-bold">Trends</h1>
      <Segmented
        className="mt-3"
        options={[{ value: '4w', label: '4 weeks' }, { value: '12w', label: '12 weeks' }, { value: 'all', label: 'All time' }]}
        value={range}
        onChange={setRange}
      />

      <SectionTitle>Dunk tracker</SectionTitle>
      <Card className="border border-accent/30">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-muted">Best approach touch</div>
            <div className="tnum text-3xl font-black">{bestTouch !== null ? `${bestTouch}″` : '—'}</div>
            {bestTouch !== null && <div className="text-xs text-faint">{fmtFtIn(bestTouch)} · target {fmtFtIn(settings.dunkTarget)}</div>}
          </div>
          <div className="text-right">
            {toGo !== null ? (
              toGo === 0 ? <div className="text-xl font-bold text-good">Target reached 🏀</div> : (
                <>
                  <div className="tnum text-3xl font-black text-accent">{toGo % 1 ? toGo.toFixed(1) : toGo}″</div>
                  <div className="text-xs text-muted">to go</div>
                </>
              )
            ) : (
              <div className="text-sm text-muted">Log a test day or approach jumps</div>
            )}
          </div>
        </div>
        <div className="mt-3">
          <LineChart series={[{ points: touches.filter(inRange), color: CHART.accent, label: 'Approach touch (in)' }]} refs={[{ y: settings.dunkTarget, label: `${settings.dunkTarget}″ dunk`, color: CHART.green }]} />
        </div>
        <div className="mt-3 text-sm text-muted">Standing vertical (test days)</div>
        <LineChart series={[{ points: standing.filter(inRange), color: CHART.blue, label: 'Standing vertical (in)' }]} height={120} empty={settings.standingReach ? 'No test days yet' : 'Set standing reach in Settings'} />
      </Card>

      <SectionTitle>Body weight</SectionTitle>
      <Card>
        <div className={`text-sm font-semibold ${rate.tone === 'good' ? 'text-good' : rate.tone === 'warn' ? 'text-warn' : 'text-muted'}`}>{rate.text}</div>
        {rate.adjust !== 0 && (
          <div className="mt-2 rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm">
            <p>
              {rate.adjust < 0 ? 'Under 0.5 lb/week for 2 straight weeks.' : 'Over 1.5 lb/week for 2 straight weeks.'} The plan says {rate.adjust < 0 ? 'eat 150 fewer' : 'eat 150 more'} calories a day:{' '}
              <b>{(settings.calories + rate.adjust).toLocaleString()}</b>.
            </p>
            <Button
              kind="primary"
              className="mt-2"
              onClick={async () => {
                await saveSettings({ calories: settings.calories + rate.adjust });
                toast(`Calories set to ${(settings.calories + rate.adjust).toLocaleString()}`);
              }}
            >
              Set calories to {(settings.calories + rate.adjust).toLocaleString()}
            </Button>
          </div>
        )}
        <div className="mt-2">
          <LineChart
            series={[
              { points: conv(days.filter(inRange)), color: CHART.blue, label: 'Weigh-in', line: false },
              { points: conv(avg.filter(inRange)), color: CHART.accent, label: '7-day average', dots: false },
            ]}
            band={[toDisplay(goal - 2.5, u)!, toDisplay(goal + 2.5, u)!]}
            yFmt={(v) => `${Math.round(v)}`}
          />
          <div className="mt-1 text-xs text-faint">Green band: goal {toDisplay(goal, u)} {u} ± 2.5 · target loss 0.5–1 lb/week · ~{settings.calories.toLocaleString()} kcal, {NUTRITION.protein[0]}–{NUTRITION.protein[1]} g protein</div>
        </div>
      </Card>

      <SectionTitle>Waist</SectionTitle>
      <Card><LineChart series={[{ points: waist.filter(inRange), color: CHART.purple, label: 'Waist (in)' }]} height={130} /></Card>

      <SectionTitle>Jump output</SectionTitle>
      <Card>
        <Row label="Best box jump" value={best(bestPerDay(sets, ['box-jump'], (s) => s.boxIn), (v) => `${v}″`)} />
        <Row label="Best broad jump" value={best(bestPerDay(sets, ['broad-jump'], (s) => s.distanceIn), fmtFtIn)} />
        <div className="mt-3 text-sm text-muted">Box height</div>
        <LineChart series={[{ points: bestPerDay(sets, ['box-jump', 'single-leg-box-jump', 'seated-box-jump'], (s) => s.boxIn).filter(inRange), color: CHART.accent, label: 'Box (in)' }]} height={120} />
        <div className="mt-3 text-sm text-muted">Broad jump</div>
        <LineChart series={[{ points: bestPerDay(sets, ['broad-jump'], (s) => s.distanceIn).filter(inRange), color: CHART.blue, label: 'Broad jump (in)' }]} height={120} />
        <div className="mt-3 text-sm text-muted">Jumps per week · target {curPhase.jumpTarget[0]}–{curPhase.jumpTarget[1]} ({curPhase.name})</div>
        {started ? <BarChart bars={weeks.map((w, i) => ({ label: weekLabel(w), values: [jumpsPerWeek[i]] }))} colors={[CHART.accent]} target={curPhase.jumpTarget[1] ? curPhase.jumpTarget : undefined} /> : <Empty />}
      </Card>

      <SectionTitle>Strength (estimated 1-rep max)</SectionTitle>
      <Card>
        {lifts.length ? (
          <div className="space-y-4">
            {lifts.map((l) => (
              <div key={l.id}>
                <div className="flex justify-between text-sm"><span>{l.name}</span><span className="tnum text-muted">{Math.round(toDisplay(l.pts[l.pts.length - 1].y, u)!)} {u}</span></div>
                <LineChart series={[{ points: conv(l.pts), color: l.color, label: l.name }]} height={110} yFmt={(v) => `${Math.round(v)}`} />
              </div>
            ))}
          </div>
        ) : <Empty text="Log a main lift to see its trend." />}
        <div className="mt-4 text-sm text-muted">Relative to body weight — this is what moves your vertical</div>
        <LineChart
          series={[
            { points: relDl, color: CHART.accent, label: 'Trap bar deadlift × BW' },
            { points: relSq, color: CHART.blue, label: 'Safety bar squat × BW' },
          ]}
          height={130}
          yFmt={(v) => `${v.toFixed(1)}×`}
          empty="Needs a main lift and a weigh-in"
        />
      </Card>

      <SectionTitle>Cardio</SectionTitle>
      <Card>
        <div className="text-sm text-muted">Easy cardio minutes per week</div>
        {started ? (
          <BarChart bars={weeks.map((w, i) => ({ label: weekLabel(w), values: cardio[i] }))} colors={[CHART.accent, CHART.blue, CHART.purple, CHART.yellow, CHART.green]} labels={['Incline walk', 'Bike', 'Rower', 'Other', 'Dog walk']} yFmt={(v) => `${Math.round(v)}`} />
        ) : <Empty />}
      </Card>

      <SectionTitle>Consistency</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Streak (weeks with 3+)" value={`${streak}`} />
          <Stat label="Total sessions" value={`${totalSessions}`} />
        </div>
        <div className="mt-3 text-sm text-muted">Sessions per week</div>
        {started ? <BarChart bars={weeks.map((w) => ({ label: weekLabel(w), values: [counts[w.index] ?? 0] }))} colors={[CHART.green]} target={3} /> : <Empty />}
      </Card>

      <SectionTitle>Conditioning</SectionTitle>
      <Card>
        <div className="text-sm text-muted">Bike interval rounds per session</div>
        <LineChart series={[{ points: rounds, color: CHART.accent, label: 'Rounds' }]} height={120} />
        <div className="mt-3 text-sm text-muted">Day D court conditioning (best time, s)</div>
        <LineChart series={[{ points: suicides, color: CHART.blue, label: 'Suicide' }, { points: seventeens, color: CHART.yellow, label: '17s' }]} height={120} refs={seventeens.length ? [{ y: 70, label: '70 s', color: CHART.green }] : []} />
      </Card>

      <SectionTitle>Shooting (Day D)</SectionTitle>
      <Card>
        <LineChart series={[{ points: spots, color: CHART.accent, label: 'Spot shooting %' }, { points: fts, color: CHART.blue, label: 'Free throws %' }]} yFmt={(v) => `${Math.round(v)}%`} height={140} />
      </Card>

      <SectionTitle>Pain</SectionTitle>
      <Card>
        <LineChart
          series={[
            { points: painPts('shoulder'), color: CHART.accent, label: 'Shoulder' },
            { points: overhead, color: CHART.purple, label: 'Overhead restriction', dashed: true },
            { points: painPts('hamstring'), color: CHART.blue, label: 'Hamstring' },
            { points: painPts('knee'), color: CHART.yellow, label: 'Knee' },
            { points: painPts('achilles'), color: CHART.red, label: 'Achilles' },
          ]}
          refs={[{ y: 3, label: '3 = limit', color: CHART.red }]}
          yFmt={(v) => `${Math.round(v)}`}
          height={160}
        />
      </Card>

      <SectionTitle>Labs</SectionTitle>
      <div className="space-y-3">
        {LABS.map((l) => {
          const pts = data.labs.filter((x) => x[l.key] !== undefined).map((x) => ({ date: x.date, y: x[l.key]! })).sort(byDate);
          if (!pts.length) return null;
          const last = pts[pts.length - 1].y;
          return (
            <Card key={l.key}>
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">{l.label}</div>
                <div className="text-sm">
                  <span className="tnum font-semibold">{last}</span> <span className="text-muted">{l.unit}</span>{' '}
                  {l.target && <Pill tone="muted">goal {l.target.op} {l.target.value}</Pill>}
                </div>
              </div>
              <LineChart series={[{ points: pts, color: CHART.accent, label: l.label }]} refs={l.target ? [{ y: l.target.value, label: `${l.target.op} ${l.target.value}` }] : []} height={110} />
            </Card>
          );
        })}
        {!data.labs.length && <Card><Empty text="Add blood work in Body → Labs." /></Card>}
      </div>
    </div>
  );
}

function best(pts: { y: number }[], fmt: (v: number) => string) {
  return pts.length ? fmt(Math.max(...pts.map((p) => p.y))) : '—';
}
function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex justify-between py-1 text-sm"><span className="text-muted">{label}</span><span className="tnum font-semibold">{value}</span></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-card2 p-3"><div className="text-xs text-muted">{label}</div><div className="tnum text-2xl font-bold">{value}</div></div>;
}
function Empty({ text = 'Starts once the program begins.' }: { text?: string }) {
  return <div className="flex h-20 items-center justify-center rounded-xl bg-card2 text-sm text-faint">{text}</div>;
}
