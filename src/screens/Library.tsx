import { useState } from 'react';
import { Pill, SectionTitle } from '../components/ui';
import { Thumb } from '../components/Diagram';
import { ALL_EXERCISES } from '../plan/exercises';
import { NOT_FOR_NOW, SLOTS } from '../plan/content';
import { go } from '../lib/hooks';
import { MUSCLES } from '../figure/figure';

export default function Library() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'plan' | 'swap'>('all');
  const needle = q.trim().toLowerCase();
  const match = (e: (typeof ALL_EXERCISES)[number]) =>
    (filter === 'all' || (filter === 'plan') === e.inPlan) &&
    (!needle || e.name.toLowerCase().includes(needle) || e.muscles.some((m) => MUSCLES[m]?.label.toLowerCase().includes(needle)));
  const total = ALL_EXERCISES.length;
  return (
    <div>
      <h1 className="pt-2 text-2xl font-bold">Exercise library</h1>
      <p className="text-sm text-muted">{total} exercises · tap one for the diagram, how-to and your history</p>
      <div className="sticky top-0 z-20 -mx-4 mt-3 bg-bg/95 px-4 pt-2 pb-2 backdrop-blur safe-top">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises or muscles"
          className="min-h-11 w-full rounded-xl bg-card px-4 outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="mt-2 flex gap-2">
          {(['all', 'plan', 'swap'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`min-h-9 rounded-full px-3 text-sm ${filter === f ? 'bg-accent text-accent-ink font-semibold' : 'bg-card text-muted'}`}>
              {f === 'all' ? 'All' : f === 'plan' ? 'In my plan' : 'Swap options'}
            </button>
          ))}
        </div>
      </div>
      {SLOTS.map((slot) => {
        const list = ALL_EXERCISES.filter((e) => e.slots[0] === slot.id && match(e));
        if (!list.length) return null;
        return (
          <section key={slot.id}>
            <SectionTitle>{slot.label}</SectionTitle>
            <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
              {list.map((e) => (
                <button key={e.id} type="button" onClick={() => go(`library/${e.id}`)} className="flex w-full items-center gap-3 p-3 text-left active:bg-card2">
                  <Thumb ex={e} size={60} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{e.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Pill tone={e.inPlan ? 'accent' : 'muted'}>{e.inPlan ? 'In my plan' : 'Swap option'}</Pill>
                      {e.caution && <Pill tone="warn">{e.caution}</Pill>}
                    </div>
                  </div>
                  <span className="text-faint">›</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {!needle && (
        <section>
          <SectionTitle>Not for now (AC joint)</SectionTitle>
          <div className="space-y-2">
            {NOT_FOR_NOW.map((n) => (
              <div key={n.name} className="rounded-2xl border border-bad/25 bg-card p-4">
                <div className="font-semibold text-bad">⊘ {n.name}</div>
                <p className="mt-1 text-sm text-muted">{n.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
