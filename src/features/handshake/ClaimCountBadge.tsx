// Claim-count badge for the Field signal node surface (requirement 11.9).
// Displays the number of active claims on a signal. Purely presentational.
// Designed to be overlaid on a signal node or placed inline with signal metadata.

export interface ClaimCountBadgeProps {
  /** Number of active claims on the gig. */
  count: number;
  /** Compact mode for the Field node (just the number). */
  compact?: boolean;
  className?: string;
}

/**
 * Badge showing how many doers have claimed a gig. On the Field surface this is
 * a small pill overlaid on the node; in the signal detail or board row it renders
 * inline with the signal metadata. Hides when count is 0 (no information to convey).
 */
export function ClaimCountBadge({ count, compact = false, className }: ClaimCountBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={className}
      aria-label={`${count} ${count === 1 ? 'claim' : 'claims'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-1)',
        padding: compact ? '1px var(--space-1)' : '2px var(--space-2)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-nano)',
        fontWeight: 700,
        letterSpacing: '0.1em',
        lineHeight: 1,
        color: 'var(--color-paper)',
        backgroundColor: 'var(--color-ink)',
        borderRadius: 'var(--radius-chip)',
        minWidth: compact ? 16 : 'auto',
        textAlign: 'center',
      }}
    >
      {compact ? count : `${count} ${count === 1 ? 'CLAIM' : 'CLAIMS'}`}
    </span>
  );
}
