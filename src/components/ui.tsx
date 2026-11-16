/* Small shared UI pieces. Everything tappable is at least 44 px. */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`rounded-2xl bg-card p-4 ${onClick ? 'cursor-pointer active:bg-card2' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  children,
  onClick,
  kind = 'secondary',
  className = '',
  disabled,
  type = 'button',
  big,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: BtnKind;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  big?: boolean;
}) {
  const k = {
    primary: 'bg-accent text-accent-ink font-semibold active:brightness-90',
    secondary: 'bg-card2 text-ink active:bg-line',
    ghost: 'bg-transparent text-muted active:bg-card2',
    danger: 'bg-bad/15 text-bad active:bg-bad/25',
  }[kind];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${big ? 'min-h-14 text-lg' : 'min-h-11'} rounded-xl px-4 ${k} disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'good' | 'warn' | 'bad' | 'info' }) {
  const t = {
    muted: 'bg-card2 text-muted',
    accent: 'bg-accent/15 text-accent',
    good: 'bg-good/15 text-good',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/15 text-bad',
    info: 'bg-info/15 text-info',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

/** Number input that opens the numeric keypad. Keeps a text draft so "1." can be typed. */
export function NumInput({
  value,
  onChange,
  placeholder,
  decimal = true,
  className = '',
  label,
  suffix,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  decimal?: boolean;
  className?: string;
  label?: string;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value === undefined ? '' : String(value));
  }, [value]);
  return (
    <label className={`flex min-h-11 items-center rounded-xl bg-card2 px-3 focus-within:ring-2 focus-within:ring-accent ${className}`}>
      {label && <span className="mr-2 shrink-0 text-xs text-muted">{label}</span>}
      <input
        className="tnum w-full min-w-0 bg-transparent py-2 text-center text-lg font-semibold outline-none placeholder:text-faint"
        inputMode={decimal ? 'decimal' : 'numeric'}
        pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
        enterKeyHint="done"
        value={draft}
        placeholder={placeholder}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
          setDraft(value === undefined ? '' : String(value));
        }}
        onChange={(e) => {
          const t = e.target.value.replace(',', '.');
          setDraft(t);
          if (t === '') return onChange(undefined);
          const n = Number(t);
          if (!Number.isNaN(n)) onChange(n);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {suffix && <span className="ml-1 shrink-0 text-xs text-muted">{suffix}</span>}
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted">{label}</div>
      {children}
      {hint && <div className="text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: ReactNode }[];
  value: T | undefined;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex rounded-xl bg-card2 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 rounded-lg px-2 text-sm ${o.value === value ? 'bg-accent font-semibold text-accent-ink' : 'text-muted active:bg-line'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 0–10 scale as a row of buttons (one hand, no slider fiddling). */
export function Scale({ value, onChange, danger = 3 }: { value: number | undefined; onChange: (v: number) => void; danger?: number }) {
  return (
    <div className="grid grid-cols-11 gap-1">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`tnum min-h-11 rounded-lg text-sm font-semibold ${
            value === n ? (n > danger ? 'bg-bad text-white' : 'bg-accent text-accent-ink') : n > danger ? 'bg-card2 text-bad/80' : 'bg-card2 text-muted'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="animate-rise safe-bottom max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-bg px-4 pt-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-bg px-4 pb-2">
          <div className="min-w-0 flex-1 text-lg font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full text-2xl text-muted active:bg-card2" aria-label="Close">
            ×
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}

let toastFn: ((msg: string) => void) | null = null;
export const toast = (msg: string) => toastFn?.(msg);
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    toastFn = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      toastFn = null;
    };
  }, []);
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 safe-top">
      <div className="animate-pop rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg">{msg}</div>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-end justify-between px-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {right}
    </div>
  );
}
