import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAction, useMutation } from 'convex/react';
import { ArrowLeft, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  MAX_ANSWER,
  MAX_CLUE,
  MAX_THEME,
  MAX_TITLE,
  MAX_WORDS,
  MIN_WORDS,
  normaliseAnswer,
  puzzleError,
} from '../../../convex/model/puzzles';
import type { ClueStatus } from '../../../convex/clues';

interface Row {
  id: number;
  answer: string;
  clue: string;
}

const CLUE_STATUS_MESSAGE: Record<Exclude<ClueStatus, 'ok'>, string> = {
  unconfigured: "The clue helper isn't switched on yet — write your own clues below.",
  limited: "That's a lot of clue-writing! Have a go yourself and try again in a bit.",
  unavailable: "Couldn't reach the clue helper — try again in a moment.",
  denied: 'Please sign in again to use the clue helper.',
};

let nextRowId = 1;
const blankRow = (): Row => ({ id: nextRowId++, answer: '', clue: '' });

export function PuzzleMaker() {
  const navigate = useNavigate();
  const { player } = useAuth();
  const suggest = useAction(api.clues.suggestClues);
  const create = useMutation(api.puzzles.createFamilyPuzzle);

  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 6 }, blankRow));
  const [helper, setHelper] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const filled = rows.filter(r => r.answer.trim());
  const entries = filled.map(r => ({ answer: normaliseAnswer(r.answer), clue: r.clue.trim() }));
  const error = puzzleError(title, entries);
  const needClues = filled.filter(r => !r.clue.trim() && normaliseAnswer(r.answer).length >= 3);

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const writeClues = async () => {
    if (!player || needClues.length === 0) return;
    setHelper({ busy: true, note: '' });
    try {
      const res = await suggest({
        sessionToken: player.sessionToken,
        words: needClues.map(r => r.answer),
        theme: theme.trim() || undefined,
      });
      if (res.status !== 'ok') {
        setHelper({ busy: false, note: CLUE_STATUS_MESSAGE[res.status] });
        return;
      }
      const byAnswer = new Map(res.clues.filter(c => c.clue).map(c => [c.answer, c.clue]));
      // Only fill clues that are still blank — never overwrite what someone typed meanwhile.
      setRows(prev => prev.map(r => (r.clue.trim() ? r : { ...r, clue: byAnswer.get(normaliseAnswer(r.answer)) ?? r.clue })));
      const missed = needClues.length - byAnswer.size;
      setHelper({
        busy: false,
        note: missed > 0
          ? `Clues written by Claude — ${missed} left for you to write. Check them all before saving.`
          : 'Clues written by Claude — give them a read and tweak anything before saving.',
      });
    } catch {
      setHelper({ busy: false, note: CLUE_STATUS_MESSAGE.unavailable });
    }
  };

  const save = async () => {
    if (!player || error) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await create({ sessionToken: player.sessionToken, title: title.trim(), entries });
      if ('puzzleId' in res && res.puzzleId) {
        navigate('/puzzles');
        return;
      }
      setSaveError(res.error ?? "Couldn't save the puzzle.");
    } catch {
      setSaveError("Couldn't save the puzzle — check your connection.");
    }
    setSaving(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 pb-10 max-w-xl mx-auto space-y-5">
        <button
          type="button"
          onClick={() => navigate('/puzzles')}
          className="flex items-center gap-1.5 text-text-muted hover:text-text bg-card hover:bg-card-hover px-3 py-2 rounded-xl text-sm font-semibold"
        >
          <ArrowLeft size={16} /> Puzzle corner
        </button>

        <header>
          <h1 className="text-2xl font-bold">Make a family puzzle</h1>
          <p className="text-sm text-text-muted">
            Add {MIN_WORDS}–{MAX_WORDS} words. Everyone can play it as a crossword or a word search.
          </p>
        </header>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Title</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              placeholder="Summer in Cornwall"
              className="mt-1 w-full bg-card rounded-xl px-3 py-2.5 text-base outline-none focus:ring-2 ring-accent/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">What's it about? (helps the clue writer)</span>
            <input
              value={theme}
              onChange={e => setTheme(e.target.value)}
              maxLength={MAX_THEME}
              placeholder="Our week at Granny's by the sea"
              className="mt-1 w-full bg-card rounded-xl px-3 py-2.5 text-base outline-none focus:ring-2 ring-accent/50"
            />
          </label>
        </div>

        <section aria-labelledby="words-heading" className="space-y-2">
          <h2 id="words-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Words & clues · {filled.length}/{MAX_WORDS}
          </h2>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.id} className="bg-card rounded-xl p-2 flex flex-col sm:flex-row gap-2">
                <input
                  value={r.answer}
                  onChange={e => updateRow(r.id, { answer: e.target.value })}
                  maxLength={MAX_ANSWER + 4}
                  aria-label={`Word ${i + 1}`}
                  placeholder="WORD"
                  autoCapitalize="characters"
                  className="sm:w-36 bg-surface rounded-lg px-3 py-2 text-base font-bold uppercase tracking-wide outline-none focus:ring-2 ring-accent/50"
                />
                <div className="flex gap-2 flex-1">
                  <input
                    value={r.clue}
                    onChange={e => updateRow(r.id, { clue: e.target.value })}
                    maxLength={MAX_CLUE}
                    aria-label={`Clue for word ${i + 1}`}
                    placeholder="Clue"
                    className="flex-1 min-w-0 bg-surface rounded-lg px-3 py-2 text-base outline-none focus:ring-2 ring-accent/50"
                  />
                  <button
                    type="button"
                    onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))}
                    aria-label={`Remove word ${i + 1}`}
                    className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-card-hover"
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {rows.length < MAX_WORDS && (
            <button
              type="button"
              onClick={() => setRows(prev => [...prev, blankRow()])}
              className="flex items-center gap-1.5 text-sm font-semibold text-accent px-2 py-1.5 rounded-lg hover:bg-accent/10"
            >
              <Plus size={15} /> Add a word
            </button>
          )}
        </section>

        <section className="rounded-2xl bg-accent/8 border border-accent/20 p-4 space-y-2">
          <button
            type="button"
            onClick={writeClues}
            disabled={helper.busy || needClues.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-accent text-bg font-bold py-3 rounded-xl active:scale-95 disabled:opacity-50"
          >
            {helper.busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {needClues.length > 0 ? `Write ${needClues.length} clue${needClues.length > 1 ? 's' : ''} for me` : 'All words have clues'}
          </button>
          <p className="text-xs text-text-muted" role="status">
            {helper.note || 'Your words and theme are sent to Claude (Anthropic) to draft clues. You can edit every clue.'}
          </p>
        </section>

        <div>
          <button
            type="button"
            onClick={save}
            disabled={!!error || saving}
            className="w-full bg-success text-bg font-bold py-3.5 rounded-2xl text-lg active:scale-95 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save puzzle'}
          </button>
          <p className="text-xs text-text-muted mt-2 min-h-4" role="status">{saveError || (filled.length > 0 ? error : '') || ''}</p>
        </div>
      </div>
    </div>
  );
}
