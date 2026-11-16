/* Quick-entry sheets used from Today and the Body log. */
import { useRef, useState } from 'react';
import { Button, Field, NumInput, Segmented, Sheet, Scale, toast } from './ui';
import { save } from '../lib/store';
import { uid, type BodyLog, type CardioLog, type Checkin, type Session } from '../lib/db';
import { CARDIO_TYPES, CARDIO_EFFORT, CARDIO_WHY, type CardioType } from '../plan/days';
import { fromDisplay, type Units } from '../lib/units';
import { programPosition } from '../lib/schedule';

export function BodySheet({ open, onClose, date, units, showExtras = false }: { open: boolean; onClose: () => void; date: string; units: Units; showExtras?: boolean }) {
  const [v, setV] = useState<Partial<BodyLog>>({});
  const [more, setMore] = useState(showExtras);
  const set = (k: keyof BodyLog) => (x: number | undefined) => setV((o) => ({ ...o, [k]: x }));
  const submit = async () => {
    if (v.weight === undefined && v.waist === undefined && !more) return toast('Enter your weight');
    await save<BodyLog>('body', { ...v, id: uid(), date, weight: fromDisplay(v.weight, units) });
    toast('Saved');
    setV({});
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log body">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Weight (${units})`}>
            <NumInput value={v.weight} onChange={set('weight')} placeholder="175" />
          </Field>
          <Field label="Waist at belly button (in)">
            <NumInput value={v.waist} onChange={set('waist')} placeholder="34" />
          </Field>
        </div>
        {!more ? (
          <button type="button" className="min-h-11 text-sm text-accent" onClick={() => setMore(true)}>
            + Sleep, calories, protein, steps, notes
          </button>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sleep (h)"><NumInput value={v.sleep} onChange={set('sleep')} /></Field>
              <Field label="Calories"><NumInput value={v.calories} onChange={set('calories')} decimal={false} /></Field>
              <Field label="Protein (g)"><NumInput value={v.protein} onChange={set('protein')} decimal={false} /></Field>
              <Field label="Steps"><NumInput value={v.steps} onChange={set('steps')} decimal={false} /></Field>
            </div>
            <Field label="Notes">
              <textarea className="min-h-20 w-full rounded-xl bg-card2 p-3" value={v.notes ?? ''} onChange={(e) => setV((o) => ({ ...o, notes: e.target.value }))} />
            </Field>
          </>
        )}
        <Button kind="primary" big className="w-full" onClick={submit}>Save</Button>
      </div>
    </Sheet>
  );
}

export function CardioSheet({ open, onClose, date, initial = 'incline' }: { open: boolean; onClose: () => void; date: string; initial?: CardioType }) {
  const [type, setType] = useState<CardioType>(initial);
  const [v, setV] = useState<Partial<CardioLog>>({});
  const set = (k: keyof CardioLog) => (x: number | undefined) => setV((o) => ({ ...o, [k]: x }));
  const submit = async () => {
    if (!v.minutes) return toast('Enter minutes');
    await save<CardioLog>('cardio', { ...v, id: uid(), date, type, minutes: v.minutes, effort: type === 'dog' ? v.effort ?? 'easy' : v.effort });
    toast(type === 'dog' ? 'Dog walk logged' : 'Cardio logged');
    setV({});
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Easy cardio">
      <div className="space-y-3">
        <p className="text-sm text-muted">{CARDIO_WHY}</p>
        <p className="text-sm text-muted">Effort: {CARDIO_EFFORT}</p>
        <Segmented options={CARDIO_TYPES.map((c) => ({ value: c.id, label: c.label }))} value={type} onChange={setType} />
        <p className="text-xs text-faint">{CARDIO_TYPES.find((c) => c.id === type)?.hint}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutes"><NumInput value={v.minutes} onChange={set('minutes')} decimal={false} /></Field>
          <Field label="Avg heart rate (optional)"><NumInput value={v.hr} onChange={set('hr')} decimal={false} /></Field>
          {type === 'incline' && (
            <>
              <Field label="Incline %"><NumInput value={v.incline} onChange={set('incline')} /></Field>
              <Field label="Speed mph"><NumInput value={v.speed} onChange={set('speed')} /></Field>
            </>
          )}
          <Field label="Distance mi (optional)"><NumInput value={v.distance} onChange={set('distance')} /></Field>
        </div>
        {type === 'dog' && (
          <Segmented options={[{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard / hilly' }]} value={v.effort ?? 'easy'} onChange={(e) => setV((o) => ({ ...o, effort: e as 'easy' | 'hard' }))} />
        )}
        <Button kind="primary" big className="w-full" onClick={submit}>Save</Button>
      </div>
    </Sheet>
  );
}

/** One-tap dog walk: minutes chips + easy/hard. */
export function DogWalkSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const [effort, setEffort] = useState<'easy' | 'hard'>('easy');
  const log = async (minutes: number) => {
    await save<CardioLog>('cardio', { id: uid(), date, type: 'dog', minutes, effort });
    toast(`Dog walk: ${minutes} min`);
    onClose();
  };
  const [custom, setCustom] = useState<number | undefined>();
  return (
    <Sheet open={open} onClose={onClose} title="Dog walk">
      <div className="space-y-3">
        <Segmented options={[{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard / hilly' }]} value={effort} onChange={(e) => setEffort(e as 'easy' | 'hard')} />
        <div className="grid grid-cols-4 gap-2">
          {[15, 30, 45, 60].map((m) => (
            <Button key={m} kind="secondary" big onClick={() => log(m)}>{m}′</Button>
          ))}
        </div>
        <div className="flex gap-2">
          <NumInput value={custom} onChange={setCustom} placeholder="Other" decimal={false} className="flex-1" suffix="min" />
          <Button kind="primary" onClick={() => custom && log(custom)}>Log</Button>
        </div>
      </div>
    </Sheet>
  );
}

export function CheckinCard({ date, existing }: { date: string; existing?: Checkin }) {
  const [knee, setKnee] = useState<number | undefined>(existing?.knee);
  const [ach, setAch] = useState<number | undefined>(existing?.achilles);
  const newId = useRef(uid());
  const done = existing && existing.knee !== undefined && existing.achilles !== undefined;
  const persist = async (k?: number, a?: number) => {
    await save<Checkin>('checkins', { ...(existing ?? {}), id: existing?.id ?? newId.current, date, knee: k, achilles: a });
  };
  if (done) return null;
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Morning check-in</div>
      <div>
        <div className="mb-1 text-sm text-muted">Knee pain (0–10)</div>
        <Scale value={knee} onChange={(n) => { setKnee(n); void persist(n, ach); }} />
      </div>
      <div>
        <div className="mb-1 text-sm text-muted">Achilles pain (0–10)</div>
        <Scale value={ach} onChange={(n) => { setAch(n); void persist(knee, n); }} />
      </div>
    </div>
  );
}

export function PickupSheet({ open, onClose, date, startDate }: { open: boolean; onClose: () => void; date: string; startDate: string }) {
  const [minutes, setMinutes] = useState<number | undefined>(60);
  const [feel, setFeel] = useState(3);
  const [note, setNote] = useState('');
  const submit = async () => {
    const pos = programPosition(startDate, date);
    const now = Date.now();
    await save<Session>('sessions', {
      id: uid(), date, type: 'pickup', cycle: pos.cycle, week: pos.week, startedAt: now - (minutes ?? 0) * 60000, endedAt: now, status: 'done', ticked: [], swaps: {},
      pickup: { minutes: minutes ?? 0, feel, note: note || undefined },
    });
    toast('Pickup logged');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Played pickup instead">
      <div className="space-y-3">
        <p className="text-sm text-muted">Still do the approach jumps first if you can.</p>
        <Field label="Minutes played"><NumInput value={minutes} onChange={setMinutes} decimal={false} /></Field>
        <Field label="How did you feel?">
          <Segmented options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: ['😫', '😕', '😐', '🙂', '🔥'][n - 1] }))} value={feel} onChange={setFeel} />
        </Field>
        <Field label="Note"><textarea className="min-h-16 w-full rounded-xl bg-card2 p-3" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Button kind="primary" big className="w-full" onClick={submit}>Save</Button>
      </div>
    </Sheet>
  );
}
