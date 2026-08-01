import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FieldSurface } from './FieldSurface';
import { createFieldTransform } from '@/features/field/lib/projection';
import { FIELD_WARP } from '@/features/field/lib/surface';
import { labels } from '@/copy/labels';
import { fieldVoice } from '@/copy/field';
import type { FieldSignal, Gig, RealFieldSignal } from '@/types';

const ANCHOR = { lat: 12.9121, lng: 77.6446 };
const transform = createFieldTransform(ANCHOR, 2000, FIELD_WARP);

function realSignal(over: Partial<RealFieldSignal> = {}): RealFieldSignal {
  return {
    kind: 'REAL_GIG',
    id: 'gig_1',
    fx: 0.62,
    fy: 0.4,
    distanceM: 312,
    bearingDeg: 44,
    price: 450,
    title: 'assemble my ikea desk pls',
    tone: 'cobalt',
    urgent: false,
    ageMins: 12,
    rot: 1.1,
    locked: false,
    headStart: false,
    ...over,
  };
}

function gig(over: Partial<Gig> = {}): Gig {
  return {
    id: 'gig_1',
    title: 'assemble my ikea desk pls',
    body: 'flat pack, one allen key, zero patience',
    askPrice: 450,
    tags: [],
    urgent: false,
    hoodId: '560102',
    areaLabel: 'HSR Layout',
    geoFuzzed: { lat: 12.9139, lng: 77.6472 },
    geohash7: 'tdr1bpz',
    fuzzSeedVersion: 1,
    startDate: '2026-01-01',
    startTime: 'FLEXIBLE',
    startHour: null,
    expiresAt: Date.now() + 3_600_000,
    state: 'OPEN',
    agreedHandshakeId: null,
    claimCount: 2,
    posterUid: 'uid_1',
    posterSnapshot: {
      uid: 'uid_1',
      handle: 'alpha',
      displayName: 'Aisha Khan',
      avatarSeed: 'seed',
      rank: 'HUSTLER',
      rep: 250,
      verified: true,
      gigsSettled: 4,
      rating: 4.6,
      ratingCount: 3,
    },
    minRank: null,
    visibleFrom: { legend: 0, all: 0 },
    createdAt: Date.now() - 720_000,
    schemaVersion: 2,
    ...over,
  };
}

function renderSurface(nodes: FieldSignal[], gigs: Gig[] = [gig()]) {
  return render(
    <MemoryRouter>
      <FieldSurface
        nodes={nodes}
        transform={transform}
        gigsById={new Map(gigs.map((g) => [g.id, g]))}
        boardPath="/hood/560102/board"
      />
    </MemoryRouter>,
  );
}

describe('the Field surface (reqs 3.3, 4.6, 20.9)', () => {
  it('is an application region with a spatial label and an escape instruction', () => {
    renderSurface([realSignal()]);
    const region = screen.getByRole('application', { name: fieldVoice.regionLabel });
    expect(region).toHaveProperty('tabIndex', 0);
    expect(screen.getByText(fieldVoice.regionHint)).toBeTruthy();
  });

  it('exposes SWITCH TO LIST as the first focusable element inside the region (req 4.6)', () => {
    renderSurface([realSignal()]);
    const region = screen.getByRole('application', { name: fieldVoice.regionLabel });
    const focusable = region.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
    expect(focusable[0].textContent).toBe(labels.switchToList);
    expect(within(region).getByRole('link', { name: labels.switchToList })).toHaveProperty(
      'pathname',
      '/hood/560102/board',
    );
  });

  it('draws the 250 / 500 / 1000 / 2000 m rings with mono labels (req 3.3)', () => {
    renderSurface([realSignal()]);
    for (const label of ['250 M', '500 M', '1 KM', '2 KM']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('names each node with its spatial narration, including claim count', () => {
    renderSurface([realSignal()]);
    const node = screen.getByRole('button', { name: /assemble my ikea desk pls/ });
    expect(node.getAttribute('aria-label')).toContain('300 m north-east');
    expect(node.getAttribute('aria-label')).toContain('2 people claimed');
  });

  it('renders no image, iframe or basemap tile — the paper is authored SVG (req 20.9)', () => {
    const { container } = renderSurface([realSignal()]);
    expect(container.querySelectorAll('img, iframe')).toHaveLength(0);
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('opens the drawer for a tapped signal, with public area data only (req 4.3, 20.9)', () => {
    renderSurface([realSignal()]);
    fireEvent.click(screen.getByRole('button', { name: /assemble my ikea desk pls/ }));
    const drawer = screen.getByRole('dialog', { name: fieldVoice.drawerLabel });
    // rendered as supplied and uppercased by CSS, never re-typed in JS (req 2.3)
    expect(within(drawer).getByText('HSR Layout')).toBeTruthy();
    expect(within(drawer).getByText(/2 CLAIMS/)).toBeTruthy();
    expect(within(drawer).getByRole('link', { name: labels.openSignal })).toHaveProperty(
      'pathname',
      '/g/gig_1',
    );
  });

  it('never opens anything for a hollow waitlist ghost (req 9.2)', () => {
    renderSurface(
      [
        {
          kind: 'WAITLIST_GHOST',
          id: 'ghost:560102:0',
          fx: 0.6,
          fy: 0.3,
          price: 0,
          title: 'WAITING',
          claimable: false,
          detailRoute: null,
        },
      ],
      [],
    );
    const ghost = screen.getByRole('button', { name: fieldVoice.ghostSignal });
    expect(ghost.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(ghost);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('states the node-budget truncation plainly when asked to (req 5.4)', () => {
    render(
      <MemoryRouter>
        <FieldSurface
          nodes={[realSignal()]}
          transform={transform}
          gigsById={new Map()}
          truncationLine="SHOWING 60 OF 214 · OPEN BOARD FOR ALL"
          boardPath="/hood/560102/board"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('SHOWING 60 OF 214 · OPEN BOARD FOR ALL')).toBeTruthy();
  });

  it('renders waitlist demand as a separate labelled indicator, not a node (req 9.10)', () => {
    render(
      <MemoryRouter>
        <FieldSurface
          nodes={[realSignal()]}
          transform={transform}
          gigsById={new Map([['gig_1', gig()]])}
          waitlistIndicator={{ label: 'WAITLIST', count: 12, progressTarget: 40 }}
          boardPath="/hood/560102/board"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/WAITLIST/)).toBeTruthy();
    // one node only: the real signal. The indicator is never a button.
    expect(screen.getAllByRole('button').filter((b) => b.dataset.kind)).toHaveLength(1);
  });
});
