/* Past activity: every workout, cardio session and weigh-in, newest first. Tap to edit. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Field, NumInput, Pill, Segmented, Sheet, toast } from '../components/ui';
import { db, type BodyLog, type CardioLog, type Session, type SessionType } from '../lib/db';
import { remove, save } from '../lib/store';
import { go, useSettings, useToday } from '../lib/hooks';
import { addDays, fmtDate, fmtDuration, parseKey } from '../lib/dates';
import { DAYS, type DayId } from '../plan/days';
import { ACTIVITIES, ACTIVITY_LABEL, sessionLabel, sessionShort } from '../lib/activities';
import { createPastSession } from '../lib/workout';
import { fmtWeight, fromDisplay, toDisplay, type Units } from '../lib/units';

type Filter = 'all' | 'workouts' | 'cardio' | 'body';
type Item =
  | { kind: 'session'; date: string; t: number; s: Session; sets: number }
  | { kind: 'cardio'; date: string; t: number; c: CardioLog }
  | { kind: 'body'; date: string; t: number; b: BodyLog };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function History() {
  const settings = useSettings();
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(60);
  const [editCardio, setEditCardio] = useState<CardioLog | null>(null);
  const [editBody, setEditBody] = useState<BodyLog | null>(null);
  const [addPast, setAddPast] = useState(false);

  const data = useLiveQuery(async () => {
    const [sessions, sets, cardio, body] = await Promise.all([
      db.sessions.filter((s) => !s.deleted).toArray(),
      db.sets.filter((s) => !s.deleted && s.done).toArray(),
      db.cardio.filter((c) => !c.deleted).toArray(),
      db.body.filter((b) => !b.deleted).toArray(),
    ]);
    const perSession = new Map<string, number>();
    for (const s of sets) perSession.set(s.sessionId, (perSession.get(s.sessionId) ?? 0) + 1);
    return { sessions, perSession, cardio, body };
  }, []);

  if (!data) return <p className="pt-6 text-muted">Loading…</p>;
  const active = data.sessions.find((s) => s.status === 'active');
  const items: Item[] = [
    ...(filter === 'all' || filter === 'workouts'
      ? data.sessions.filter((s) => s.status === 'done').map((s) => ({ kind: 'session' as const, date: s.date, t: s.startedAt, s, sets: data.perSession.get(s.id) ?? 0 }))
      : []),
    ...(filter === 'all' || filter === 'cardio' ? data.cardio.map((c) => ({ kind: 'cardio' as const, date: c.date, t: c.u, c })) : []),
    ...(filter === 'all' || filter === 'body' ? data.body.map((b) => ({ kind: 'body' as const, date: b.date, t: b.u, b })) : []),
  ].sort((a, b) => (a.date === b.date ? b.t - a.t : a.date < b.date ? 1 : -1));

  // group by month, then by day
  const shown = items.slice(0, limit);
  const groups: { month: string; days: { date: string; items: Item[] }[] }[] = [];
  for (const it of shown) {
    const d = parseKey(it.date);
    const month = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    let g = groups[groups.length - 1];
    if (!g || g.month !== month) groups.push((g = { month, days: [] }));
    let day = g.days[g.days.length - 1];
    if (!day || day.date !== it.date) g.days.push((day = { date: it.date, items: [] }));
    day.items.push(it);
  }

  return (
    <div>
      <div className="flex items-end justify-between pt-2">
        <h1 className="font-display text-[34px] leading-tight">History</h1>
        <div className="flex gap-2">
          <Button onClick={() => go('plan')}>Upcoming</Button>
          <Button onClick={() => setAddPast(true)}>+ Past</Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">Everything you've logged. Tap any entry to change or delete it.</p>
      <Segmented
        className="mt-3"
        options={[{ value: 'all', label: 'All' }, { value: 'workouts', label: 'Workouts' }, { value: 'cardio', label: 'Cardio' }, { value: 'body', label: 'Body' }]}
        value={filter}
        onChange={(f) => { setFilter(f); setLimit(60); }}
      />

      {active && (
        <Card className="mt-4 border border-accent/40" onClick={() => go('workout')}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs tracking-widest text-muted uppercase">In progress</div>
              <div className="font-display text-xl">{active.type in DAYS ? DAYS[active.type as DayId].title : 'Session'}</div>
            </div>
            <span className="text-accent">Resume ›</span>
          </div>
        </Card>
      )}

      {!items.length && (
        <Card className="mt-4">
          <p className="text-sm text-muted">Nothing logged yet. Finished workouts, cardio and weigh-ins show up here.</p>
        </Card>
      )}

      {groups.map((g) => (
        <section key={g.month} className="mt-6">
          <h2 className="mb-2 px-1 text-xs tracking-widest text-muted uppercase">{g.month}</h2>
          <div className="space-y-4">
            {g.days.map((d) => (
              <div key={d.date}>
                <div className="mb-1.5 px-1 text-sm text-faint">{fmtDate(d.date)}</div>
                <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                  {d.items.map((it) => (
                    <Row key={it.kind + (it.kind === 'session' ? it.s.id : it.kind === 'cardio' ? it.c.id : it.b.id)} it={it} units={settings.units}
                      onOpen={() => (it.kind === 'session' ? go(`history/${it.s.id}`) : it.kind === 'cardio' ? setEditCardio(it.c) : setEditBody(it.b))} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {items.length > limit && (
        <Button className="mt-4 w-full" onClick={() => setLimit(limit + 60)}>Show older</Button>
      )}

      {editCardio && <CardioEdit c={editCardio} onClose={() => setEditCardio(null)} />}
      {editBody && <BodyEdit b={editBody} units={settings.units} onClose={() => setEditBody(null)} />}
      {addPast && <AddPast onClose={() => setAddPast(false)} startDate={settings.startDate} />}
    </div>
  );
}

function Row({ it, units, onOpen }: { it: Item; units: Units; onOpen: () => void }) {
  let badge: string, title: string, sub: string;
  if (it.kind === 'session') {
    const s = it.s;
    const day = s.type in DAYS ? DAYS[s.type as DayId] : null;
    badge = sessionShort(s.type);
    title = day ? day.title : sessionLabel(s.type);
    const painMax = Math.max(0, ...Object.values(s.pain ?? {}).map((v) => v ?? 0));
    sub = [
      s.endedAt ? fmtDuration(s.endedAt - s.startedAt) : null,
      s.type === 'pickup' ? `${s.pickup?.minutes ?? 0} min played` : `${it.sets} set${it.sets === 1 ? '' : 's'}`,
      s.dunks?.length ? `${s.dunks.filter((d) => d.made).length}/${s.dunks.length} dunks` : null,
      painMax > 3 ? `pain ${painMax}` : null,
    ].filter(Boolean).join(' · ');
  } else if (it.kind === 'cardio') {
    badge = 'Cardio';
    title = it.c.label ?? ACTIVITY_LABEL[it.c.type] ?? 'Cardio';
    sub = [`${it.c.minutes} min`, it.c.effort, it.c.hr ? `${it.c.hr} bpm` : null].filter(Boolean).join(' · ');
  } else {
    badge = 'Body';
    title = it.b.weight !== undefined ? fmtWeight(it.b.weight, units) : it.b.waist !== undefined ? `Waist ${it.b.waist}″` : 'Body log';
    sub = [it.b.weight !== undefined && it.b.waist !== undefined ? `waist ${it.b.waist}″` : null, it.b.sleep !== undefined ? `${it.b.sleep} h sleep` : null, it.b.protein !== undefined ? `${it.b.protein} g protein` : null, it.b.notes]
      .filter(Boolean).join(' · ');
  }
  return (
    <button type="button" onClick={onOpen} className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left active:bg-card2">
      <span className={`flex h-7 w-[58px] shrink-0 items-center justify-center rounded-full border text-[9px] font-medium uppercase tracking-[0.08em] ${it.kind === 'session' ? 'border-accent/50 text-accent' : 'border-line text-muted'}`}>{badge}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{title}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      <span className="text-faint">›</span>
    </button>
  );
}

function CardioEdit({ c, onClose }: { c: CardioLog; onClose: () => void }) {
  const [v, setV] = useState<CardioLog>(c);
  const set = (k: keyof CardioLog) => (x: number | undefined) => setV((o) => ({ ...o, [k]: x }));
  return (
    <Sheet open onClose={onClose} title="Edit cardio">
      <div className="space-y-3">
        <select className="min-h-11 w-full rounded-xl border border-line bg-card2 px-3" value={v.type} onChange={(e) => setV((o) => ({ ...o, type: e.target.value }))}>
          {ACTIVITIES.filter((a) => a.id !== 'basketball').map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        {v.type === 'other' && <input className="min-h-11 w-full rounded-xl border border-line bg-card2 px-3" placeholder="What was it?" value={v.label ?? ''} onChange={(e) => setV((o) => ({ ...o, label: e.target.value || undefined }))} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className="min-h-11 w-full rounded-xl bg-card2 px-3" value={v.date} onChange={(e) => e.target.value && setV((o) => ({ ...o, date: e.target.value }))} /></Field>
          <Field label="Minutes"><NumInput value={v.minutes} onChange={(x) => setV((o) => ({ ...o, minutes: x ?? 0 }))} decimal={false} /></Field>
          <Field label="Avg heart rate"><NumInput value={v.hr} onChange={set('hr')} decimal={false} /></Field>
          <Field label="Distance mi"><NumInput value={v.distance} onChange={set('distance')} /></Field>
          {v.type === 'incline' && (
            <>
              <Field label="Incline %"><NumInput value={v.incline} onChange={set('incline')} /></Field>
              <Field label="Speed mph"><NumInput value={v.speed} onChange={set('speed')} /></Field>
            </>
          )}
        </div>
        {v.type === 'dog' && (
          <Segmented options={[{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard / hilly' }]} value={v.effort ?? 'easy'} onChange={(e) => setV((o) => ({ ...o, effort: e as 'easy' | 'hard' }))} />
        )}
        <Button kind="primary" big className="w-full" onClick={async () => { await save<CardioLog>('cardio', v); toast('Saved'); onClose(); }}>Save changes</Button>
        <Button kind="danger" className="w-full" onClick={async () => { if (confirm('Delete this entry?')) { await remove('cardio', c.id); toast('Deleted'); onClose(); } }}>Delete</Button>
      </div>
    </Sheet>
  );
}

function BodyEdit({ b, units, onClose }: { b: BodyLog; units: Units; onClose: () => void }) {
  const [v, setV] = useState<BodyLog>({ ...b, weight: toDisplay(b.weight, units) });
  const set = (k: keyof BodyLog) => (x: number | undefined) => setV((o) => ({ ...o, [k]: x }));
  return (
    <Sheet open onClose={onClose} title="Edit body log">
      <div className="space-y-3">
        <Field label="Date"><input type="date" className="min-h-11 w-full rounded-xl bg-card2 px-3" value={v.date} onChange={(e) => e.target.value && setV((o) => ({ ...o, date: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Weight (${units})`}><NumInput value={v.weight} onChange={set('weight')} /></Field>
          <Field label="Waist (in)"><NumInput value={v.waist} onChange={set('waist')} /></Field>
          <Field label="Sleep (h)"><NumInput value={v.sleep} onChange={set('sleep')} /></Field>
          <Field label="Calories"><NumInput value={v.calories} onChange={set('calories')} decimal={false} /></Field>
          <Field label="Protein (g)"><NumInput value={v.protein} onChange={set('protein')} decimal={false} /></Field>
          <Field label="Steps"><NumInput value={v.steps} onChange={set('steps')} decimal={false} /></Field>
        </div>
        <Field label="Notes"><textarea className="min-h-16 w-full rounded-xl bg-card2 p-3" value={v.notes ?? ''} onChange={(e) => setV((o) => ({ ...o, notes: e.target.value || undefined }))} /></Field>
        <Button kind="primary" big className="w-full" onClick={async () => { await save<BodyLog>('body', { ...v, weight: fromDisplay(v.weight, units) }); toast('Saved'); onClose(); }}>Save changes</Button>
        <Button kind="danger" className="w-full" onClick={async () => { if (confirm('Delete this entry?')) { await remove('body', b.id); toast('Deleted'); onClose(); } }}>Delete</Button>
      </div>
    </Sheet>
  );
}

function AddPast({ onClose, startDate }: { onClose: () => void; startDate: string }) {
  const today = useToday();
  const [date, setDate] = useState(addDays(today, -1));
  const [type, setType] = useState<SessionType>('A');
  const [mins, setMins] = useState<number | undefined>(60);
  return (
    <Sheet open onClose={onClose} title="Log a past workout">
      <div className="space-y-3">
        <p className="text-sm text-muted">Forgot to log a session? Pick the day and the workout, then fill in the sets.</p>
        <Field label="Date"><input type="date" max={today} className="min-h-11 w-full rounded-xl bg-card2 px-3" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
        <Field label="Workout">
          <Segmented options={[{ value: 'A', label: DAYS.A.short }, { value: 'B', label: DAYS.B.short }, { value: 'C', label: DAYS.C.short }, { value: 'D', label: DAYS.D.short }, { value: 'mobility', label: 'Mobility' }]} value={type} onChange={setType} />
        </Field>
        <Field label="Minutes"><NumInput value={mins} onChange={setMins} decimal={false} /></Field>
        <div className="flex flex-wrap gap-1.5">{type in DAYS && <Pill>{DAYS[type as DayId].subtitle}</Pill>}</div>
        <Button
          kind="primary"
          big
          className="w-full"
          onClick={async () => {
            const s = await createPastSession(type, date, startDate, mins ?? 60);
            onClose();
            go(`history/${s.id}`);
          }}
        >
          Create and fill in sets
        </Button>
      </div>
    </Sheet>
  );
}

