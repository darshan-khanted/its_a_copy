// Distance rings at 250 / 500 / 1000 / 2000 m with mono labels (design §C.3 z 1, req 3.3).
//
// The radii come from the pure `fieldRings` model, which warps each ring with exactly the same
// function `projectToField` warps a node — so a node drawn on the 500 m ring is genuinely 500 m
// from the anchor. Decoration plus measurement: the rings are `aria-hidden` because the same
// distances are spoken in every node's accessible name (§I.3.2).
import type { FieldRing } from '@/features/field/lib/surface';

export interface FieldRingsProps {
  rings: readonly FieldRing[];
  /** Ring labels are hidden on the smallest screens where they collide (§I.7). */
  showLabels?: boolean;
}

export function FieldRings({ rings, showLabels = true }: FieldRingsProps) {
  return (
    <div aria-hidden="true" className="field-layer field-layer-rings">
      {rings.map((ring) => (
        <div key={ring.radiusM}>
          <div
            className="field-ring"
            style={{ width: `${ring.radiusPct * 2}%`, height: `${ring.radiusPct * 2}%` }}
          />
          {showLabels ? (
            <span
              style={{
                position: 'absolute',
                left: '50%',
                // sit the label ON the ring, just above its northern arc
                top: `calc(50% - ${ring.radiusPct}%)`,
                transform: 'translate(-50%, -50%)',
                padding: '0 var(--space-1)',
                backgroundColor: 'var(--surface-2)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-nano)',
                letterSpacing: '0.14em',
                color: 'var(--text-2)',
                whiteSpace: 'nowrap',
              }}
            >
              {ring.label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
