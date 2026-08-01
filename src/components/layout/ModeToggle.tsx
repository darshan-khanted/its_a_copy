// The `FIELD ⇄ BOARD` control (design §C.8, requirements 7.3, 7.4, 25.1).
//
// One action, no menu: an .ink-press segmented control where each half is a real link to the
// other surface, so the switch is a single tap/click/Enter and the selected mode is reflected
// in the URL. `useFieldMode` persists the choice (req 7.4) and preserves the current query
// string, so `?sort=`/`?q=` survive a mode switch.
import { useFieldMode } from '@/hooks/useUrlState';
import { labels } from '@/copy/labels';
import type { FieldMode } from '@/lib/prefs';

export interface ModeToggleProps {
  className?: string;
}

const SEGMENTS: { mode: FieldMode; label: string }[] = [
  { mode: 'field', label: labels.field },
  { mode: 'board', label: labels.board },
];

export function ModeToggle({ className }: ModeToggleProps) {
  const { mode, setMode } = useFieldMode();

  return (
    <div
      className={className}
      role="group"
      aria-label={labels.fieldBoardToggle}
      style={{ display: 'inline-flex', gap: 'var(--space-1)' }}
    >
      {SEGMENTS.map((seg) => {
        const selected = seg.mode === mode;
        return (
          <button
            key={seg.mode}
            type="button"
            aria-pressed={selected}
            onClick={() => setMode(seg.mode)}
            className={
              selected ? 'ink-box-sm ink-press tap-target' : 'ink-box-sm flat ink-press tap-target'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              letterSpacing: '0.14em',
              fontWeight: selected ? 700 : 400,
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: selected ? 'var(--color-lime)' : 'var(--surface-raised)',
              color: 'var(--text-1)',
            }}
          >
            {/* selection is carried by weight + shadow + the caret, never by colour alone (req 1.3) */}
            {selected ? <span aria-hidden="true">▸</span> : null}
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
