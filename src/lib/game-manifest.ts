/**
 * Game manifest — registers all games with metadata (eager) and
 * dynamic import loaders (lazy). No game component code is pulled
 * into the main bundle; each game becomes its own chunk.
 *
 * Within each section games are ordered alphabetically by name.
 */
import { registerGame, registerAlias } from './game-registry';
import type { AgeBand, GameCategory, MinuteRange } from '@/types';

function tag(age: AgeBand, min: number, max: number): { age: AgeBand; minutes: MinuteRange } {
  return { age, minutes: { min, max } };
}

// Editorial bands for the hub picker. Not birthdates. Player count is derived
// from passAndPlay / minPlayers / maxPlayers, not stored here.
const PICKER_TAGS = {
  anagram: tag('7+', 3, 8),
  'attention-archery': tag('4+', 1, 3),
  'breath-bubbles': tag('everyone', 2, 5),
  'color-rush': tag('7+', 2, 5),
  'cube-twist': tag('7+', 5, 15),
  'copy-cat': tag('everyone', 2, 5),
  'dual-n-back': tag('10+', 8, 20),
  'echo-tap': tag('4+', 2, 5),
  'emotion-volcano': tag('7+', 3, 8),
  'empathy-engine': tag('7+', 4, 10),
  'feelings-faces': tag('7+', 3, 8),
  'fill-blank': tag('7+', 3, 10),
  'flag-match': tag('7+', 3, 8),
  'map-quiz': tag('10+', 8, 20),
  'flexibility-frames': tag('7+', 3, 8),
  'focus-frenzy': tag('4+', 2, 5),
  'go-no-go': tag('4+', 1, 3),
  grounding: tag('7+', 3, 8),
  'just-right': tag('4+', 2, 6),
  'memory-match': tag('everyone', 2, 5),
  'mirror-match': tag('4+', 2, 5),
  'mistake-master': tag('7+', 3, 8),
  'mole-mash': tag('everyone', 1, 3),
  'number-ninja': tag('7+', 2, 6),
  'patience-pop': tag('everyone', 1, 4),
  'pattern-painter': tag('4+', 2, 8),
  'pixel-paint': tag('4+', 3, 10),
  'quick-math': tag('7+', 2, 6),
  'routine-roadmap': tag('7+', 2, 6),
  'squish-lab': tag('4+', 2, 6),
  'steady-hands': tag('4+', 3, 10),
  'story-builder': tag('7+', 3, 8),
  'stroop-challenge': tag('7+', 3, 8),
  tetris: tag('7+', 5, 15),
  sudoku: tag('10+', 10, 30),
  bingo: tag('4+', 8, 15),
  bookworm: tag('7+', 5, 15),
  checkers: tag('7+', 8, 15),
  chess: tag('10+', 15, 40),
  'connect-four': tag('4+', 4, 10),
  'connect-lines': tag('7+', 5, 12),
  crossword: tag('10+', 10, 25),
  '2048': tag('7+', 5, 15),
  ludo: tag('4+', 10, 20),
  minesweeper: tag('10+', 5, 20),
  scrabble: tag('10+', 20, 45),
  'score-four': tag('7+', 5, 12),
  'snakes-ladders': tag('everyone', 8, 15),
  'tic-tac-toe': tag('4+', 1, 3),
  uno: tag('7+', 8, 15),
  'word-guess': tag('7+', 2, 5),
  wordsearch: tag('7+', 5, 12),
  'calm-breathing': tag('4+', 1, 7),
  'box-breathing': tag('7+', 3, 13),
  'coherent-breathing': tag('7+', 2, 12),
  'triangle-breathing': tag('everyone', 2, 14),
} satisfies Record<string, { age: AgeBand; minutes: MinuteRange }>;

interface Entry {
  name: string;
  emoji: string;
  description: string;
  category: GameCategory;
  stages: number;
  /** Set to true for games where AI skill should scale with player progress. */
  hasAdaptiveAi?: boolean;
  benefits?: string[];
  duration?: string;
  bestFor?: string[];
  minPlayers?: number;
  maxPlayers?: number;
  /** Seat range for pass & play on one device. */
  passAndPlay?: { min: number; max: number };
}

function reg(id: string, meta: Entry, loader: () => Promise<{ default: any }>) {
  const tags = PICKER_TAGS[id as keyof typeof PICKER_TAGS];
  if (!tags) throw new Error(`missing age and time tags for ${id}`);
  registerGame(id, { ...meta, ...tags }, loader);
}

// ── Brain games (alphabetical) ────────────────────────────────────

reg('anagram', {
  name: 'Anagram Blast', emoji: '🔀',
  description: 'Unscramble the letters to reveal the hidden word!',
  category: 'memory', stages: 99,
}, () => import('@/games/anagram'));

reg('attention-archery', {
  name: 'Attention Archery', emoji: '🏹',
  description: 'Hit the right targets! Watch out for sneaky decoys.',
  category: 'focus', stages: 99,
}, () => import('@/games/attention-archery'));

reg('breath-bubbles', {
  name: 'Breath Bubbles', emoji: '🫧',
  description: 'Blow perfect bubbles by breathing slow and steady!',
  category: 'focus', stages: 99,
}, () => import('@/games/breath-bubbles'));

reg('color-rush', {
  name: 'Color Rush', emoji: '🌈',
  description: 'A colour flashes — name it fast! Speed earns bonus points.',
  category: 'focus', stages: 99,
}, () => import('@/games/color-rush'));

reg('cube-twist', {
  name: 'Cube Twist', emoji: '🧊',
  description: 'Twist the 3D cube until every side is one color!',
  category: 'flexibility', stages: 99,
  minPlayers: 2, maxPlayers: 2,
}, () => import('@/games/cube-twist'));

reg('copy-cat', {
  name: 'Copy Cat', emoji: '🐱',
  description: 'Watch the pattern, then copy it — forwards or backwards!',
  category: 'memory', stages: 99,
}, () => import('@/games/copy-cat'));

reg('dual-n-back', {
  name: 'Dual N-Back', emoji: '🧠',
  description: 'Track position AND letter N steps back. The gold standard of working memory!',
  category: 'memory', stages: 99,
}, () => import('@/games/dual-n-back'));

reg('echo-tap', {
  name: 'Echo Tap', emoji: '🥁',
  description: 'Tap the buttons to match the rhythm pattern!',
  category: 'focus', stages: 99,
}, () => import('@/games/echo-tap'));

reg('emotion-volcano', {
  name: 'Emotion Volcano', emoji: '🌋',
  description: 'Keep your volcano calm! Learn to cool down big feelings.',
  category: 'social', stages: 99,
}, () => import('@/games/emotion-volcano'));

reg('empathy-engine', {
  name: 'Empathy Engine', emoji: '💝',
  description: 'Help your friends by choosing the best response!',
  category: 'social', stages: 99,
}, () => import('@/games/empathy-engine'));

reg('feelings-faces', {
  name: 'Feelings Faces', emoji: '😊',
  description: "Match the emotion to what's happening!",
  category: 'social', stages: 99,
}, () => import('@/games/feelings-faces'));

reg('fill-blank', {
  name: 'Fill in the Blank', emoji: '✏️',
  description: 'Pick a theme and fill in missing letters. Endless mode!',
  category: 'memory', stages: 99,
}, () => import('@/games/fill-blank'));

reg('flag-match', {
  name: 'Flag Match', emoji: '🚩',
  description: 'Match flags to their countries!',
  category: 'memory', stages: 99,
}, () => import('@/games/flag-match'));

reg('map-quiz', {
  name: 'Map Quiz', emoji: '🌍',
  description: 'Type country and city names to fill in the map! World, Africa, Oceania, Antarctica, and UK packs.',
  category: 'memory', stages: 5,
}, () => import('@/games/map-quiz'));

reg('flexibility-frames', {
  name: 'Flexibility Frames', emoji: '🔄',
  description: 'The rules keep changing! Stay flexible and adapt!',
  category: 'flexibility', stages: 99,
}, () => import('@/games/flexibility-frames'));

reg('focus-frenzy', {
  name: 'Focus Frenzy', emoji: '🔮',
  description: 'Tap the glowing orbs, but ignore the tricky distractions!',
  category: 'focus', stages: 99,
}, () => import('@/games/focus-frenzy'));

reg('go-no-go', {
  name: 'Go / No-Go', emoji: '🚦',
  description: 'Tap green, freeze on red. Train your impulse control and reaction speed!',
  category: 'focus', stages: 99,
}, () => import('@/games/go-no-go'));

reg('grounding', {
  name: 'Grounding Garden', emoji: '🌸',
  description: '5-4-3-2-1: Name things you can see, hear, feel, smell and taste to anchor yourself.',
  category: 'focus', stages: 99,
}, () => import('@/games/grounding'));

reg('just-right', {
  name: 'Just Right', emoji: '🎨',
  description: 'Splatter paint and stop when it looks just right!',
  category: 'flexibility', stages: 99,
}, () => import('@/games/just-right'));

reg('memory-match', {
  name: 'Memory Match', emoji: '🃏',
  description: 'Flip cards and find the matching pairs!',
  category: 'memory', stages: 99,
}, () => import('@/games/memory-match'));

reg('mirror-match', {
  name: 'Mirror Match', emoji: '🪞',
  description: 'Two grids flash — spot the differences before they vanish!',
  category: 'focus', stages: 99,
}, () => import('@/games/mirror-match'));

reg('mistake-master', {
  name: 'Mistake Master', emoji: '🌱',
  description: 'Learn from mistakes and grow! Every oops is a chance to learn.',
  category: 'flexibility', stages: 99,
}, () => import('@/games/mistake-master'));

reg('mole-mash', {
  name: 'Mole Mash', emoji: '🔨',
  description: 'Whack the moles before they hide — golden ones are worth triple!',
  category: 'motor', stages: 99,
}, () => import('@/games/mole-mash'));

reg('number-ninja', {
  name: 'Number Ninja', emoji: '🔢',
  description: 'Memorize the numbers, then type them back!',
  category: 'memory', stages: 99,
}, () => import('@/games/number-ninja'));

reg('patience-pop', {
  name: 'Patience Pop', emoji: '🫧',
  description: 'Wait for the bubbles to turn green, then pop them!',
  category: 'focus', stages: 99,
}, () => import('@/games/patience-pop'));

reg('pattern-painter', {
  name: 'Pattern Painter', emoji: '🎨',
  description: 'Trace the shapes with your finger or mouse!',
  category: 'motor', stages: 99,
}, () => import('@/games/pattern-painter'));

reg('pixel-paint', {
  name: 'Pixel Paint', emoji: '🟦',
  description: 'Tap the squares to match the pixel art picture!',
  category: 'motor', stages: 99,
}, () => import('@/games/pixel-paint'));

reg('quick-math', {
  name: 'Quick Math', emoji: '🧮',
  description: 'Rapid-fire arithmetic — speed and streaks earn big points!',
  category: 'focus', stages: 99,
}, () => import('@/games/quick-math'));

reg('routine-roadmap', {
  name: 'Routine Roadmap', emoji: '📋',
  description: 'Put the daily tasks in the right order!',
  category: 'sequence', stages: 99,
}, () => import('@/games/routine-roadmap'));

reg('squish-lab', {
  name: 'Squish Lab', emoji: '🧪',
  description: 'Touch the squishy experiments! Some feel weird — see how long you can last.',
  category: 'flexibility', stages: 99,
}, () => import('@/games/squish-lab'));

reg('steady-hands', {
  name: 'Steady Hands', emoji: '🎯',
  description: 'Guide the ball through the winding path without touching the walls!',
  category: 'motor', stages: 99,
}, () => import('@/games/steady-hands'));

reg('story-builder', {
  name: 'Story Builder', emoji: '📖',
  description: 'Arrange the comic panels to tell the story!',
  category: 'sequence', stages: 99,
}, () => import('@/games/story-builder'));

reg('stroop-challenge', {
  name: 'Stroop Challenge', emoji: '🧩',
  description: 'The word says one color but the ink is another — can your brain keep up?',
  category: 'flexibility', stages: 99,
}, () => import('@/games/stroop-challenge'));

reg('tetris', {
  name: 'Tetris', emoji: '🧱',
  description: 'Stack falling blocks and clear rows — the classic spatial reasoning workout!',
  category: 'flexibility', stages: 99,
}, () => import('@/games/tetris/index'));

reg('sudoku', {
  name: 'Sudoku', emoji: '🔢',
  description: 'Fill the 9×9 grid so every row, column and box contains 1–9.',
  category: 'memory', stages: 99,
}, () => import('@/games/sudoku'));

// ── Board games (alphabetical) ────────────────────────────────────

reg('bingo', {
  name: 'Bingo', emoji: '🎱',
  description: 'Match numbers and complete your card!',
  category: 'board', stages: 99,
  minPlayers: 2, maxPlayers: 8,
}, () => import('@/games/bingo'));

reg('bookworm', {
  name: 'Bookworm', emoji: '🐛',
  description: 'Chain adjacent letter tiles to spell words. Longer words = big points!',
  category: 'board', stages: 99,
}, () => import('@/games/bookworm'));

reg('checkers', {
  name: 'Checkers', emoji: '⬤',
  description: 'Jump and capture your way to victory!',
  category: 'board', stages: 99, hasAdaptiveAi: true,
  minPlayers: 2, maxPlayers: 2,
  passAndPlay: { min: 2, max: 2 },
}, () => import('@/games/checkers'));

reg('chess', {
  name: 'Chess', emoji: '♔',
  description: 'The royal game — checkmate the AI king!',
  category: 'board', stages: 99, hasAdaptiveAi: true,
  minPlayers: 2, maxPlayers: 2,
  passAndPlay: { min: 2, max: 2 },
}, () => import('@/games/chess'));

reg('connect-four', {
  name: 'Connect Four', emoji: '🟡',
  description: 'Drop discs to connect four in a row!',
  category: 'board', stages: 99, hasAdaptiveAi: true,
  minPlayers: 2, maxPlayers: 2,
  passAndPlay: { min: 2, max: 2 },
}, () => import('@/games/connect-four'));

reg('connect-lines', {
  name: 'Connect Lines', emoji: '🔌',
  description: 'Rotate pipe tiles until every connection matches — no dead ends!',
  category: 'board', stages: 99,
}, () => import('@/games/connect-lines'));

reg('crossword', {
  name: 'Crossword', emoji: '📝',
  description: 'Solve crossword puzzles — tap to enter letters!',
  category: 'board', stages: 99,
}, () => import('@/features/crossword/index'));

reg('2048', {
  name: '2048', emoji: '🔢',
  description: 'Slide tiles and merge matching numbers — build the biggest tile!',
  category: 'board', stages: 99,
}, () => import('@/games/game-2048/index'));

reg('ludo', {
  name: 'Ludo', emoji: '🎲',
  description: 'Roll the dice and race all 4 pieces home!',
  category: 'board', stages: 99,
  minPlayers: 2, maxPlayers: 4,
  passAndPlay: { min: 2, max: 4 },
}, () => import('@/games/ludo'));

reg('minesweeper', {
  name: 'Minesweeper', emoji: '💣',
  description: 'Reveal every safe square without setting off a mine!',
  category: 'board', stages: 99,
}, () => import('@/games/minesweeper'));

reg('scrabble', {
  name: 'Scrabble', emoji: '🔤',
  description: 'Build words on the board for maximum points!',
  category: 'board', stages: 99, hasAdaptiveAi: true,
  minPlayers: 2, maxPlayers: 4,
  passAndPlay: { min: 2, max: 4 },
}, () => import('@/games/scrabble'));

reg('score-four', {
  name: 'Score Four', emoji: '🏗️',
  description: 'Connect Four in 3D — line up 4 in any direction!',
  category: 'board', stages: 99, hasAdaptiveAi: true,
  minPlayers: 2, maxPlayers: 2,
  passAndPlay: { min: 2, max: 2 },
}, () => import('@/games/score-four'));

reg('snakes-ladders', {
  name: 'Snakes & Ladders', emoji: '🐍',
  description: 'Classic race game — climb ladders, dodge snakes!',
  category: 'board', stages: 99,
  minPlayers: 2, maxPlayers: 2,
  passAndPlay: { min: 2, max: 4 },
}, () => import('@/games/snakes-ladders'));

reg('tic-tac-toe', {
  name: 'Tic-Tac-Toe', emoji: '⭕',
  description: 'Classic X and O — beat the AI!',
  category: 'board', stages: 99, hasAdaptiveAi: true,
  minPlayers: 2, maxPlayers: 2,
  passAndPlay: { min: 2, max: 2 },
}, () => import('@/games/tic-tac-toe'));

reg('uno', {
  name: 'UNO', emoji: '🃏',
  description: 'Match colors and numbers — be first to empty your hand!',
  category: 'board', stages: 99, hasAdaptiveAi: true,
  minPlayers: 2, maxPlayers: 2,
  passAndPlay: { min: 2, max: 2 },
}, () => import('@/games/uno'));

reg('word-guess', {
  name: 'Word Guess', emoji: '🟩',
  description: 'Guess the 5-letter word — green is right, yellow is close!',
  category: 'board', stages: 99,
}, () => import('@/games/word-guess'));

reg('wordsearch', {
  name: 'Word Search', emoji: '🔍',
  description: 'Find hidden words in a letter grid!',
  category: 'board', stages: 99,
}, () => import('@/features/wordsearch/index'));

// ── Breathing exercises (alphabetical) ───────────────────────────

reg('calm-breathing', {
  name: '4-7-8 Calm', emoji: '🌊',
  description: 'Inhale 4s, hold 7s, exhale 8s — reduces anxiety',
  category: 'breathe', stages: 99,
  benefits: ['Reduces anxiety', 'Aids sleep', 'Calms nervous system', 'Manages cravings'],
  duration: '1-7 min',
  bestFor: ['Bedtime routine', 'Anxiety relief', 'Quick calming'],
}, () => import('@/games/calm-breathing'));

reg('box-breathing', {
  name: 'Box Breathing', emoji: '📦',
  description: '4-4-4-4 breathing pattern for calm and focus',
  category: 'breathe', stages: 99,
  benefits: ['Reduces stress', 'Lowers heart rate', 'Improves focus', 'Used by Navy SEALs'],
  duration: '3-13 min',
  bestFor: ['Stress relief', 'Pre-exam calm', 'Daily mindfulness'],
}, () => import('@/games/box-breathing'));

reg('coherent-breathing', {
  name: 'Coherent Breathing', emoji: '☯️',
  description: 'Equal inhale-exhale for heart-breath sync',
  category: 'breathe', stages: 99,
  benefits: ['HRV optimization', 'Parasympathetic activation', 'Blood pressure control', 'Sustained energy'],
  duration: '2-12 min',
  bestFor: ['Daily practice', 'Heart health', 'Post-exercise recovery'],
}, () => import('@/games/coherent-breathing'));

reg('triangle-breathing', {
  name: 'Triangle Breathing', emoji: '🔺',
  description: 'Equal inhale-hold-exhale, visual triangle guide',
  category: 'breathe', stages: 99,
  benefits: ['Grounding', 'Mental clarity', 'Beginner friendly', 'Breath awareness'],
  duration: '2-14 min',
  bestFor: ['Beginners', 'Quick reset', 'Pre-focus sessions'],
}, () => import('@/games/triangle-breathing'));

// ── URL aliases ───────────────────────────────────────────────────
registerAlias('reverse-cat', 'copy-cat');
registerAlias('word-search', 'wordsearch');
registerAlias('snakes-and-ladders', 'snakes-ladders');
