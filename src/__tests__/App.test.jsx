import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App.jsx';
import { STORAGE_KEY } from '../game/state.js';

const card = (rank, suit) => {
  const values = { A: 1, J: 11, Q: 12, K: 13 };
  return {
    rank,
    suit,
    value: values[rank] ?? Number(rank),
    isRed: suit === '♥' || suit === '♦',
    id: `${rank}${suit}`
  };
};

/** A tiny hand-dealt board: A♥ and K♠ on top, two nines, two sevens. */
const seed = {
  tableau: [
    [card('4', '♣'), card('A', '♥')],
    [card('6', '♥'), card('K', '♠')],
    [card('9', '♦')],
    [card('9', '♣')],
    [card('7', '♦')],
    [card('7', '♣')],
    [],
    [card('Q', '♣')]
  ],
  pairs: [],
  dominos: [],
  chains: [],
  moveCount: 0
};

const statValue = (label) => {
  const stat = screen.getByText(label, { selector: '.stat__label' }).closest('.stat');
  return within(stat).getByText((_, node) => node?.classList.contains('stat__value')).textContent;
};

describe('<App />', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  });

  afterEach(cleanup);

  it('deals the saved board', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('[data-drop-kind="column"]')).toHaveLength(8);
    expect(statValue('on board')).toBe('9');
    expect(statValue('pairs')).toBe('0/6');
  });

  it('moves a card onto a matching rank', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText('9 of ♦'));
    fireEvent.click(screen.getByLabelText('9 of ♣'));
    expect(container.querySelectorAll('[data-drop-index="3"][data-drop-kind="column"] .card')).toHaveLength(2);
    expect(statValue('moves')).toBe('1');
  });

  it('marks a column that would complete fourteen', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText('A of ♥'));
    expect(
      container.querySelector('[data-drop-index="1"][data-drop-kind="column"]').className
    ).toContain('column--pair');
  });

  it('lifts a pair off the table and into the workyard', () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText('A of ♥'));
    fireEvent.click(screen.getByLabelText('K of ♠'));
    expect(statValue('pairs')).toBe('1/6');
    expect(screen.getByLabelText('Pair A–K')).toBeInTheDocument();
  });

  it('refuses an illegal landing and keeps the card in hand', () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText('Q of ♣'));
    fireEvent.click(screen.getByLabelText('9 of ♦'));
    expect(statValue('moves')).toBe('0');
  });

  it('forges a domino from two pairs, then opens a chain with it', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText('A of ♥'));
    fireEvent.click(screen.getByLabelText('K of ♠'));
    fireEvent.click(screen.getByLabelText('7 of ♦'));
    fireEvent.click(screen.getByLabelText('7 of ♣'));
    expect(statValue('pairs')).toBe('2/6');

    fireEvent.click(screen.getByLabelText('Pair A–K'));
    fireEvent.click(screen.getByLabelText('Pair 7–7'));
    expect(statValue('dominos')).toBe('1');

    fireEvent.click(screen.getByLabelText('Domino A–K and 7–7'));
    expect(statValue('chained')).toBe('1/13');
    expect(container.querySelectorAll('.socket')).toHaveLength(2);
  });

  it('arms a chain socket for the next domino', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText('A of ♥'));
    fireEvent.click(screen.getByLabelText('K of ♠'));
    fireEvent.click(screen.getByLabelText('7 of ♦'));
    fireEvent.click(screen.getByLabelText('7 of ♣'));
    fireEvent.click(screen.getByLabelText('Pair A–K'));
    fireEvent.click(screen.getByLabelText('Pair 7–7'));
    fireEvent.click(screen.getByLabelText('Domino A–K and 7–7'));

    fireEvent.click(container.querySelector('.socket--end'));
    expect(container.querySelector('.socket--end').className).toContain('is-armed');
  });

  it('undoes a move, and stops offering undo once a chain is laid', () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText('9 of ♦'));
    fireEvent.click(screen.getByLabelText('9 of ♣'));
    expect(statValue('moves')).toBe('1');

    fireEvent.click(screen.getByTitle('Undo the last move'));
    expect(statValue('moves')).toBe('0');
    expect(screen.getByTitle('Undo the last move')).toBeDisabled();
  });

  it('writes the board to storage as it goes', () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText('A of ♥'));
    fireEvent.click(screen.getByLabelText('K of ♠'));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.pairs).toHaveLength(1);
  });

  it('explains itself', () => {
    render(<App />);
    fireEvent.click(screen.getByTitle('How to play'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('How to play')).toBeInTheDocument();
  });

  it('asks before sweeping a board that has been played', () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText('9 of ♦'));
    fireEvent.click(screen.getByLabelText('9 of ♣'));
    fireEvent.click(screen.getByTitle('Deal a new game'));
    expect(screen.getByText('Deal a new game?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deal again' }));
    expect(statValue('on board')).toBe('52');
    expect(statValue('moves')).toBe('0');
  });
});
