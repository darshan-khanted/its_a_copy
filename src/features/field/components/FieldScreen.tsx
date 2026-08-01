// The Field — the default authenticated route `/hood/:pin` (design §C, §F.2; requirements 3.1,
// 3.2, 3.3, 3.4, 3.9, 3.10, 4.6, 4.9, 5.7, 9.9, 20.9, 28.8, 28.9; NFR-1.1, NFR-1.4).
//
// This screen owns DATA and DERIVATION; `FieldSurface` owns the DOM and the interaction. The
// pipeline is composed from the pure modules and never reimplemented here:
//
//   useHoodGigs (hood-scoped, visibility-filtered)   →  fuzzed public gigs only
//   createFieldTransform (anchor + radius)           →  §H.1 projection
//   deriveRealSignals                                →  positions from `geoFuzzed` ONLY
//   clusterField                                     →  48 px cells, 60-node budget, repulsion
//   deriveSupplyPresentation (cluster injected)      →  honest real count / value / actions
//
// Privacy: every position on this surface comes from the gig's *published fuzzed* coordinate and
// its public `areaLabel`. The private exact-location subdocument is never read here, and there is
// no basemap to resolve a node against (req 3.2, 20.9, NFR-4.5).
//
// Performance: no Google Maps JavaScript is imported anywhere in this module's graph — the
// precision map is reachable only through the lazily-loaded boundary on `/flare` and `/live`
// (req 3.10, 28.8, NFR-1.1, and `@/features/map/precisionMap`).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useHoodContext } from '@/app/providers/HoodProvider';
import { useHoodGigs } from '@/features/field/hooks/useHoodGigs';
import { usePreciseAnchor } from '@/features/field/hooks/usePreciseAnchor';
import { useFieldClock } from '@/features/field/hooks/useFieldClock';
import { useElementSize } from '@/hooks/useElementSize';
import { PreLaunchHood } from '@/features/hood/PreLaunchHood';
import { canActInHood } from '@/features/hood/lib/stats';
import { FieldSurface } from '@/features/field/components/FieldSurface';
import {
  FieldAnchorLine,
  FieldFooter,
  FieldTopLine,
} from '@/features/field/components/FieldChrome';
import { EmptyState, Skeleton } from '@/components/ink';
import { createFieldTransform } from '@/features/field/lib/projection';
import { FIELD_MAX_WIDTH_PX, FIELD_WARP } from '@/features/field/lib/surface';
import {
  boardRouteFor,
  clusterField,
  DEFAULT_FIELD_SIZE_PX,
} from '@/features/field/lib/clustering';
import {
  deriveRealSignals,
  deriveSupplyPresentation,
  type SupplyAction,
} from '@/features/field/lib/supply';
import type { RealFieldSignal } from '@/types';
import { writeLastMode, hoodPathForMode } from '@/lib/prefs';
import { coordinateLine } from '@/lib/format';
import { labels } from '@/copy/labels';
import { loading as loadingCopy } from '@/copy/loading';
import { empty } from '@/copy/empty';

const MONO = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-micro)',
  letterSpacing: '0.14em',
  color: 'var(--text-2)',
} as const;

const NEARBY_ID = 'qg-nearby-hoods';

export function FieldScreen() {
  const { pincode, hood, radiusM, loading: hoodLoading } = useHoodContext();
  const { gigs, loading } = useHoodGigs(pincode);
  const precision = usePreciseAnchor();
  const clock = useFieldClock();

  const containerRef = useRef<HTMLElement>(null);
  const { width } = useElementSize(containerRef);

  // Remember the Field as the last chosen surface (req 7.4). The URL already carries the mode.
  useEffect(() => {
    writeLastMode('field');
  }, []);

  // A single clock read per gig-set change: signal ages and head-start windows are evaluated
  // against it, so every derived value in one render agrees with every other.
  const now = useMemo(() => Date.now(), [gigs]);

  // The 48 px clustering grid is defined in rendered pixels, so it needs the Field's size. The
  // disc is the container width, capped exactly as `.field-disc` caps it.
  const fieldSizePx = width > 0 ? Math.min(width, FIELD_MAX_WIDTH_PX) : DEFAULT_FIELD_SIZE_PX;
  const boardPath = pincode ? boardRouteFor(pincode) : '/claim';

  // The anchor: the hood centroid by default — no location permission required — or the user's
  // live point once they opt in, which also flips the surface to `PRECISION: ON` (req 3.4, §C.2).
  const anchor = precision.point ?? hood?.centroid ?? null;

  // Re-derived ONLY on anchor / radius change; the viewport affects px caches, not the transform
  // (req 5.7). `radiusM` is 2000 m by default (req 3.3).
  const transform = useMemo(
    () => (anchor ? createFieldTransform(anchor, radiusM, FIELD_WARP) : null),
    [anchor?.lat, anchor?.lng, radiusM],
  );

  // Positions come from `geoFuzzed` only — `deriveRealSignals` has no access to anything else.
  const signals = useMemo(
    () => (hood && transform ? deriveRealSignals(gigs, hood, { now, transform }) : []),
    [gigs, hood, transform, now],
  );

  const clusterOptions = useMemo(
    () => ({ fieldSizePx, boardRoute: boardPath }),
    [fieldSizePx, boardPath],
  );

  // Clustering, the 60-node budget, and ring-preserving repulsion (reqs 5.1–5.5).
  const clustered = useMemo(() => clusterField(signals, clusterOptions), [signals, clusterOptions]);

  // The same clustering wired into the honest-supply derivation, which verifies that the
  // transform preserved the real count and the real value before it trusts it (req 9.9).
  const cluster = useCallback(
    (input: readonly RealFieldSignal[]) => clusterField(input, clusterOptions).nodes,
    [clusterOptions],
  );

  const presentation = useMemo(
    () =>
      hood && transform
        ? deriveSupplyPresentation(gigs, hood, { now, transform, cluster })
        : null,
    [gigs, hood, transform, now, cluster],
  );

  const gigsById = useMemo(() => new Map(gigs.map((g) => [g.id, g])), [gigs]);

  // Ghost nodes exist only at zero real supply; with any real supply the node layer is the
  // clustered real signals and nothing else (req 9.8).
  const nodes = useMemo(() => {
    if (!presentation) return [];
    return presentation.realCount === 0 ? presentation.ghosts : clustered.nodes;
  }, [presentation, clustered]);

  if (hoodLoading) {
    return (
      <section style={{ padding: 'var(--space-4)' }}>
        <Skeleton lines={3} statusLine={loadingCopy.field[1]} />
      </section>
    );
  }

  // An unresolved pincode has no anchor, so there is no honest Field to draw. Say so and offer
  // the claim flow rather than rendering an empty disc that implies a quiet hood (§K.4).
  if (!hood) {
    return (
      <section style={{ padding: 'var(--space-4)' }}>
        <EmptyState
          art="no-signals"
          title={empty.unknownHood.title}
          body={empty.unknownHood.body}
          action={
            <Link
              to="/claim"
              className="ink-box-sm ink-press tap-target"
              style={{
                ...MONO,
                color: 'var(--text-1)',
                textDecoration: 'none',
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: 'var(--color-lime)',
              }}
            >
              {labels.switchHood}
            </Link>
          }
        />
      </section>
    );
  }

  // A hood below its launch switch shows the pre-launch experience instead of a live board
  // (design §C.7, req 8.10). Browsing is never gated (req 23.1) — this IS the browse surface for
  // a not-yet-live hood. Same gate, same component, as the Board.
  if (!canActInHood(hood)) {
    return <PreLaunchHood hood={hood} />;
  }

  const heading = hood.area || `hood ${pincode ?? ''}`.trim();
  const nearbyHoodIds = presentation?.nearbyHoodIds ?? [];

  return (
    <section
      ref={containerRef}
      aria-labelledby="field-heading"
      style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}
    >
      <FieldTopLine hoodName={heading} clock={clock} />

      <h1
        id="field-heading"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'var(--text-h2)',
          textTransform: 'lowercase',
          margin: 0,
        }}
      >
        {heading}
      </h1>

      {loading || !presentation || !transform ? (
        <Skeleton lines={4} statusLine={loadingCopy.field[0]} />
      ) : (
        <>
          <FieldSurface
            nodes={nodes}
            transform={transform}
            gigsById={gigsById}
            teamGigIds={presentation.teamGigIds}
            waitlistIndicator={presentation.waitlistIndicator}
            truncationLine={clustered.truncationLine}
            boardPath={boardPath}
          />

          <FieldFooter realCount={presentation.realCount} realValue={presentation.realValue} />

          {/* real hood centroid (or the opted-in live point) to four decimal places (req 3.9) */}
          <FieldAnchorLine
            coordinate={anchor ? coordinateLine(anchor.lat, anchor.lng) : ''}
            precision={precision}
          />

          {/* Honest cold-start / sparse-board block: exact real numbers, real actions, and the
              first-flare bonus only where it is genuinely earned (req 9.9, 9.11, 9.4, 9.5). */}
          {presentation.copy ? (
            <EmptyState
              art={presentation.state === 'ZERO_SUPPLY' ? 'ghost-town' : 'no-signals'}
              title={presentation.copy.title}
              body={presentation.copy.body}
              action={
                <span style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {presentation.actions.map((action) => (
                    <SupplyActionControl key={action.id} action={action} nearbyId={NEARBY_ID} />
                  ))}
                </span>
              }
            />
          ) : null}

          {presentation.launchMeter ? (
            <p
              role="meter"
              aria-valuenow={presentation.launchMeter.current}
              aria-valuemin={0}
              aria-valuemax={presentation.launchMeter.target}
              aria-label={presentation.launchMeter.line}
              style={{ ...MONO, margin: 0 }}
            >
              {presentation.launchMeter.line}
            </p>
          ) : null}

          {presentation.firstFlareBonusLine ? (
            <p style={{ ...MONO, color: 'var(--accent-text)', margin: 0 }}>
              {presentation.firstFlareBonusLine}
            </p>
          ) : null}

          {presentation.state !== 'HEALTHY' && nearbyHoodIds.length > 0 ? (
            <nav id={NEARBY_ID} aria-label={labels.lookAtNearbyHoods}>
              <p style={{ ...MONO, margin: '0 0 var(--space-2)' }}>{labels.lookAtNearbyHoods}</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 'var(--space-2)' }}>
                {nearbyHoodIds.map((pin) => (
                  <li key={pin}>
                    <Link to={hoodPathForMode(pin)} style={{ color: 'var(--text-1)' }}>
                      hood {pin} ·{' '}
                      {/* results from the adjacency widening are labelled further away (req 9.5) */}
                      <span style={MONO}>{presentation.nearbyLabel}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

/** One honest supply action. Flare actions are withheld until the hood is live (req 8.10). */
function SupplyActionControl({ action, nearbyId }: { action: SupplyAction; nearbyId: string }) {
  const style = {
    ...MONO,
    color: 'var(--text-1)',
    textDecoration: 'none',
    padding: 'var(--space-2) var(--space-4)',
    backgroundColor: action.emphasis === 'primary' ? 'var(--color-lime)' : 'var(--surface-raised)',
  } as const;
  const className = `ink-box-sm ink-press tap-target${action.emphasis === 'primary' ? '' : ' flat'}`;

  if (action.id === 'LOOK_AT_NEARBY_HOODS') {
    return (
      <a href={`#${nearbyId}`} className={className} style={style}>
        {action.label}
      </a>
    );
  }

  if (action.id === 'PULL_FRIENDS_IN') {
    return <ShareHoodButton className={className} style={style} label={action.label} />;
  }

  if (action.disabled) {
    return (
      <span className={`${className} flat`} style={{ ...style, opacity: 0.6 }} aria-disabled="true">
        {action.label} · {labels.notLive}
      </span>
    );
  }

  return (
    <Link to="/flare" className={className} style={style}>
      {action.label}
    </Link>
  );
}

/**
 * Recruit action (req 9.4). Uses the Web Share API where present and falls back to the clipboard;
 * the full share/notification transport lands in Phase 5.
 */
function ShareHoodButton({
  className,
  style,
  label,
}: {
  className: string;
  style: CSSProperties;
  label: string;
}) {
  const [shared, setShared] = useState(false);
  const onShare = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      void nav.share({ url }).catch(() => undefined);
    } else if (nav?.clipboard) {
      void nav.clipboard.writeText(url).catch(() => undefined);
    }
    setShared(true);
  }, []);

  return (
    <button type="button" className={className} style={style} onClick={onShare}>
      {shared ? labels.shareThisHood : label}
    </button>
  );
}
