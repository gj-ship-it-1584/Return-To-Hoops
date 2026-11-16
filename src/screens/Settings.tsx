import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Field, NumInput, Pill, SectionTitle, Segmented, toast } from '../components/ui';
import { back, useSettings, useSyncStatus } from '../lib/hooks';
import { saveSettings, getMeta } from '../lib/store';
import { dowName, fmtDate } from '../lib/dates';
import { REACH_HOWTO, SAFETY } from '../plan/content';
import { DAYS } from '../plan/days';
import { exportBackup, parseBackup, restoreBackup, wipeLocal } from '../lib/backup';
import { connect, disconnect, getLink, joinLink, newCode, parseConfig, pushAll, wipeRemote } from '../lib/sync';
import { fromDisplay, toDisplay } from '../lib/units';

export default function SettingsScreen() {
  const s = useSettings();
  const set = (c: Parameters<typeof saveSettings>[0]) => void saveSettings(c);
  return (
    <div>
      <div className="flex items-center gap-1 pt-1">
        <button type="button" onClick={back} className="-ml-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-3xl leading-none text-muted active:bg-card2" aria-label="Back">‹</button>
        <h1 className="font-display text-[34px] leading-tight">Settings</h1>
      </div>

      <SectionTitle>Program</SectionTitle>
      <Card className="space-y-4">
        <Field label="Program start date (week 1, day 1)" hint={`${fmtDate(s.startDate)}. Use a Monday so Vertical + legs lands on Monday.`}>
          <input type="date" className="min-h-11 w-full rounded-xl bg-card2 px-3" value={s.startDate} onChange={(e) => e.target.value && set({ startDate: e.target.value })} />
        </Field>
        <div className="space-y-2">
          <div className="text-sm text-muted">Lifting days</div>
          {(['A', 'B', 'C'] as const).map((d, i) => (
            <div key={d} className="flex items-center gap-3">
              <div className="w-24 text-sm">{DAYS[d].title}</div>
              <select
                className="min-h-11 flex-1 rounded-xl bg-card2 px-3"
                value={s.liftDays[i]}
                onChange={(e) => {
                  const next = [...s.liftDays] as [number, number, number];
                  next[i] = Number(e.target.value);
                  if (new Set(next).size < 3) return toast('Pick three different days');
                  set({ liftDays: next });
                }}
              >
                {[1, 2, 3, 4, 5, 6, 0].map((n) => <option key={n} value={n}>{dowName(n)}</option>)}
              </select>
            </div>
          ))}
          <p className="text-xs text-faint">Court day is Saturday or Sunday. Non-lifting weekdays offer easy cardio.</p>
        </div>
        <Field label="Blood draw scheduled" hint="No hard lifting, jumps or sprints for the 3 days before. Today switches to mobility + walking.">
          <div className="flex gap-2">
            <input type="date" className="min-h-11 flex-1 rounded-xl bg-card2 px-3" value={s.bloodDraw ?? ''} onChange={(e) => set({ bloodDraw: e.target.value || undefined })} />
            {s.bloodDraw && <Button onClick={() => set({ bloodDraw: undefined })}>Clear</Button>}
          </div>
        </Field>
      </Card>

      <SectionTitle>Dunk math</SectionTitle>
      <Card className="space-y-3">
        <Field label="Standing reach (in)">
          <NumInput value={s.standingReach} onChange={(v) => set({ standingReach: v })} placeholder="e.g. 91" />
        </Field>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">{REACH_HOWTO.map((t) => <li key={t}>{t}</li>)}</ol>
        <Field label="Dunk target touch (in)" hint="10′6″ = 126 in">
          <NumInput value={s.dunkTarget} onChange={(v) => v && set({ dunkTarget: v })} />
        </Field>
      </Card>

      <SectionTitle>Goals</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Goal weight (${s.units})`}>
            <NumInput value={toDisplay(s.goalWeight, s.units)} onChange={(v) => v && set({ goalWeight: fromDisplay(v, s.units)! })} />
          </Field>
          <Field label="Daily calories">
            <NumInput value={s.calories} onChange={(v) => v && set({ calories: v })} decimal={false} />
          </Field>
        </div>
      </Card>

      <SectionTitle>Units and timers</SectionTitle>
      <Card className="space-y-4">
        <Segmented options={[{ value: 'lb', label: 'Pounds (lb)' }, { value: 'kg', label: 'Kilograms (kg)' }]} value={s.units} onChange={(units) => set({ units })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rest: main lifts (s)"><NumInput value={s.restMain} onChange={(v) => v && set({ restMain: v })} decimal={false} /></Field>
          <Field label="Rest: everything else (s)"><NumInput value={s.restOther} onChange={(v) => v && set({ restOther: v })} decimal={false} /></Field>
        </div>
        <Toggle label="Sound when rest ends" on={s.sound} onChange={(v) => set({ sound: v })} />
        <Toggle label="Vibration (Android only — iPhone doesn't allow it)" on={s.vibrate} onChange={(v) => set({ vibrate: v })} />
      </Card>

      <SyncCard />
      <BackupCard />

      <p className="mt-8 text-center text-xs text-faint">{SAFETY.footer}</p>
      <p className="mt-1 text-center text-xs text-faint">Return to Hoops · v{__APP_VERSION__}</p>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-left" onClick={() => onChange(!on)}>
      <span className="text-sm">{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-accent' : 'bg-card2'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${on ? 'left-5.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function SyncCard() {
  const status = useSyncStatus();
  const link = useLiveQuery(() => getLink(), [status.state]);
  const [cfg, setCfg] = useState('');
  const [code, setCode] = useState('');
  const doConnect = async () => {
    const config = parseConfig(cfg);
    if (!config) return toast('That doesn’t look like a Firebase config block');
    const c = code.trim() || newCode();
    if (c.length < 20) return toast('The code must be at least 20 characters');
    await connect({ config, code: c });
    setCfg('');
    toast('Connected');
  };
  const tone = status.state === 'live' ? 'good' : status.state === 'error' ? 'bad' : 'muted';
  return (
    <>
      <SectionTitle>Cloud backup and sync (Firebase)</SectionTitle>
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">Status</span>
          <Pill tone={tone}>
            {{ local: 'This phone only', connecting: 'Connecting…', live: 'Connected · live', offline: 'Offline · will sync later', error: 'Error' }[status.state]}
          </Pill>
        </div>
        {status.error && <p className="text-xs text-bad">{status.error}</p>}
        {link ? (
          <>
            <Field label="Your code" hint="Same idea as Shea's Log's family code: your data lives under this code in your Firebase project.">
              <div className="tnum break-all rounded-xl bg-card2 p-3 font-mono text-sm">{link.code}</div>
            </Field>
            <Button
              className="w-full"
              onClick={async () => {
                const url = joinLink(link);
                try {
                  if (navigator.share) await navigator.share({ url, title: 'Return to Hoops' });
                  else {
                    await navigator.clipboard.writeText(url);
                    toast('Link copied');
                  }
                } catch {
                  /* cancelled */
                }
              }}
            >
              Share the setup link (for Add to Home Screen or another device)
            </Button>
            <Button kind="ghost" className="w-full" onClick={async () => { if (confirm('Stop syncing on this phone? Your data stays on the phone and in Firebase.')) await disconnect(); }}>
              Disconnect this phone
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Optional. Connect the free Firebase project (SETUP.md, Part 2) and every entry is backed up to the cloud automatically. Without it, data lives only on this phone, so export backups.
            </p>
            <Field label="Paste your Firebase config">
              <textarea className="min-h-28 w-full rounded-xl bg-card2 p-3 font-mono text-xs" placeholder={'const firebaseConfig = {\n  apiKey: "…",\n  …\n};'} value={cfg} onChange={(e) => setCfg(e.target.value)} />
            </Field>
            <Field label="Code (leave blank to create a new one)" hint="To join data you already have, paste the code from your other device.">
              <input className="min-h-11 w-full rounded-xl bg-card2 px-3 font-mono text-sm" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="off" autoCorrect="off" />
            </Field>
            <Button kind="primary" className="w-full" onClick={doConnect}>Connect</Button>
          </>
        )}
      </Card>
    </>
  );
}

function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const last = useLiveQuery(() => getMeta<number>('lastBackupAt'), []);
  const [confirmText, setConfirmText] = useState('');
  return (
    <>
      <SectionTitle>Backup</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted">Last export: {last ? new Date(last).toLocaleDateString() : 'never'}</p>
        <Button kind="primary" className="w-full" onClick={async () => { const r = await exportBackup(); if (r !== 'cancelled') toast('Backup exported'); }}>
          Export all data (JSON)
        </Button>
        <Button className="w-full" onClick={() => fileRef.current?.click()}>Import a backup file</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const b = parseBackup(await f.text());
              const n = Object.values(b.tables).reduce((a, t) => a + (Array.isArray(t) ? t.length : 0), 0);
              if (!confirm(`Replace everything on this phone with this backup (${n} records from ${new Date(b.exportedAt).toLocaleDateString()})?`)) return;
              await restoreBackup(b);
              await pushAll();
              toast('Backup restored');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not read that file');
            }
          }}
        />
      </Card>

      <SectionTitle>Danger zone</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted">Reset deletes every workout, weigh-in, lab and setting on this phone{' '}(and the cloud copy, if sync is on). Export a backup first. Type <b>DELETE</b> to confirm.</p>
        <input className="min-h-11 w-full rounded-xl bg-card2 px-3" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" autoCapitalize="characters" />
        <Button
          kind="danger"
          className="w-full"
          disabled={confirmText !== 'DELETE'}
          onClick={async () => {
            await wipeRemote();
            await wipeLocal();
            setConfirmText('');
            toast('All data reset');
          }}
        >
          Reset all data
        </Button>
      </Card>
    </>
  );
}
