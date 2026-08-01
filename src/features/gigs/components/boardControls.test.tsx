// The Board's filter state lives in the URL (req 25.1) and mode switching is one action
// (req 7.3, 7.4). Both are exercised here against a real router, with no Firebase in the
// import graph — these components are pure URL/DOM.
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BoardControls } from './BoardControls';
import { ModeToggle } from '@/components/layout/ModeToggle';
import { labels } from '@/copy/labels';
import { readLastMode } from '@/lib/prefs';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="loc">{location.pathname + location.search}</span>;
}

function mount(ui: React.ReactNode, initial = '/hood/560102/board') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/hood/:pin/board"
          element={
            <>
              {ui}
              <LocationProbe />
            </>
          }
        />
        <Route path="/hood/:pin" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const loc = () => screen.getByTestId('loc').textContent;
const sortButton = (label: string) => screen.getByRole('button', { name: new RegExp(label) });

describe('BoardControls (req 7.2, 7.5, 25.1)', () => {
  it('writes the chosen sort into the URL and marks it selected', () => {
    mount(<BoardControls resultsId="board-results" />);

    fireEvent.click(sortButton(labels.distance));

    expect(loc()).toContain('sort=distance');
    expect(sortButton(labels.distance).getAttribute('aria-pressed')).toBe('true');
    expect(sortButton(labels.recency).getAttribute('aria-pressed')).toBe('false');
  });

  it('writes the search query into the URL and offers no category taxonomy', () => {
    mount(<BoardControls resultsId="board-results" />);

    const box = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'ikea' } });

    expect(loc()).toContain('q=ikea');
    // exactly one search box and no select/dropdown — the Board has no categories (req 7.5)
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('reads its initial state back from the URL and can clear the search', () => {
    mount(<BoardControls resultsId="board-results" />, '/hood/560102/board?sort=price&q=dog');

    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('dog');
    expect(sortButton(labels.price).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: new RegExp(labels.clearSearch) }));
    expect(loc()).not.toContain('q=');
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  });
});

describe('ModeToggle (req 7.3, 7.4)', () => {
  beforeEach(() => localStorage.clear());

  it('switches to the Field in one action, keeps the filters, and persists the choice', () => {
    mount(<ModeToggle />, '/hood/560102/board?sort=price');

    expect(sortButton(labels.board).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(sortButton(labels.field));

    expect(loc()).toBe('/hood/560102?sort=price');
    expect(readLastMode()).toBe('field');
  });
});
