import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Field, NumInput, SectionTitle, Segmented, Sheet, toast } from '../components/ui';
import { BodySheet, CardioSheet } from '../components/QuickForms';
import { db, uid, type LabEntry } from '../lib/db';
import { remove, save } from '../lib/store';
import { useSettings, useToday } from '../lib/hooks';
import { LABS, NUTRITION, labOk, type LabKey } from '../plan/content';
import { CARDIO_TYPES } from '../plan/days';
import { fmtShort, diffDays, todayKey } from '../lib/dates';
import { fmtWeight } from '../lib/units';

export default function BodyLog() {
  const [tab, setTab] = useState<'body' | 'labs' | 'cardio'>('body');
  return (
    <div>
      <h1 className="pt-2 font-display text-[34px] leading-tight">Body log</h1>
      <Segmented
        className="mt-3"
        options={[{ value: 'body', label: 'Body' }, { value: 'labs', label: 'Labs' }, { value: 'cardio', label: 'Cardio' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'body' ? <Body /> : tab === 'labs' ? <Labs /> : <Cardio />}
    </div>
  );
}

function Body() {
  const settings = useSettings();
  const today = useToday();
  const [open, setOpen] = useState(false);
  const rows = useLiveQuery(() => db.body.orderBy('date').reverse().filter((b) => !b.deleted).limit(40).toArray(), []) ?? [];
  const lastWaist = rows.find((r) => r.waist !== undefined);
  const waistDue = !lastWaist || diffDays(lastWaist.date, today) >= 14;
  return (
    <div>
      <Button kind="primary" big className="mt-3 w-full" onClick={() => setOpen(true)}>+ Log today</Button>
      <p className="mt-2 text-sm text-muted">
        Weigh in 2–3 mornings a week, after the bathroom, before eating. Waist at the belly button every 2 weeks{waistDue ? ' — one is due now.' : '.'}
      </p>
      <SectionTitle>Targets</SectionTitle>
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-xs text-muted">Calories</div><div className="tnum font-semibold">~{settings.calories.toLocaleString()}</div></div>
          <div><div className="text-xs text-muted">Protein</div><div className="tnum font-semibold">{NUTRITION.protein[0]}–{NUTRITION.protein[1]} g</div></div>
          <div><div className="text-xs text-muted">Goal</div><div className="tnum font-semibold">{fmtWeight(settings.goalWeight, settings.units)}</div></div>
        </div>
        <p className="mt-2 text-xs text-faint">{NUTRITION.fiber} {NUTRITION.avoid} Calories move ±{NUTRITION.adjust} based on your weekly rate of loss (see Trends).</p>
      </Card>
      <SectionTitle>Recent</SectionTitle>
      {!rows.length ? (
        <Card><p className="text-sm text-muted">Nothing logged yet.</p></Card>
      ) : (
        <div className="divide-y divide-line overflow-hidden hairline rounded-[20px] bg-card">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2">
              <div className="w-14 shrink-0 text-sm text-muted">{fmtShort(r.date)}</div>
              <div className="min-w-0 flex-1 text-sm">
                {[r.weight !== undefined && fmtWeight(r.weight, settings.units), r.waist !== undefined && `${r.waist}″ waist`, r.sleep !== undefined && `${r.sleep} h sleep`, r.calories !== undefined && `${r.calories} kcal`, r.protein !== undefined && `${r.protein} g protein`, r.steps !== undefined && `${r.steps.toLocaleString()} steps`]
                  .filter(Boolean)
                  .join(' · ')}
                {r.notes && <div className="text-xs text-faint">{r.notes}</div>}
              </div>
              <button type="button" className="min-h-11 min-w-11 text-faint" aria-label="Delete" onClick={() => confirm('Delete this entry?') && remove('body', r.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <BodySheet open={open} onClose={() => setOpen(false)} date={today} units={settings.units} />
    </div>
  );
}

function Labs() {
  const rows = useLiveQuery(() => db.labs.orderBy('date').reverse().filter((b) => !b.deleted).toArray(), []) ?? [];
  const [edit, setEdit] = useState<Partial<LabEntry> | null>(null);
  return (
    <div>
      <Button kind="primary" big className="mt-3 w-full" onClick={() => setEdit({ date: todayKey() })}>+ Add blood work</Button>
      {!rows.length && (
        <Card className="mt-3">
          <p className="text-sm text-muted">No labs yet. Your November 2026 baseline arrives with your private setup link (see SETUP.md), or add it here by hand.</p>
        </Card>
      )}
      {rows.map((r) => (
        <Card key={r.id} className="mt-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{fmtShort(r.date)} {r.date.slice(0, 4)}</div>
            <button type="button" className="min-h-11 px-2 text-sm text-accent" onClick={() => setEdit(r)}>Edit</button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {LABS.filter((l) => r[l.key] !== undefined).map((l) => {
              const v = r[l.key]!;
              const ok = labOk(l.key, v);
              return (
                <div key={l.key} className="rounded-xl bg-card2 p-2">
                  <div className="text-[11px] text-muted">{l.label}</div>
                  <div className={`tnum font-semibold ${ok === false ? 'text-warn' : ok ? 'text-good' : ''}`}>{v}</div>
                  {l.target && <div className="text-[10px] text-faint">goal {l.target.op} {l.target.value}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {edit && <LabSheet initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function LabSheet({ initial, onClose }: { initial: Partial<LabEntry>; onClose: () => void }) {
  const [v, setV] = useState<Partial<LabEntry>>(initial);
  const submit = async () => {
    if (!v.date) return toast('Pick a date');
    await save<LabEntry>('labs', { ...v, id: v.id ?? uid(), date: v.date });
    toast('Labs saved');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={initial.id ? 'Edit blood work' : 'Add blood work'}>
      <div className="space-y-3">
        <Field label="Date of the draw">
          <input type="date" className="min-h-11 w-full rounded-xl bg-card2 px-3" value={v.date ?? ''} onChange={(e) => setV((o) => ({ ...o, date: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {LABS.map((l) => (
            <Field key={l.key} label={`${l.label} (${l.unit})`} hint={l.target ? `goal ${l.target.op} ${l.target.value}` : undefined}>
              <NumInput value={v[l.key as LabKey]} onChange={(x) => setV((o) => ({ ...o, [l.key]: x }))} />
            </Field>
          ))}
        </div>
        <Button kind="primary" big className="w-full" onClick={submit}>Save</Button>
        {initial.id && (
          <Button kind="danger" className="w-full" onClick={async () => { if (confirm('Delete this lab entry?')) { await remove('labs', initial.id!); onClose(); } }}>
            Delete
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function Cardio() {
  const today = useToday();
  const [open, setOpen] = useState(false);
  const rows = useLiveQuery(() => db.cardio.orderBy('date').reverse().filter((b) => !b.deleted).limit(40).toArray(), []) ?? [];
  return (
    <div>
      <Button kind="primary" big className="mt-3 w-full" onClick={() => setOpen(true)}>+ Log cardio or a dog walk</Button>
      <SectionTitle>Recent</SectionTitle>
      {!rows.length ? (
        <Card><p className="text-sm text-muted">Nothing logged yet.</p></Card>
      ) : (
        <div className="divide-y divide-line overflow-hidden hairline rounded-[20px] bg-card">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <div className="w-14 shrink-0 text-muted">{fmtShort(r.date)}</div>
              <div className="flex-1">
                {CARDIO_TYPES.find((c) => c.id === r.type)?.label ?? r.type} · {r.minutes} min{r.effort ? ` · ${r.effort}` : ''}{r.hr ? ` · ${r.hr} bpm` : ''}
              </div>
              <button type="button" className="min-h-11 min-w-11 text-faint" aria-label="Delete" onClick={() => confirm('Delete this entry?') && remove('cardio', r.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <CardioSheet open={open} onClose={() => setOpen(false)} date={today} />
    </div>
  );
}
