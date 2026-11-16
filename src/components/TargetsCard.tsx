/* Daily target: cardio minutes (dog walks and basketball count). Food, steps and sleep live in
   Apple Health (Oura), which a web app can't read, so they aren't tracked here. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from './ui';
import { CardioSheet, DogWalkSheet, BodySheet } from './QuickForms';
import type { Settings } from '../lib/db';
import { dayTotals, targetsOf } from '../lib/targets';

export function TargetsCard({ date, settings, canLog, showWeight = true }: { date: string; settings: Settings; canLog: boolean; showWeight?: boolean }) {
  const t = targetsOf(settings);
  const totals = useLiveQuery(() => dayTotals(date), [date]);
  const [sheet, setSheet] = useState<null | 'dog' | 'cardio' | 'weight'>(null);
  const v = totals ?? { cardioMin: 0, dogMin: 0 };
  const pct = t.cardioMin ? Math.min(100, (v.cardioMin / t.cardioMin) * 100) : 0;
  const hit = v.cardioMin >= t.cardioMin;

  return (
    <Card className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Cardio today</span>
        <span className="tnum text-[13px]">
          <span className={hit ? 'text-good' : 'text-ink'}>{v.cardioMin}</span>
          <span className="text-faint"> / {t.cardioMin} min</span>
          {hit && <span className="ml-1 text-good">✓</span>}
        </span>
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-card2">
        <div className={`h-full rounded-full ${hit ? 'bg-good' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[10.5px] text-faint">{v.dogMin ? `incl. ${v.dogMin} min dog walk` : 'Dog walks, incline walks, bike, basketball… all count'}</div>
      {canLog && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setSheet('dog')} className="min-h-11 flex-1 rounded-full border border-line text-[13px] text-ink/90 active:bg-card2">+ Dog walk</button>
          <button type="button" onClick={() => setSheet('cardio')} className="min-h-11 flex-1 rounded-full border border-line text-[13px] text-ink/90 active:bg-card2">+ Other cardio</button>
          {showWeight && (
            <button type="button" onClick={() => setSheet('weight')} className="min-h-11 rounded-full border border-line px-4 text-[13px] text-muted active:bg-card2">Weight</button>
          )}
        </div>
      )}
      <DogWalkSheet open={sheet === 'dog'} onClose={() => setSheet(null)} date={date} />
      <CardioSheet open={sheet === 'cardio'} onClose={() => setSheet(null)} date={date} />
      <BodySheet open={sheet === 'weight'} onClose={() => setSheet(null)} date={date} units={settings.units} />
    </Card>
  );
}
