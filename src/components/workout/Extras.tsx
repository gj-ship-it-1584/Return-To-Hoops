/* Court day extras: test day card, dunk logger with the first-dunk celebration. */
import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, NumInput, Segmented, toast } from '../ui';
import { db, uid, type BallType, type Session, type TestResult } from '../../lib/db';
import { getMeta, patch, save, setMeta } from '../../lib/store';
import { TEST_PROTOCOL } from '../../plan/days';
import { fmtFtIn } from '../../lib/units';

export function TestCard({ session, reach }: { session: Session; reach?: number }) {
  const existing = useLiveQuery(() => db.tests.where('date').equals(session.date).filter((t) => !t.deleted).first(), [session.date]);
  const newId = useRef(uid()); // one record per test day, even when saves race the live query
  const [standing, setStanding] = useState<(number | undefined)[]>([]);
  const [approach, setApproach] = useState<(number | undefined)[]>([]);
  const st = standing.length ? standing : existing?.standing ?? [];
  const ap = approach.length ? approach : existing?.approach ?? [];
  const best = (a: (number | undefined)[]) => Math.max(0, ...a.filter((x): x is number => typeof x === 'number'));
  const persist = async (s: (number | undefined)[], a: (number | undefined)[]) => {
    await save<TestResult>('tests', {
      id: existing?.id ?? newId.current,
      date: session.date,
      cycle: session.cycle,
      week: session.week,
      reach,
      standing: s.filter((x): x is number => typeof x === 'number'),
      approach: a.filter((x): x is number => typeof x === 'number'),
    });
  };
  const bs = best(st), ba = best(ap);
  return (
    <Card className="border border-info/40">
      <div className="font-semibold text-info">Test day</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{TEST_PROTOCOL.map((t) => <li key={t}>{t}</li>)}</ul>
      {!reach && <p className="mt-2 text-sm text-warn">Standing reach isn't set — add it in Settings so the app can work out your vertical.</p>}
      <div className="mt-3 text-sm text-muted">Standing touch (in)</div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <NumInput key={i} value={st[i]} placeholder={`Try ${i + 1}`} onChange={(v) => { const n = [...st]; n[i] = v; setStanding(n); void persist(n, ap); }} />
        ))}
      </div>
      <div className="mt-3 text-sm text-muted">Approach touch (in)</div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <NumInput key={i} value={ap[i]} placeholder={`Try ${i + 1}`} onChange={(v) => { const n = [...ap]; n[i] = v; setApproach(n); void persist(st, n); }} />
        ))}
      </div>
      {(bs > 0 || ba > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-card2 p-2">
            <div className="text-xs text-muted">Standing vertical</div>
            <div className="font-display text-[28px] leading-none">{reach && bs ? `${(bs - reach).toFixed(1)}″` : '—'}</div>
          </div>
          <div className="rounded-xl bg-card2 p-2">
            <div className="text-xs text-muted">Best approach touch</div>
            <div className="font-display text-[28px] leading-none">{ba ? fmtFtIn(ba) : '—'}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

const BALLS: { value: BallType; label: string }[] = [
  { value: 'tennis', label: '🎾 Tennis' },
  { value: 'volleyball', label: '🏐 Volley' },
  { value: 'basketball', label: '🏀 Basketball' },
];

export function DunkLogger({ session, max = 12 }: { session: Session; max?: number }) {
  const dunks = session.dunks ?? [];
  const [ball, setBall] = useState<BallType>(dunks[dunks.length - 1]?.ball ?? 'tennis');
  const [party, setParty] = useState(false);
  const log = async (made: boolean) => {
    await patch<Session>('sessions', session.id, { dunks: [...dunks, { ball, made }] });
    if (made && ball === 'basketball' && !(await getMeta('firstDunk'))) {
      const earlier = await db.sessions.filter((s) => s.id !== session.id && !s.deleted && !!s.dunks?.some((d) => d.ball === 'basketball' && d.made)).count();
      if (!earlier) {
        await setMeta('firstDunk', Date.now());
        setParty(true);
      }
    }
  };
  return (
    <div className="space-y-3">
      <Segmented options={BALLS} value={ball} onChange={setBall} />
      <div className="grid grid-cols-2 gap-2">
        <Button kind="primary" big onClick={() => log(true)} disabled={dunks.length >= max}>Down! ✓</Button>
        <Button big onClick={() => log(false)} disabled={dunks.length >= max}>Missed</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {dunks.map((d, i) => (
          <span key={i} className={`rounded-lg px-2 py-1 text-sm ${d.made ? 'bg-good/20 text-good' : 'bg-card2 text-muted'}`}>
            {d.ball === 'tennis' ? '🎾' : d.ball === 'volleyball' ? '🏐' : '🏀'} {d.made ? '✓' : '×'}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm text-muted">
        <span className="tnum">{dunks.length} / {max} attempts · stop when height drops</span>
        {dunks.length > 0 && (
          <button type="button" className="min-h-11 px-2 text-faint" onClick={() => { void patch<Session>('sessions', session.id, { dunks: dunks.slice(0, -1) }); toast('Removed last attempt'); }}>
            Undo
          </button>
        )}
      </div>
      {party && <Celebration onClose={() => setParty(false)} />}
    </div>
  );
}

function Celebration({ onClose }: { onClose: () => void }) {
  const bits = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/85 p-6" onClick={onClose}>
      {bits.map((i) => (
        <span
          key={i}
          className="absolute text-3xl"
          style={{
            left: `${(i * 37) % 100}%`,
            top: '-10%',
            animation: `fall ${2.2 + (i % 5) * 0.4}s linear ${(i % 7) * 0.2}s infinite`,
          }}
        >
          {i % 3 === 0 ? '🏀' : i % 3 === 1 ? '🔥' : '⭐'}
        </span>
      ))}
      <style>{`@keyframes fall { to { transform: translateY(120vh) rotate(540deg); } }`}</style>
      <div className="animate-pop relative rounded-3xl bg-accent p-8 text-center text-accent-ink shadow-2xl">
        <div className="text-6xl">🏀</div>
        <div className="mt-2 text-3xl font-black uppercase">You dunked it.</div>
        <p className="mt-2 font-medium">First basketball dunk since college. Every box jump, Nordic and early morning got you here.</p>
        <button type="button" className="mt-5 min-h-12 rounded-xl bg-accent-ink px-6 font-bold text-accent">Let's go</button>
      </div>
    </div>
  );
}
