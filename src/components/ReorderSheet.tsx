/* Drag exercises into a new order. Works with touch: press the ⠿ handle and drag. */
import { useEffect, useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Button, Sheet } from './ui';

export interface ReorderItem {
  key: string;
  title: string;
  sub?: string;
  done?: boolean;
}

function Row({ item, index }: { item: ReorderItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-h-14 items-center gap-3 border-b border-line bg-card px-3 last:border-b-0 ${isDragging ? 'relative z-10 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.55)] ring-1 ring-accent/50' : ''}`}
    >
      <span className="tnum w-5 text-center text-[12px] text-faint">{index + 1}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] ${item.done ? 'text-faint' : ''}`}>{item.title}</span>
        {item.sub && <span className="block truncate text-[11px] text-faint">{item.sub}</span>}
      </span>
      <button
        type="button"
        aria-label={`Drag ${item.title}`}
        className="flex h-12 w-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted active:cursor-grabbing active:text-accent"
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
      </button>
    </div>
  );
}

export function ReorderSheet({
  open,
  onClose,
  items,
  onSave,
  dayLabel,
  canReset,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  items: ReorderItem[];
  /** keys in the new order; `always` = also make this the default for this training day */
  onSave: (keys: string[], always: boolean) => void | Promise<void>;
  /** e.g. "Upper body" — enables the "every time" option */
  dayLabel?: string;
  canReset?: boolean;
  onReset?: () => void | Promise<void>;
}) {
  const [list, setList] = useState(items);
  const [always, setAlways] = useState(false);
  const itemsKey = items.map((i) => i.key).join('|');
  useEffect(() => {
    if (open) setList(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemsKey]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = list.findIndex((i) => i.key === e.active.id);
    const to = list.findIndex((i) => i.key === e.over!.id);
    setList(arrayMove(list, from, to));
  };
  const changed = list.map((i) => i.key).join('|') !== itemsKey;
  return (
    <Sheet open={open} onClose={onClose} title="Reorder exercises">
      <p className="mb-3 text-sm text-muted">Press and drag the ⠿ handle. The warm-up stays first and the prehab circuit stays last.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
        <SortableContext items={list.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          <div className="hairline overflow-hidden rounded-[20px]">
            {list.map((it, i) => (
              <Row key={it.key} item={it} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {dayLabel && (
        <button type="button" onClick={() => setAlways(!always)} className="mt-3 flex min-h-11 w-full items-center gap-3 text-left">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${always ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}>{always ? '✓' : ''}</span>
          <span className="text-sm">Use this order every time for {dayLabel}</span>
        </button>
      )}
      <Button kind="primary" big className="mt-3 w-full" onClick={async () => { await onSave(list.map((i) => i.key), always); onClose(); }} disabled={!changed && !always}>
        Save order
      </Button>
      {canReset && onReset && (
        <Button kind="ghost" className="mt-1 w-full" onClick={async () => { await onReset(); onClose(); }}>↩ Back to the plan's order</Button>
      )}
    </Sheet>
  );
}
