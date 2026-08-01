// Toast primitive (design §B.4 / §G.2). A single dismissible ink chip with a tone-coloured shadow
// and an optional undo action. Tone is paired with text/label — never colour alone (req 27.4).
// Pure presentational: state/queueing lives in ToastProvider; this only renders one toast.
import React from 'react';
import clsx from 'clsx';

export type ToastTone = 'neutral' | 'win' | 'warn';

export interface ToastProps {
  tone: ToastTone;
  message: string;
  undo?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const TONE_TO_POP: Record<ToastTone, string> = {
  neutral: 'ink-box',
  win: 'ink-box ink-box-lime',
  warn: 'ink-box ink-box-magenta',
};

export function Toast({ tone, message, undo, onDismiss, className }: ToastProps) {
  return (
    <div
      className={clsx(TONE_TO_POP[tone], 'ink-press', className)}
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDismiss?.();
        }
      }}
      style={{
        pointerEvents: 'auto',
        maxWidth: 360,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--surface-raised)',
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {undo ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            undo();
          }}
          className="ink-box-sm ink-press tap-target"
          style={{
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            fontSize: 'var(--text-micro)',
            letterSpacing: '0.14em',
            padding: '2px var(--space-2)',
          }}
        >
          undo
        </button>
      ) : null}
    </div>
  );
}
