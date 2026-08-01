// Empty state (design §B.4 / §B.5). Encouraging, never apologetic; copy is supplied by the caller
// from the typed empty-copy records. A decorative aria-hidden mark per art variant. Pure primitive.
import React from 'react';

export type EmptyArt = 'ghost-town' | 'no-signals' | 'all-caught-up' | 'offline';

export interface EmptyStateProps {
  art: EmptyArt;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}

// Simple, on-brand decorative glyph per state. Purely decorative → aria-hidden.
const ART_GLYPH: Record<EmptyArt, string> = {
  'ghost-town': '👻',
  'no-signals': '📡',
  'all-caught-up': '🌾',
  offline: '📴',
};

export function EmptyState({ art, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-8) var(--space-4)',
      }}
    >
      <span aria-hidden="true" className="floaty" style={{ fontSize: 'var(--text-h1)', lineHeight: 1 }}>
        {ART_GLYPH[art]}
      </span>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'var(--text-h3)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      <p style={{ color: 'var(--text-2)', maxWidth: 320, margin: 0 }}>{body}</p>
      {action ? <div style={{ marginTop: 'var(--space-2)' }}>{action}</div> : null}
    </div>
  );
}
