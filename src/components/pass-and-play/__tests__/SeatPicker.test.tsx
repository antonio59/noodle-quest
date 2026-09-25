import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SeatPicker } from '../SeatPicker';

const ME = { name: 'Dad', avatar: '🐻' };
const FAMILY = [ME, { name: 'Mia', avatar: '🦊' }, { name: 'Leo', avatar: '🐸' }];

function renderPicker(overrides: Partial<Parameters<typeof SeatPicker>[0]> = {}) {
  const props = {
    gameId: 'chess', gameName: 'Chess', gameEmoji: '♔', min: 2, max: 2,
    me: ME, family: FAMILY, onStart: vi.fn(), onCancel: vi.fn(), ...overrides,
  };
  render(<SeatPicker {...props} />);
  return props;
}

const turnOrder = () => within(screen.getByRole('region', { name: 'Players in turn order' })).queryAllByRole('listitem');
const letsPlay = () => screen.getByRole('button', { name: "Let's play" });

describe('SeatPicker', () => {
  test('seats the signed-in player first and waits for a second player', () => {
    renderPicker();
    expect(turnOrder()[0]).toHaveTextContent('Dad');
    expect(letsPlay()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Pick at least 2 players');
  });

  test('tapping family members seats them in tap order and starts the game', () => {
    const props = renderPicker({ max: 3 });
    fireEvent.click(screen.getByRole('button', { name: /Leo/, pressed: false }));
    fireEvent.click(screen.getByRole('button', { name: /Mia/, pressed: false }));
    fireEvent.click(letsPlay());
    expect(props.onStart).toHaveBeenCalledWith([ME, FAMILY[2], FAMILY[1]]);
  });

  test('tapping a seated person again, or their ✕, unseats them', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Mia/, pressed: false }));
    fireEvent.click(screen.getByRole('button', { name: /Mia/, pressed: true }));
    expect(turnOrder().some(li => li.textContent?.includes('Mia'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Dad' }));
    expect(turnOrder().some(li => li.textContent?.includes('Dad'))).toBe(false);
  });

  test('a full table disables everyone else', () => {
    renderPicker({ max: 2 });
    fireEvent.click(screen.getByRole('button', { name: /Mia/, pressed: false }));
    expect(screen.getByRole('button', { name: /Leo/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Guest name' })).toBeDisabled();
  });

  test('guests can be added once, with a trimmed name', () => {
    const props = renderPicker({ family: [], max: 3 });
    const input = screen.getByRole('textbox', { name: 'Guest name' });
    fireEvent.change(input, { target: { value: '  Granny  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add guest' }));
    fireEvent.change(input, { target: { value: 'granny' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add guest' }));
    expect(turnOrder().filter(li => /granny/i.test(li.textContent ?? ''))).toHaveLength(1);
    fireEvent.click(letsPlay());
    expect(props.onStart).toHaveBeenCalledWith([ME, expect.objectContaining({ name: 'Granny' })]);
  });

  test('hides the family section when there is nobody to pick', () => {
    renderPicker({ family: [] });
    expect(screen.queryByRole('region', { name: 'Family' })).not.toBeInTheDocument();
  });

  test('back goes to cancel', () => {
    const props = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Back to Games/ }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
