// The Field's paper backdrop (design §C.3 z 0, §C.1, §I.5; requirements 20.9, 3.10, 28.8).
//
// Paper fill, halftone blocks, and an abstracted ink lattice — authored as ~1 KB of inline SVG,
// with no tile fetch and no Google Maps JavaScript anywhere in this module's graph (req 3.10,
// 28.8, NFR-1.1). Critically it is NOT a basemap: the lattice is a fixed graphic abstraction
// with no relationship to real streets, so a fuzzed node cannot be resolved against
// recognisable geography (req 20.9, NFR-4.5).
//
// Entirely decorative and `aria-hidden`: every fact the Field carries lives in the chrome and
// in the nodes' accessible names (§I.3).

export interface FieldBackdropProps {
  /** Distinguishes the halftone pattern id when more than one Field is mounted. */
  patternKey?: string;
}

/**
 * A fixed, deliberately non-geographic lattice in viewBox units (0–100), so the whole layer
 * scales with the square and never needs measuring.
 */
const LATTICE: readonly { x1: number; y1: number; x2: number; y2: number; weight: number }[] = [
  { x1: 0, y1: 22, x2: 100, y2: 16, weight: 1 },
  { x1: 0, y1: 58, x2: 100, y2: 66, weight: 1.4 },
  { x1: 0, y1: 84, x2: 100, y2: 79, weight: 1 },
  { x1: 18, y1: 0, x2: 26, y2: 100, weight: 1.4 },
  { x1: 62, y1: 0, x2: 54, y2: 100, weight: 1 },
  { x1: 88, y1: 0, x2: 92, y2: 100, weight: 1 },
  { x1: 0, y1: 0, x2: 100, y2: 100, weight: 0.7 },
  { x1: 100, y1: 4, x2: 8, y2: 100, weight: 0.7 },
];

/** Halftone blocks: the zine's answer to "built-up area". Purely graphic. */
const BLOCKS: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 8, y: 26, w: 16, h: 12 },
  { x: 66, y: 20, w: 14, h: 16 },
  { x: 30, y: 68, w: 20, h: 11 },
  { x: 74, y: 60, w: 12, h: 14 },
];

export function FieldBackdrop({ patternKey = 'field' }: FieldBackdropProps) {
  const patternId = `qg-field-halftone-${patternKey}`;
  return (
    <div aria-hidden="true" className="field-layer field-layer-bg">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        focusable="false"
      >
        <defs>
          <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.55" fill="var(--line)" opacity="0.5" />
          </pattern>
        </defs>

        {BLOCKS.map((b) => (
          <rect
            key={`${b.x}-${b.y}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={`url(#${patternId})`}
            stroke="var(--line)"
            strokeWidth="0.35"
            opacity="0.55"
          />
        ))}

        {LATTICE.map((l) => (
          <line
            key={`${l.x1}-${l.y1}-${l.x2}-${l.y2}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="var(--line)"
            strokeWidth={l.weight * 0.4}
            opacity="0.32"
          />
        ))}
      </svg>
    </div>
  );
}
