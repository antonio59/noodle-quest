import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const suggest = vi.fn();
const create = vi.fn();
const navigate = vi.fn();

vi.mock('convex/react', () => ({ useAction: () => suggest, useMutation: () => create }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ player: { sessionToken: 'tok' } }) }));
vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { PuzzleMaker } from '../maker';

afterEach(() => {
  suggest.mockReset();
  create.mockReset();
  navigate.mockReset();
});

function renderMaker() {
  render(<MemoryRouter><PuzzleMaker /></MemoryRouter>);
}

const word = (i: number) => screen.getByRole('textbox', { name: `Word ${i}` });
const clue = (i: number) => screen.getByRole('textbox', { name: `Clue for word ${i}` });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

function fillWords(words: string[]) {
  words.forEach((w, i) => type(word(i + 1), w));
}

describe('PuzzleMaker', () => {
  test('asks Claude only for blank clues and never overwrites typed ones', async () => {
    suggest.mockResolvedValue({
      status: 'ok',
      clues: [{ answer: 'PASTY', clue: 'Cornish lunch' }, { answer: 'SURF', clue: '' }],
    });
    renderMaker();
    type(screen.getByPlaceholderText('Our week at Granny\'s by the sea'), 'Cornwall');
    fillWords(['beach', 'pasty', 'surf']);
    type(clue(1), 'Sandy place');

    fireEvent.click(screen.getByRole('button', { name: 'Write 2 clues for me' }));
    await waitFor(() => expect(clue(2)).toHaveValue('Cornish lunch'));
    expect(suggest).toHaveBeenCalledWith({ sessionToken: 'tok', words: ['pasty', 'surf'], theme: 'Cornwall' });
    expect(clue(1)).toHaveValue('Sandy place');
    expect(clue(3)).toHaveValue('');
    expect(screen.getByText(/1 left for you to write/)).toBeInTheDocument();
  });

  test('explains when the clue helper is not switched on', async () => {
    suggest.mockResolvedValue({ status: 'unconfigured', clues: [] });
    renderMaker();
    fillWords(['beach']);
    fireEvent.click(screen.getByRole('button', { name: 'Write 1 clue for me' }));
    expect(await screen.findByText(/isn't switched on yet/)).toBeInTheDocument();
  });

  test('saves only when valid, sending normalised entries', async () => {
    create.mockResolvedValue({ puzzleId: 'p1' });
    renderMaker();
    type(screen.getByPlaceholderText('Summer in Cornwall'), 'Cornwall');
    const save = screen.getByRole('button', { name: 'Save puzzle' });
    fillWords(['beach', 'pasty', 'surf']);
    ['Sandy place', 'Cornish lunch', 'Ride a wave'].forEach((c, i) => type(clue(i + 1), c));
    expect(save).toBeDisabled();
    expect(screen.getAllByRole('status').some(s => /4–15 words/.test(s.textContent ?? ''))).toBe(true);

    type(word(4), 'Grand-ma');
    type(clue(4), "Dad's mum");
    fireEvent.click(save);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/puzzles'));
    expect(create).toHaveBeenCalledWith({
      sessionToken: 'tok',
      title: 'Cornwall',
      entries: [
        { answer: 'BEACH', clue: 'Sandy place' },
        { answer: 'PASTY', clue: 'Cornish lunch' },
        { answer: 'SURF', clue: 'Ride a wave' },
        { answer: 'GRANDMA', clue: "Dad's mum" },
      ],
    });
  });

  test('shows the server error if saving is refused', async () => {
    create.mockResolvedValue({ error: 'Use 4–15 words.' });
    renderMaker();
    type(screen.getByPlaceholderText('Summer in Cornwall'), 'Hi');
    fillWords(['beach', 'pasty', 'surf', 'grandma']);
    ['a clue', 'b clue', 'c clue', 'd clue'].forEach((c, i) => type(clue(i + 1), c));
    fireEvent.click(screen.getByRole('button', { name: 'Save puzzle' }));
    expect(await screen.findByText('Use 4–15 words.')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  test('rows can be added and removed', () => {
    renderMaker();
    fireEvent.click(screen.getByRole('button', { name: /Add a word/ }));
    expect(word(7)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove word 7' }));
    expect(screen.queryByRole('textbox', { name: 'Word 7' })).not.toBeInTheDocument();
  });
});
