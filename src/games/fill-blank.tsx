import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { GameProps } from '@/types';

interface Puzzle {
  word: string;
  clue: string;
}

interface Theme {
  id: string;
  name: string;
  emoji: string;
  // Words sorted easy → hard (length grows).
  words: Puzzle[];
}

const THEMES: Theme[] = [
  {
    id: 'animals',
    name: 'Animals',
    emoji: '🦁',
    words: [
      { word: 'CAT', clue: 'Purring pet' },
      { word: 'DOG', clue: "Man's best friend" },
      { word: 'FROG', clue: 'Green jumping amphibian' },
      { word: 'BEAR', clue: 'Honey-loving mammal' },
      { word: 'TIGER', clue: 'Big striped cat' },
      { word: 'ZEBRA', clue: 'Striped horse-like animal' },
      { word: 'MONKEY', clue: 'Swings through trees' },
      { word: 'RABBIT', clue: 'Hops and loves carrots' },
      { word: 'DOLPHIN', clue: 'Intelligent sea mammal' },
      { word: 'GIRAFFE', clue: 'Tallest land animal' },
      { word: 'ELEPHANT', clue: 'Largest land animal' },
      { word: 'KANGAROO', clue: 'Australian hopper' },
      { word: 'CHAMELEON', clue: 'Color-changing lizard' },
      { word: 'CROCODILE', clue: 'Toothy river reptile' },
      { word: 'BUTTERFLY', clue: 'Colorful winged insect' },
    ],
  },
  {
    id: 'countries',
    name: 'Countries',
    emoji: '🌍',
    words: [
      { word: 'PERU', clue: 'Home of the Incas' },
      { word: 'CUBA', clue: 'Caribbean island country whose capital is Havana' },
      { word: 'JAPAN', clue: 'Land of the rising sun' },
      { word: 'EGYPT', clue: 'Home of the pyramids' },
      { word: 'INDIA', clue: 'Country where the Taj Mahal stands' },
      { word: 'BRAZIL', clue: 'Largest country in South America' },
      { word: 'CANADA', clue: 'North of the USA' },
      { word: 'FRANCE', clue: 'Eiffel Tower country' },
      { word: 'MEXICO', clue: 'Tacos and pyramids' },
      { word: 'GERMANY', clue: 'European, capital Berlin' },
      { word: 'PORTUGAL', clue: 'Country west of Spain, home of Lisbon' },
      { word: 'THAILAND', clue: 'Southeast Asian kingdom' },
      { word: 'ARGENTINA', clue: 'Tango and beef' },
      { word: 'AUSTRALIA', clue: 'The smallest continent' },
      { word: 'SWITZERLAND', clue: 'Alps, chocolate and watches' },
    ],
  },
  {
    id: 'food',
    name: 'Food',
    emoji: '🍕',
    words: [
      { word: 'RICE', clue: 'Grain served with sushi or curry' },
      { word: 'SOUP', clue: 'Hot liquid meal' },
      { word: 'BREAD', clue: 'Loaf you slice for sandwiches' },
      { word: 'PIZZA', clue: 'Italian, topped with cheese' },
      { word: 'SUSHI', clue: 'Japanese raw fish dish' },
      { word: 'BANANA', clue: 'Yellow curved fruit' },
      { word: 'CHEESE', clue: 'Aged dairy' },
      { word: 'NOODLES', clue: 'Long strands of pasta' },
      { word: 'BURGER', clue: 'Patty in a bun' },
      { word: 'PANCAKE', clue: 'Flat breakfast cake' },
      { word: 'SANDWICH', clue: 'Filling between two slices' },
      { word: 'SPAGHETTI', clue: 'Italian pasta' },
      { word: 'CHOCOLATE', clue: 'Sweet brown treat' },
      { word: 'STRAWBERRY', clue: 'Red summer fruit' },
      { word: 'WATERMELON', clue: 'Big green fruit with red flesh' },
    ],
  },
  {
    id: 'space',
    name: 'Space',
    emoji: '🚀',
    words: [
      { word: 'SUN', clue: 'Our star' },
      { word: 'MOON', clue: 'Lights the night' },
      { word: 'STAR', clue: 'Twinkles above' },
      { word: 'MARS', clue: 'The red planet' },
      { word: 'COMET', clue: 'Icy body with a tail' },
      { word: 'ORBIT', clue: 'Path around a body' },
      { word: 'VENUS', clue: 'Hottest planet' },
      { word: 'PLANET', clue: 'Orbits the sun' },
      { word: 'GALAXY', clue: 'Billions of stars together' },
      { word: 'ROCKET', clue: 'Blasts off into space' },
      { word: 'SATURN', clue: 'Planet with prominent rings' },
      { word: 'JUPITER', clue: 'Largest planet' },
      { word: 'ASTEROID', clue: 'Rocky space object' },
      { word: 'SATELLITE', clue: 'Orbits a planet' },
      { word: 'TELESCOPE', clue: 'For viewing the stars' },
    ],
  },
  {
    id: 'sports',
    name: 'Sports',
    emoji: '⚽',
    words: [
      { word: 'GOLF', clue: 'Clubs and a small ball' },
      { word: 'RUGBY', clue: 'Played with an oval ball' },
      { word: 'JUDO', clue: 'Japanese martial art' },
      { word: 'TENNIS', clue: 'Over a net with rackets' },
      { word: 'BOXING', clue: 'Fighting in a ring' },
      { word: 'SOCCER', clue: 'Played with feet and ball' },
      { word: 'HOCKEY', clue: 'Stick and puck or ball' },
      { word: 'CRICKET', clue: 'Bat and ball, wickets' },
      { word: 'SWIMMING', clue: 'Freestyle and butterfly' },
      { word: 'BASEBALL', clue: 'American game with diamond' },
      { word: 'CYCLING', clue: 'Two wheels, pedals' },
      { word: 'MARATHON', clue: "42 km foot race" },
      { word: 'OLYMPICS', clue: 'Global multi-sport event' },
      { word: 'GYMNASTICS', clue: 'Balance beam and rings' },
      { word: 'BASKETBALL', clue: 'Dribble and shoot hoops' },
    ],
  },
  {
    id: 'science',
    name: 'Science',
    emoji: '🔬',
    words: [
      { word: 'ATOM', clue: 'Tiny building block of matter' },
      { word: 'CELL', clue: 'Basic unit of life' },
      { word: 'ACID', clue: 'Sour on the pH scale' },
      { word: 'FORCE', clue: 'Push or pull' },
      { word: 'LIGHT', clue: 'What lets you see' },
      { word: 'ENERGY', clue: 'What food and rest give your body' },
      { word: 'OXYGEN', clue: 'What we breathe in' },
      { word: 'NEURON', clue: 'Brain cell' },
      { word: 'GRAVITY', clue: 'Pulls things down' },
      { word: 'ELECTRON', clue: 'Negatively charged particle' },
      { word: 'PHYSICS', clue: 'Study of matter and energy' },
      { word: 'MOLECULE', clue: 'Atoms bonded together' },
      { word: 'CHEMISTRY', clue: 'Study of substances' },
      { word: 'MICROSCOPE', clue: 'Sees tiny things' },
      { word: 'LABORATORY', clue: 'Where experiments happen' },
    ],
  },
  {
    id: 'nature',
    name: 'Nature',
    emoji: '🌳',
    words: [
      { word: 'TREE', clue: 'Wooden plant with leaves' },
      { word: 'LAKE', clue: 'Body of fresh water' },
      { word: 'LEAF', clue: 'Falls from trees in autumn' },
      { word: 'RIVER', clue: 'Flowing water' },
      { word: 'CLOUD', clue: 'Floats in the sky' },
      { word: 'FOREST', clue: 'Many trees together' },
      { word: 'DESERT', clue: 'Dry sandy region' },
      { word: 'ISLAND', clue: 'Land surrounded by water' },
      { word: 'CANYON', clue: 'Deep rocky valley' },
      { word: 'VOLCANO', clue: 'Mountain that erupts' },
      { word: 'RAINBOW', clue: 'Arc of colors after rain' },
      { word: 'GLACIER', clue: 'Slow-moving river of ice' },
      { word: 'WATERFALL', clue: 'River dropping off a cliff' },
      { word: 'HURRICANE', clue: 'Tropical storm' },
      { word: 'WILDERNESS', clue: 'Untouched wild land' },
    ],
  },
  {
    id: 'history',
    name: 'History',
    emoji: '🏛️',
    words: [
      { word: 'KING', clue: 'Male monarch' },
      { word: 'ROME', clue: 'Ancient empire in Italy' },
      { word: 'QUEEN', clue: 'Female monarch' },
      { word: 'TROJAN', clue: 'Famous wooden horse' },
      { word: 'KNIGHT', clue: 'Armored medieval warrior' },
      { word: 'CASTLE', clue: 'Big stone home where kings and queens lived' },
      { word: 'EMPIRE', clue: 'Group of ruled nations' },
      { word: 'PHARAOH', clue: 'Egyptian ruler' },
      { word: 'PYRAMID', clue: 'Ancient Egyptian tomb' },
      { word: 'VIKINGS', clue: 'Norse seafarers' },
      { word: 'SAMURAI', clue: 'Japanese warrior' },
      { word: 'CRUSADES', clue: 'Medieval wars fought over holy lands' },
      { word: 'COLOSSEUM', clue: 'Roman amphitheater' },
      { word: 'RENAISSANCE', clue: 'Age of Leonardo da Vinci and Michelangelo' },
      { word: 'REVOLUTION', clue: 'When the people overthrow their rulers' },
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    words: [
      { word: 'FISH', clue: 'Scaly swimmer you might catch on a line' },
      { word: 'CRAB', clue: 'Sideways walker with claws' },
      { word: 'KELP', clue: 'Underwater seaweed' },
      { word: 'SHARK', clue: 'Toothy ocean predator' },
      { word: 'WHALE', clue: 'Largest ocean mammal' },
      { word: 'CORAL', clue: 'Colorful reef builder' },
      { word: 'LOBSTER', clue: 'Big-clawed sea creature with a long tail' },
      { word: 'OCTOPUS', clue: 'Eight-armed sea creature' },
      { word: 'SEAHORSE', clue: 'Tiny fish that swims upright' },
      { word: 'STARFISH', clue: 'Five-armed sea creature' },
      { word: 'JELLYFISH', clue: 'Stinging sea creature' },
      { word: 'BARRACUDA', clue: 'Long predatory reef fish' },
      { word: 'SUBMARINE', clue: 'Travels underwater' },
      { word: 'SEASHELL', clue: 'Empty home of a mollusk' },
      { word: 'LIGHTHOUSE', clue: 'Warns ships of rocks' },
    ],
  },
  {
    id: 'music',
    name: 'Music',
    emoji: '🎵',
    words: [
      { word: 'DRUM', clue: 'Beat it with sticks' },
      { word: 'BASS', clue: 'Low-pitched strings' },
      { word: 'NOTE', clue: 'Single musical sound' },
      { word: 'PIANO', clue: '88 black and white keys' },
      { word: 'GUITAR', clue: 'Six-string instrument' },
      { word: 'VIOLIN', clue: 'Small instrument played under the chin' },
      { word: 'MELODY', clue: 'Memorable tune' },
      { word: 'RHYTHM', clue: 'Beat of a song' },
      { word: 'TRUMPET', clue: 'Brass with three valves' },
      { word: 'HARMONY', clue: 'Notes sounding together' },
      { word: 'ORCHESTRA', clue: 'Large group of musicians performing together' },
      { word: 'SYMPHONY', clue: 'Large orchestral piece' },
      { word: 'SAXOPHONE', clue: 'Curved brass instrument in jazz bands' },
      { word: 'CONCERTO', clue: 'Solo with orchestra' },
      { word: 'METRONOME', clue: 'Ticks to keep time' },
    ],
  },
];

const THEME_KEY = 'fill-blank:theme';

function pickBlanks(word: string, ratio: number, stage: number, round: number): number[] {
  const indices = word
    .split('')
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch }) => /[A-Z]/.test(ch))
    .map(({ i }) => i);
  const count = Math.max(1, Math.min(indices.length - 1, Math.round(indices.length * ratio)));
  const seed = stage * 131 + round * 37;
  const shuffled = [...indices].sort((a, b) => {
    const ha = ((a + 1) * seed * 2654435761) >>> 0;
    const hb = ((b + 1) * seed * 2654435761) >>> 0;
    return ha - hb;
  });
  return shuffled.slice(0, count).sort((a, b) => a - b);
}

interface StageConfig {
  rounds: number;
  startIdx: number;
  blankRatio: number;
}

function computeConfig(stage: number, wordCount: number): StageConfig {
  // Endless scaling: rounds grow slowly, capped. Blank ratio grows and caps at 0.85.
  const rounds = Math.min(20, 4 + Math.floor((stage - 1) / 2));
  const blankRatio = Math.min(0.95, 0.3 + (stage - 1) * 0.03);
  // Start index rotates so each stage sees different words; grows toward harder end.
  const base = Math.min(wordCount - rounds, Math.floor((stage - 1) / 2));
  const startIdx = Math.max(0, base) % Math.max(1, wordCount);
  return { rounds, startIdx, blankRatio };
}

function pickPuzzles(theme: Theme, config: StageConfig): Puzzle[] {
  const words = theme.words;
  const picks: Puzzle[] = [];
  for (let i = 0; i < config.rounds; i++) {
    picks.push(words[(config.startIdx + i) % words.length]);
  }
  return picks;
}

function loadSavedTheme(): Theme | null {
  try {
    const id = typeof window !== 'undefined' ? window.sessionStorage.getItem(THEME_KEY) : null;
    if (!id) return null;
    return THEMES.find(t => t.id === id) || null;
  } catch {
    return null;
  }
}

function saveTheme(themeId: string) {
  try {
    window.sessionStorage.setItem(THEME_KEY, themeId);
  } catch {
    // ignore storage errors
  }
}

function clearSavedTheme() {
  try {
    window.sessionStorage.removeItem(THEME_KEY);
  } catch {
    // ignore storage errors
  }
}

function FillBlankGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const [theme, setTheme] = useState<Theme | null>(() => loadSavedTheme());

  const config = useMemo(
    () => (theme ? computeConfig(stage, theme.words.length) : null),
    [stage, theme],
  );
  const puzzles = useMemo(
    () => (theme && config ? pickPuzzles(theme, config) : []),
    [theme, config],
  );

  const [roundIdx, setRoundIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  const endedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter(x => x !== id);
      if (!endedRef.current) fn();
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const puzzle = puzzles[roundIdx];
  const blanks = useMemo(
    () =>
      puzzle && config
        ? pickBlanks(puzzle.word, config.blankRatio, stage, roundIdx)
        : [],
    [puzzle, config, stage, roundIdx],
  );
  const blankSet = useMemo(() => new Set(blanks), [blanks]);

  useEffect(() => {
    setInputs({});
    setWrong(new Set());
    setIsRoundComplete(false);
  }, [roundIdx]);

  const finishGame = useCallback(
    (correct: number, finalScore: number) => {
      if (endedRef.current || !theme || puzzles.length === 0) return;
      endedRef.current = true;
      const ratio = correct / puzzles.length;
      const stars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
      const summary =
        ratio === 1
          ? `Perfect! Stage ${stage} ${theme.name.toLowerCase()} mastered! 🏆`
          : ratio >= 0.5
            ? `Solved ${correct}/${puzzles.length} ${theme.name.toLowerCase()} words!`
            : `Solved ${correct}/${puzzles.length}. Keep going!`;
      onEnd({ score: finalScore, stars, summary });
    },
    [puzzles.length, onEnd, theme, stage],
  );

  const pickTheme = (t: Theme) => {
    saveTheme(t.id);
    setTheme(t);
  };

  const changeTheme = () => {
    clearSavedTheme();
    if (!endedRef.current) {
      endedRef.current = true;
      onEnd({
        score: totalScore,
        stars: totalScore > 0 ? 1 : 1,
        summary: 'Theme changed — pick a new theme on the next stage.',
      });
    }
  };

  if (!theme || !config || puzzles.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">✏️</div>
          <h2 className="text-2xl font-bold text-accent">Pick your theme</h2>
          <p className="text-sm text-text-muted mt-1">
            All stages use this theme. Stage {stage} · Endless play.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => pickTheme(t)}
              className="bg-card hover:bg-card-hover active:scale-95 rounded-xl p-4 text-left transition-all"
            >
              <div className="text-3xl mb-1">{t.emoji}</div>
              <div className="font-bold text-text">{t.name}</div>
              <div className="text-xs text-text-muted">{t.words.length} words</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const handleInput = (idx: number, val: string) => {
    if (isRoundComplete) return;
    const letter = (val.slice(-1) || '').toUpperCase();
    const updated = { ...inputs, [idx]: letter };
    setInputs(updated);
    setWrong(prev => { const n = new Set(prev); n.delete(idx); return n; });

    const filled = blanks.filter(b => !!updated[b]).length;
    const roundFraction = blanks.length > 0 ? filled / blanks.length : 0;
    onProgress((roundIdx + roundFraction) / puzzles.length);

    if (letter) {
      const remaining = blanks.filter(b => b > idx && !updated[b]);
      if (remaining.length > 0) {
        document.getElementById(`fb-${remaining[0]}`)?.focus();
      }
    }
  };

  const handleCheck = () => {
    if (isRoundComplete || !puzzle) return;
    const wrongSet = new Set<number>();
    let allCorrect = true;

    for (const idx of blanks) {
      const entered = (inputs[idx] || '').toUpperCase();
      const expected = puzzle.word[idx];
      if (entered !== expected) {
        wrongSet.add(idx);
        allCorrect = false;
      }
    }

    setWrong(wrongSet);

    if (allCorrect) {
      setIsRoundComplete(true);
      const pts = 50 + puzzle.word.length * 10 + blanks.length * 15 + stage * 5;
      const newScore = totalScore + pts;
      const newCorrect = correctRounds + 1;
      setTotalScore(newScore);
      setCorrectRounds(newCorrect);
      onScore(pts);
      onMessage(`✅ ${puzzle.word}! +${pts}`);

      const isLast = roundIdx >= puzzles.length - 1;
      if (isLast) {
        onProgress(1);
        schedule(() => finishGame(newCorrect, newScore), 900);
      } else {
        schedule(() => setRoundIdx(r => r + 1), 900);
      }
    } else {
      onMessage(`${wrongSet.size} letter${wrongSet.size > 1 ? 's' : ''} wrong — try again!`);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !inputs[idx]) {
      const prev = [...blanks].reverse().find(b => b < idx);
      if (prev !== undefined) {
        setInputs(p => { const n = { ...p }; delete n[prev]; return n; });
        document.getElementById(`fb-${prev}`)?.focus();
      }
    } else if (e.key === 'Enter') {
      if (blanks.every(b => inputs[b])) handleCheck();
    }
  };

  const handleSkip = () => {
    if (isRoundComplete || !puzzle) return;
    onMessage(`Skipped. Answer was: ${puzzle.word}`);
    setIsRoundComplete(true);
    const isLast = roundIdx >= puzzles.length - 1;
    if (isLast) {
      schedule(() => finishGame(correctRounds, totalScore), 900);
    } else {
      schedule(() => setRoundIdx(r => r + 1), 900);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-lg font-bold">
          {theme.emoji} {theme.name}
        </h1>
        <div className="flex gap-2 text-xs">
          <span className="bg-card rounded-lg px-2 py-1 text-text-muted">
            {roundIdx + 1}/{puzzles.length}
          </span>
          <span className="bg-card rounded-lg px-2 py-1 text-warning">Stage {stage}</span>
          <button
            onClick={changeTheme}
            className="bg-card hover:bg-card-hover rounded-lg px-2 py-1 text-accent"
            title="End and pick a new theme next stage"
          >
            Change
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3 text-xs">
        <span className="text-success">✓ {correctRounds}</span>
        <span className="text-accent">Score: {totalScore}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="bg-card rounded-xl p-6 mb-6 w-full max-w-lg">
          <div className="text-center text-sm text-text-muted mb-2">CLUE:</div>
          <div className="text-center text-lg font-medium text-text mb-4">{puzzle.clue}</div>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {puzzle.word.split('').map((ch, i) => {
              const isBlank = blankSet.has(i);
              if (isBlank) {
                const hasError = wrong.has(i);
                const hasValue = !!inputs[i];
                return (
                  <input
                    key={`${roundIdx}-${i}`}
                    id={`fb-${i}`}
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    maxLength={2}
                    value={inputs[i] || ''}
                    onChange={e => handleInput(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className={`w-10 h-12 text-center text-xl font-bold rounded-lg border-2 transition-all outline-none ${
                      isRoundComplete
                        ? 'bg-success/20 border-success text-success'
                        : hasError
                          ? 'bg-danger/30 border-danger text-danger animate-[shake_0.3s_ease]'
                          : hasValue
                            ? 'bg-accent/20 border-accent text-accent'
                            : 'bg-card border-card-hover text-text focus:border-accent'
                    }`}
                    disabled={isRoundComplete}
                  />
                );
              }
              return (
                <div
                  key={i}
                  className="w-10 h-12 flex items-center justify-center text-2xl font-bold text-text-muted"
                >
                  {ch}
                </div>
              );
            })}
          </div>
        </div>

        {!isRoundComplete && (
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="bg-card text-text-muted font-medium px-5 py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all"
            >
              Skip
            </button>
            <button
              onClick={handleCheck}
              disabled={blanks.some(b => !inputs[b])}
              className="bg-accent text-bg font-semibold px-8 py-3 rounded-xl hover:opacity-90 active:scale-95 disabled:opacity-30 transition-all"
            >
              Check
            </button>
          </div>
        )}

        {isRoundComplete && roundIdx < puzzles.length - 1 && (
          <div className="text-center p-3 bg-success/20 rounded-xl">
            <p className="text-success font-bold">✓ Next puzzle...</p>
          </div>
        )}

        {isRoundComplete && roundIdx >= puzzles.length - 1 && (
          <div className="text-center p-4 bg-success/20 rounded-xl">
            <span className="text-3xl">🎉</span>
            <p className="text-success font-bold mt-2">Stage {stage} Complete!</p>
            <p className="text-text-muted text-xs mt-1">Advancing to stage {stage + 1}...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FillBlankGame;
