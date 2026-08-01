import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Avatar,
  pickAvatarTone,
  initialsFrom,
  AVATAR_TONES,
  Price,
  StatusPill,
  RankChip,
  RedactedReveal,
  InkPress,
  InkBox,
} from './index';
import type { PublicIdentity } from '@/types/user';

const baseUser: PublicIdentity = {
  uid: 'uid_alpha',
  handle: 'alpha',
  displayName: 'Aisha Khan',
  avatarSeed: 'seed_alpha',
  rank: 'HUSTLER',
  rep: 250,
  verified: true,
  gigsSettled: 4,
  rating: 4.6,
  ratingCount: 3,
};

describe('avatar palette (deterministic zine avatar, req 1.9)', () => {
  it('picks a tone from the locked palette', () => {
    expect(AVATAR_TONES).toContain(pickAvatarTone('seed_alpha'));
  });

  it('is deterministic for the same seed', () => {
    expect(pickAvatarTone('seed_alpha')).toEqual(pickAvatarTone('seed_alpha'));
  });

  it('derives up to two uppercase initials', () => {
    expect(initialsFrom('Aisha Khan')).toBe('AK');
    expect(initialsFrom('madhu')).toBe('MA');
    expect(initialsFrom('   ')).toBe('?');
  });

  it('exposes the display name as an accessible label', () => {
    render(<Avatar user={baseUser} />);
    expect(screen.getByRole('img', { name: 'Aisha Khan' })).toBeTruthy();
  });
});

describe('Price (req 2.4 Indian currency)', () => {
  it('prefixes ₹ and groups with the lakh convention', () => {
    const { container } = render(<Price amount={100000} />);
    expect(container.textContent).toContain('₹1,00,000');
  });

  it('renders a struck original when strike is provided', () => {
    const { container } = render(<Price amount={520} strike={450} />);
    expect(container.textContent).toContain('₹450');
    expect(container.textContent).toContain('₹520');
  });
});

describe('StatusPill (status paired with text, req 27.4)', () => {
  it('renders the label text for a gig state', () => {
    const { container } = render(<StatusPill status="OPEN" />);
    expect(container.textContent).toContain('OPEN');
  });

  it('renders a handshake state label', () => {
    const { container } = render(<StatusPill status="AGREED" />);
    expect(container.textContent).toContain('AGREED');
  });
});

describe('RankChip', () => {
  it('shows the two-digit rank number', () => {
    const { container } = render(<RankChip rank="LEGEND" />);
    expect(container.textContent).toContain('03');
  });

  it('exposes an accessible label when locked', () => {
    render(<RankChip rank="MAX_CHARISMA" locked />);
    expect(screen.getByRole('img', { name: /locked rank/i })).toBeTruthy();
  });
});

describe('RedactedReveal (req 27.11 — blur is never the sole carrier)', () => {
  it('carries a real accessible label when locked', () => {
    render(
      <RedactedReveal locked unlockHint="hits at rank 04" hiddenLabel="locked reward">
        secret perk
      </RedactedReveal>,
    );
    expect(screen.getByRole('img', { name: /locked reward · hits at rank 04/i })).toBeTruthy();
  });

  it('renders children plainly when unlocked', () => {
    const { container } = render(<RedactedReveal locked={false}>the perk</RedactedReveal>);
    expect(container.textContent).toContain('the perk');
    expect(container.querySelector('.redacted')).toBeNull();
  });
});

describe('InkPress', () => {
  it('renders a button by default', () => {
    render(<InkPress>go</InkPress>);
    expect(screen.getByRole('button', { name: 'go' })).toBeTruthy();
  });

  it('renders an anchor when href is supplied', () => {
    render(<InkPress href="/hood/560001">open</InkPress>);
    const link = screen.getByRole('link', { name: 'open' });
    expect(link.getAttribute('href')).toBe('/hood/560001');
  });

  it('shows the loading label and disables while loading', () => {
    render(
      <InkPress loading loadingLabel="sending the flare…">
        flare
      </InkPress>,
    );
    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('sending the flare…');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('InkBox surfaces', () => {
  it('maps pop + popColor to the token utility classes', () => {
    const { container } = render(
      <InkBox pop="lg" popColor="cobalt">
        card
      </InkBox>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('ink-box-lg');
    expect(el.className).toContain('ink-box-cobalt');
  });

  it('renders the requested element and adds the flat modifier', () => {
    const { container } = render(
      <InkBox as="section" flat>
        flat
      </InkBox>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName.toLowerCase()).toBe('section');
    expect(el.className).toContain('flat');
  });
});
