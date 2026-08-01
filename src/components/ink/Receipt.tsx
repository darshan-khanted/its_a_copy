// The completion artefact (design §B.4 / §B.2). A mono receipt with dashed dividers and a
// right-aligned value column. Purely presentational — all figures are passed in as strings; this
// primitive performs no arithmetic and holds no payment logic (that lives server/feature side).
import React from 'react';
import clsx from 'clsx';

export interface ReceiptLine {
  label: string;
  value: string;
  /** Emphasise an exact-zero line (e.g. PLATFORM TAKE ₹0). */
  zero?: boolean;
}

export interface ReceiptProps extends React.HTMLAttributes<HTMLDivElement> {
  head: { left: string; right: string };
  lines: ReceiptLine[];
  total: { label: string; value: string };
  footNote?: string;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 'var(--space-4)',
};

export function Receipt({ head, lines, total, footNote, className, style, ...rest }: ReceiptProps) {
  return (
    <div
      className={clsx('receipt', className)}
      style={{ padding: 'var(--space-4)', ...style }}
      {...rest}
    >
      <div style={{ ...rowStyle, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <span>{head.left}</span>
        <span>{head.right}</span>
      </div>
      <hr className="receipt-divider" style={{ margin: 'var(--space-3) 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {lines.map((line, i) => (
          <div key={i} style={rowStyle}>
            <span style={{ color: 'var(--text-2)' }}>{line.label}</span>
            <span style={{ fontWeight: line.zero ? 700 : 400 }}>{line.value}</span>
          </div>
        ))}
      </div>
      <hr className="receipt-divider" style={{ margin: 'var(--space-3) 0' }} />
      <div style={{ ...rowStyle, fontSize: 'var(--text-h3)', fontWeight: 700 }}>
        <span>{total.label}</span>
        <span>{total.value}</span>
      </div>
      {footNote ? (
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--text-2)', fontSize: 'var(--text-small)' }}>
          {footNote}
        </p>
      ) : null}
    </div>
  );
}
