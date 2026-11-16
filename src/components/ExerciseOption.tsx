/* One choosable exercise in a swap or add list, with an ⓘ button that opens an animated
   preview in place. Nothing animates unless you tap ⓘ. */
import { useState, type ReactNode } from 'react';
import { AnimatedFigure, Thumb } from './Diagram';
import { Pill } from './ui';
import { MUSCLES } from '../figure/figure';
import type { Exercise } from '../plan/types';

export function InfoButton({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={open ? `Hide preview of ${label}` : `Preview ${label}`}
      aria-expanded={open}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${open ? 'text-accent' : 'text-muted active:text-ink'}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <circle cx="12" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}

export function ExerciseOption({
  ex,
  onSelect,
  children,
  variant = 'card',
  trailing,
}: {
  ex: Exercise;
  onSelect: () => void;
  /** shown under the row (e.g. "Just today / Rest of cycle" buttons) */
  children?: ReactNode;
  variant?: 'card' | 'row';
  /** small marker at the end of the row, e.g. "+" */
  trailing?: ReactNode;
}) {
  const [peek, setPeek] = useState(false);
  const row = variant === 'row';
  return (
    <div className={row ? '' : 'hairline rounded-[20px] bg-card'}>
      <div className="flex items-center">
        <button type="button" onClick={onSelect} className={`flex min-w-0 flex-1 items-center gap-3 text-left active:bg-card2 ${row ? 'p-2.5' : 'p-3'}`}>
          <Thumb ex={ex} size={row ? 48 : 56} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{ex.name}</span>
            {ex.caution && <Pill tone="warn">{ex.caution}</Pill>}
          </span>
          {trailing}
        </button>
        <InfoButton open={peek} onClick={() => setPeek(!peek)} label={ex.name} />
      </div>
      {peek && (
        <div className="px-3 pb-3">
          <AnimatedFigure ex={ex} />
          {ex.muscles.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              {ex.muscles.map((m) => <span key={m} className="rounded-full bg-card2 px-2 py-0.5 text-muted">{MUSCLES[m]?.label ?? m}</span>)}
            </div>
          )}
          <p className="mt-2 text-xs leading-relaxed text-muted">{ex.why}</p>
        </div>
      )}
      {children}
    </div>
  );
}
