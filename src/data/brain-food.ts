/**
 * "Why play?" — curated, evergreen notes on what research says about
 * games and the brain. Static on purpose: no external feed means nothing
 * unmoderated ever reaches a kids' site, and it works fully offline.
 *
 * Claims are hedged on purpose — point at the research area, not a
 * guaranteed outcome. Sources are named so curious grown-ups can look
 * them up; no links means no broken links.
 */

export interface BrainFoodCard {
  id: string;
  emoji: string;
  title: string;
  /** One-line headline a kid or parent can quote at the dinner table. */
  takeaway: string;
  /** A few sentences of honest, hedged detail. */
  body: string;
  /** Named source — journal, institution, or known study. */
  source: string;
  /** Game categories on this site that exercise the skill. */
  categories: import('@/types').GameCategory[];
}

export const BRAIN_FOOD: BrainFoodCard[] = [
  {
    id: 'active-vs-passive',
    emoji: '🎮',
    title: 'Playing beats scrolling',
    takeaway: 'An hour of games is active screen time — your brain is making decisions, not just watching.',
    body: 'Researchers increasingly separate "active" screen time (puzzles, games, creating) from "passive" time (endless feeds). Passive scrolling is linked with lower mood and attention; interactive play asks your brain to plan, react, and remember. The feed is designed to keep you watching — a game is designed to end.',
    source: 'Oxford Internet Institute research on screen time and wellbeing',
    categories: ['focus', 'flexibility'],
  },
  {
    id: 'tetris-effect',
    emoji: '🧱',
    title: 'The Tetris effect is real',
    takeaway: 'Spatial games like Tetris exercise the part of your brain that pictures and rotates shapes.',
    body: 'In a famous series of experiments, researchers found that playing Tetris engages visuospatial working memory — the same mental workspace used to imagine where furniture fits or how a puzzle piece turns. Some studies even found that a Tetris session soon after an upsetting event reduced intrusive visual memories later.',
    source: 'Holmes et al., PLoS ONE (2009); follow-up studies on intrusive memories',
    categories: ['flexibility'],
  },
  {
    id: 'working-memory',
    emoji: '🧠',
    title: 'Working memory is a muscle',
    takeaway: 'Games that ask you to hold information in mind — like N-Back or Copy Cat — train a core brain skill.',
    body: 'Working memory is the mental scratchpad you use for mental math, following instructions, and reading. Training games built on working-memory tasks (like dual n-back) have been studied for decades; the fairest summary is that practice reliably improves the trained skill, and often nearby skills too.',
    source: 'Working-memory training literature (Jaeggi et al., 2008 and replications)',
    categories: ['memory', 'focus'],
  },
  {
    id: 'stroop-flexibility',
    emoji: '🔄',
    title: 'Switching gears is a skill',
    takeaway: 'Games where the rules change — like Stroop and Flexibility Frames — practice "cognitive flexibility".',
    body: 'Cognitive flexibility is the ability to drop one rule and pick up another. The Stroop task (say the ink colour, not the word) is one of the oldest tests in psychology, and it still shows up in modern brain-training research because it isolates that switch.',
    source: 'Stroop (1935); modern task-switching research in cognitive psychology',
    categories: ['flexibility', 'focus'],
  },
  {
    id: 'strategy-planning',
    emoji: '♔',
    title: 'Board games are planning practice',
    takeaway: 'Chess, checkers and Connect Four all ask the same question: "if I do this, what happens next?"',
    body: 'Turn-based games make you simulate the future: picture a move, imagine the reply, then decide. That loop — predict, act, update — is the same one used in homework, cooking, and getting out the door on time. It just feels like play here.',
    source: 'Long-running research on chess, planning, and executive function',
    categories: ['board'],
  },
  {
    id: 'play-together',
    emoji: '💛',
    title: 'Playing together is the point',
    takeaway: 'The biggest, least-argued benefit of family games: you were together, laughing, in the same room.',
    body: 'Decades of family research connect shared play with stronger relationships and better conversation. A leaderboard and a rematch button are really just excuses to keep showing up for each other — which is the whole idea.',
    source: 'Family co-play research in developmental psychology',
    categories: ['social', 'board'],
  },
  {
    id: 'calm-on-purpose',
    emoji: '🌬️',
    title: 'Calm is trainable',
    takeaway: 'Slow breathing literally changes your nervous system — it is the fastest "off switch" we know of.',
    body: 'Slow, rhythmic breathing (about 5–6 breaths a minute) activates the parasympathetic nervous system — the body\'s built-in calming circuit. It is used everywhere from therapy rooms to Navy SEAL training, and it is why the Breathe tab exists.',
    source: 'Research on heart-rate variability and paced breathing (Zaccaro et al., 2018)',
    categories: ['breathe', 'focus'],
  },
  {
    id: 'balance-matters',
    emoji: '⚖️',
    title: 'The dose makes the difference',
    takeaway: 'Research finds the sweet spot is play in balance — not all day, and not never.',
    body: 'The honest science: moderate gaming sits comfortably in a healthy day, while marathons that crowd out sleep, friends, or moving your body do not. That is why Noodle Quest has sleep timers, short rounds, and a Breathe tab — this place is built for a good session, then a good night.',
    source: 'Oxford Internet Institute studies on playtime and wellbeing',
    categories: ['breathe'],
  },
];
