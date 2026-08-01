// THE Field surface (design §C.3, §C.4, §C.6, §I.3, §I.5; requirements 3.3, 3.9, 4.1–4.9,
// 5.4, 5.7, 9.10, 20.9, 28.8, 28.9, 28.13).
//
// This is the radar itself: the layer ladder (paper → rings → radar/spotlight → YOU → nodes →
// drawer), the multimodal scan, geographic keyboard traversal, and the polite live region. It
// renders what the pure modules derive and computes no geometry of its own per frame:
//
//   - node positions come from the projection/clustering pipeline and are cached in px once per
//     projection or resize, so the scan reads NO layout geometry per pointer move (req 4.8);
//   - the spotlight is written as `--mx`/`--my` on the disc by the scan hook, outside React,
//     so following a finger never re-renders a component (req 4.9);
//   - the transform is re-derived by the caller only on anchor, radius or viewport change (req 5.7).
//
// There is no basemap and no Google Maps JavaScript in this module's graph — the Field draws its
// own paper (req 3.10, 20.9, 28.8, NFR-1.1).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FieldBackdrop } from '@/features/field/components/FieldBackdrop';
import { FieldRings } from '@/features/field/components/FieldRings';
import { FieldNode } from '@/features/field/components/FieldNode';
import { SignalDrawer } from '@/features/field/components/SignalDrawer';
import { useProximityScan } from '@/features/field/hooks/useProximityScan';
import { useFieldKeyboard } from '@/features/field/hooks/useFieldKeyboard';
import { useSpatialAnnouncer } from '@/features/field/hooks/useSpatialAnnouncer';
import { useElementSize } from '@/hooks/useElementSize';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fieldRings, nodePositionsPx, positionPercent } from '@/features/field/lib/surface';
import { moveAnnouncement, nodeAccessibleName } from '@/features/field/lib/narration';
import type { FieldTransform } from '@/features/field/lib/projection';
import { labels } from '@/copy/labels';
import { fieldVoice } from '@/copy/field';
import { distanceWords, rupees } from '@/lib/format';
import type { FieldSignal, Gig, WaitlistDemandIndicator } from '@/types';

const MONO = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-micro)',
  letterSpacing: '0.14em',
  color: 'var(--text-2)',
} as const;

/** Stagger between node pulses, in ms — decoration, capped by the node budget (§I.5). */
const NODE_STAGGER_MS = 90;

const HINT_ID = 'qg-field-hint';

export interface FieldSurfaceProps {
  /** Rendered node layer: clustered real signals, or hollow ghosts at zero real supply. */
  nodes: readonly FieldSignal[];
  /** The projection transform, so rings are warped exactly as nodes are (req 3.3). */
  transform: FieldTransform;
  /** Public gig documents by id, for drawer detail and claim counts. Fuzzed data only. */
  gigsById: ReadonlyMap<string, Gig>;
  /** Ids of gigs posted by the operating team (req 9.6). */
  teamGigIds?: readonly string[];
  /** Separately positioned waitlist demand indicator — never a node (req 9.10). */
  waitlistIndicator?: WaitlistDemandIndicator | null;
  /** `SHOWING 60 OF 214 · OPEN BOARD FOR ALL` when the node budget truncates (req 5.4). */
  truncationLine?: string | null;
  /** The hood Board route, where every signal stays reachable (req 4.6, 5.4). */
  boardPath: string;
}

export function FieldSurface({
  nodes,
  transform,
  gigsById,
  teamGigIds = [],
  waitlistIndicator = null,
  truncationLine = null,
  boardPath,
}: FieldSurfaceProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(discRef);
  const reducedMotion = useReducedMotion();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  const { message, announce } = useSpatialAnnouncer();

  const teamIds = useMemo(() => new Set(teamGigIds), [teamGigIds]);

  // Accessible names are derived once per node set, not per pointer move (§I.3.2).
  const names = useMemo(
    () =>
      nodes.map((node) =>
        nodeAccessibleName(node, {
          claimCount: node.kind === 'REAL_GIG' ? gigsById.get(node.id)?.claimCount ?? 0 : 0,
        }),
      ),
    [nodes, gigsById],
  );

  // Cached px positions: recomputed only when the node set or the measured disc changes (req 4.8, 5.7).
  const positionsPx = useMemo(
    () => nodePositionsPx(nodes, width, height || width),
    [nodes, width, height],
  );

  const geometry = useMemo(() => nodes.map((n) => ({ fx: n.fx, fy: n.fy })), [nodes]);
  const rings = useMemo(() => fieldRings(transform), [transform]);

  const openNode = useCallback(
    (index: number) => {
      const node = nodes[index];
      // Ghosts are not gigs: they open nothing and claim nothing (req 9.2).
      if (!node || node.kind === 'WAITLIST_GHOST') return;
      setActiveIndex(index);
      setOpenIndex(index);
      announce(moveAnnouncement(names[index] ?? ''));
    },
    [nodes, names, announce],
  );

  const closeDrawer = useCallback(() => setOpenIndex(null), []);

  const { isScanning } = useProximityScan({
    fieldRef: discRef,
    positionsPx,
    onActiveChange: setActiveIndex,
    onTap: (index) => {
      if (index !== null) openNode(index);
    },
    enabled: nodes.length > 0,
  });

  useFieldKeyboard({
    fieldRef: regionRef,
    nodes: geometry,
    activeIndex,
    setActiveIndex,
    onOpen: openNode,
    onEscape: closeDrawer,
    drawerOpen: openIndex !== null,
    announce,
    describe: (index) => moveAnnouncement(names[index] ?? ''),
    enabled: nodes.length > 0,
  });

  // Off-screen node pulses are paused for the frame budget (§I.5, req 28.13). One observer on
  // the disc, never one per node.
  useEffect(() => {
    const el = discRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => setOffscreen(!entries.some((e) => e.isIntersecting)),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Reduced motion: the spotlight becomes a static ring that JUMPS to the active node instead of
  // following the pointer — same information, no continuous motion (§C.4, NFR-2.4). Written as a
  // custom property, exactly like the scan hook, so nothing re-renders.
  useEffect(() => {
    const el = discRef.current;
    if (!el || !reducedMotion) return;
    const node = activeIndex !== null ? nodes[activeIndex] : null;
    const pos = node ? positionPercent(node) : { left: '50%', top: '50%' };
    el.style.setProperty('--mx', pos.left);
    el.style.setProperty('--my', pos.top);
  }, [reducedMotion, activeIndex, nodes]);

  const activeNode = activeIndex !== null ? nodes[activeIndex] ?? null : null;
  const activeGig = activeNode?.kind === 'REAL_GIG' ? gigsById.get(activeNode.id) : undefined;
  const openNodeValue = openIndex !== null ? nodes[openIndex] ?? null : null;
  const openGig = openNodeValue?.kind === 'REAL_GIG' ? gigsById.get(openNodeValue.id) : undefined;
  const openDistanceM = openNodeValue?.kind === 'REAL_GIG' ? openNodeValue.distanceM : undefined;

  return (
    <div
      ref={regionRef}
      role="application"
      tabIndex={0}
      aria-label={fieldVoice.regionLabel}
      aria-describedby={HINT_ID}
      aria-activedescendant={activeNode ? nodeDomId(activeNode.id) : undefined}
      style={{ display: 'grid', gap: 'var(--space-3)' }}
    >
      {/* The escape hatch, first focusable inside the region (req 4.6, §I.3.4). */}
      <Link
        to={boardPath}
        className="ink-box-sm flat ink-press tap-target"
        style={{
          ...MONO,
          color: 'var(--text-1)',
          textDecoration: 'none',
          justifySelf: 'start',
          padding: 'var(--space-2) var(--space-3)',
        }}
      >
        {labels.switchToList}
      </Link>

      <p id={HINT_ID} className="qg-sr-only">
        {fieldVoice.regionHint}
      </p>

      <div ref={discRef} className="field-disc">
        <FieldBackdrop />
        <FieldRings rings={rings} />

        {/* radar sweep + spotlight, z 2. Decorative; the sweep is off under reduced motion. */}
        {reducedMotion ? null : (
          <div aria-hidden="true" className="field-layer field-layer-radar radar field-radar-sweep" />
        )}
        <div
          aria-hidden="true"
          className={`field-layer field-layer-radar ${
            reducedMotion ? 'field-spotlight-static' : 'field-spotlight'
          }`}
        />

        {/* the anchor marker, z 8 */}
        <div aria-hidden="true" className="field-layer field-layer-you">
          <span
            className={reducedMotion ? undefined : 'youpulse'}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'grid',
              placeItems: 'center',
              width: '26px',
              height: '26px',
              borderRadius: 'var(--radius-chip)',
              backgroundColor: 'var(--surface-raised)',
              border: 'var(--box-border) solid var(--line)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-nano)',
              letterSpacing: '0.1em',
              color: 'var(--text-1)',
            }}
          >
            {labels.you}
          </span>

          {/* Waitlist demand: a separately positioned, labelled indicator — never a node and
              never counted as supply (req 9.10). */}
          {waitlistIndicator ? (
            <span
              className="ink-box-sm flat"
              style={{
                position: 'absolute',
                right: 'var(--space-3)',
                top: 'var(--space-3)',
                padding: 'var(--space-1) var(--space-2)',
                ...MONO,
                color: 'var(--text-1)',
              }}
            >
              {waitlistIndicator.label}
              <span aria-hidden="true"> · </span>
              {waitlistIndicator.progressTarget
                ? `${waitlistIndicator.count} / ${waitlistIndicator.progressTarget}`
                : waitlistIndicator.count}
            </span>
          ) : null}
        </div>

        {/* signal nodes, z 10 */}
        <div className="field-layer field-layer-nodes">
          {nodes.map((node, index) => (
            <FieldNode
              key={node.id}
              id={nodeDomId(node.id)}
              node={node}
              index={index}
              active={index === activeIndex}
              accessibleName={names[index] ?? ''}
              onActivate={openNode}
              delayMs={(index % 8) * NODE_STAGGER_MS}
              offscreen={offscreen}
              team={teamIds.has(node.id)}
            />
          ))}
        </div>

        <SignalDrawer
          node={openNodeValue}
          gig={openGig}
          distanceM={openDistanceM}
          boardPath={boardPath}
          onClose={closeDrawer}
        />
      </div>

      {/* Live proximity readout. Pointer previews are aria-hidden: announcing every move would
          be unusable, so only deliberate changes reach the live region below (§I.3.5). */}
      <p aria-hidden="true" style={{ ...MONO, margin: 0, minHeight: '1.2em' }}>
        {activeNode && activeNode.kind === 'REAL_GIG' ? (
          <>
            {rupees(activeNode.price)}
            <span> · </span>
            {distanceWords(activeNode.distanceM).toUpperCase()}
            {activeGig ? <span> · {activeGig.areaLabel.toUpperCase()}</span> : null}
          </>
        ) : activeNode && activeNode.kind === 'REAL_GIG_CLUSTER' ? (
          <>
            {activeNode.count}
            <span> · </span>
            {rupees(activeNode.totalValue)}
          </>
        ) : isScanning ? (
          labels.signals
        ) : (
          ''
        )}
      </p>

      {truncationLine ? <p style={{ ...MONO, margin: 0 }}>{truncationLine}</p> : null}

      {/* Rate-limited polite live region for deliberate moves only (§I.3.5). */}
      <p role="status" aria-live="polite" className="qg-sr-only">
        {message}
      </p>
    </div>
  );
}

/** Stable DOM id for a node, so `aria-activedescendant` can point at it. */
function nodeDomId(signalId: string): string {
  return `qg-field-node-${signalId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}
