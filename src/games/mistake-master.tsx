import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameProps } from '@/types';
import { GameArt } from '@/components/GameArt';

interface Challenge {
  task: string;
  impossibleReason: string;
  lesson: string;
}

const ALL_CHALLENGES: Record<number, Challenge[]> = {
  1: [
    {
      task: 'Draw a PERFECT circle',
      impossibleReason: "Nobody can draw a perfect circle freehand!",
      lesson: "Even professional artists draw wobbly circles. That's normal!",
    },
    {
      task: 'Remember this: 7-2-9-4-8-1-3',
      impossibleReason: "That's 7 numbers — most brains hold 5-7!",
      lesson: "Our brains have limits. That's why we write things down!",
    },
  ],
  2: [
    {
      task: 'Draw a PERFECT circle',
      impossibleReason: "Nobody can draw a perfect circle freehand!",
      lesson: "Even professional artists draw wobbly circles. That's normal!",
    },
    {
      task: 'Name 10 countries in 10 seconds',
      impossibleReason: "That's really fast! Most people get 5-7.",
      lesson: "Speed challenges are hard. It's okay to take your time!",
    },
    {
      task: 'Spell "necessary" without looking',
      impossibleReason: 'This word tricks most adults too!',
      lesson: "Even grown-ups look up spelling. That's what dictionaries are for!",
    },
  ],
  3: [
    {
      task: 'Count backwards from 100 by 7s',
      impossibleReason: '100, 93, 86, 79... it gets confusing!',
      lesson: "Mental math is tricky. Using paper isn't cheating — it's smart!",
    },
    {
      task: 'Pat your head and rub your tummy',
      impossibleReason: 'Your brain wants to do the same motion!',
      lesson: 'Coordination takes practice. Everyone struggles at first!',
    },
    {
      task: 'Say the alphabet backwards fast',
      impossibleReason: 'We only learn it forwards!',
      lesson: "We struggle with unfamiliar tasks. That's how we learn!",
    },
  ],
  4: [
    {
      task: 'Draw a 3D cube perfectly',
      impossibleReason: 'Perspective is really hard!',
      lesson: 'Artists practice for years. First attempts are always wobbly!',
    },
    {
      task: 'Remember: purple-elephant-jazz-quantum',
      impossibleReason: 'Random words are hard to link together.',
      lesson: 'Memory tricks help! Try making a silly story.',
    },
    {
      task: 'Touch your elbow with your same hand',
      impossibleReason: "It's physically impossible!",
      lesson: "Some things CAN'T be done. Knowing that is smart, not failure!",
    },
  ],
  5: [
    {
      task: 'Solve: 347 × 28 in your head',
      impossibleReason: "Most people can't do 3-digit multiplication mentally!",
      lesson: 'Calculators exist for a reason! Using tools is smart.',
    },
    {
      task: "Don't think about a pink elephant",
      impossibleReason: 'Your brain automatically pictures what you hear!',
      lesson: "Our brains are funny! Some things we can't control.",
    },
    {
      task: 'Write your name with your non-dominant hand',
      impossibleReason: "Your other hand hasn't practiced!",
      lesson: "Skills take practice. Your writing hand wasn't always good either!",
    },
  ],
  6: [
    {
      task: 'Remember a 12-digit phone number',
      impossibleReason: "That's beyond most people's working memory!",
      lesson: "We save contacts for a reason! Using tools isn't cheating.",
    },
    {
      task: 'Name the 7th word you said today',
      impossibleReason: "Nobody tracks their words like that!",
      lesson: 'Our memory is selective. That is normal and helpful!',
    },
    {
      task: 'Fold a paper in half 8 times',
      impossibleReason: 'Physically impossible after 7 folds!',
      lesson: 'Physics has limits! Knowing boundaries is wisdom.',
    },
    {
      task: 'Say "toy boat" 10 times fast',
      impossibleReason: "Tongue twisters twist everyone's tongue!",
      lesson: 'Language is tricky! Even newscasters practice.',
    },
  ],
  7: [
    {
      task: 'Draw both hands at the same time',
      impossibleReason: 'Your brain wants them to mirror!',
      lesson: 'Split attention is HARD. Focusing on one thing is smarter!',
    },
    {
      task: 'Name a word that rhymes with "orange"',
      impossibleReason: "There's no perfect rhyme in English!",
      lesson: 'Language has quirks! Not finding an answer is sometimes the RIGHT answer.',
    },
    {
      task: 'Remember \u03c0 to 10 decimal places',
      impossibleReason: "3.1415926535... most people know 2-3 digits!",
      lesson: "We invented calculators because memorizing everything isn't realistic!",
    },
    {
      task: 'Do 3 things at once perfectly',
      impossibleReason: 'Multitasking is a myth! We switch between tasks.',
      lesson: 'Focusing on one thing at a time actually works better!',
    },
  ],
  8: [
    {
      task: 'Recite the periodic table',
      impossibleReason: 'There are 118 elements!',
      lesson: 'Scientists use charts too! Reference materials exist for a reason.',
    },
    {
      task: 'Name every bone in your body',
      impossibleReason: 'There are 206 bones!',
      lesson: 'Doctors take years to learn this. Quick mastery is unrealistic!',
    },
    {
      task: "Perfectly predict tomorrow's weather",
      impossibleReason: "Even meteorologists can't!",
      lesson: "Uncertainty is part of life. We make our best guess and adapt!",
    },
    {
      task: 'Draw a perfect 5-pointed star in one stroke',
      impossibleReason: 'The angles are really tricky!',
      lesson: 'Skills improve with practice. First tries are just that — first tries!',
    },
  ],
  9: [
    {
      task: 'Solve this logic puzzle in 10 seconds',
      impossibleReason: 'Complex problems need time!',
      lesson: 'Rushing leads to mistakes. Taking time is smart, not slow!',
    },
    {
      task: 'Learn a new language in a day',
      impossibleReason: 'Language learning takes months/years!',
      lesson: 'Big skills need time. Baby steps lead to big progress!',
    },
    {
      task: 'Never make a typo again',
      impossibleReason: 'Everyone makes typos, even authors!',
      lesson: "That's why we have spell-check and editing. Tools help us!",
    },
    {
      task: 'Be good at everything immediately',
      impossibleReason: 'Even geniuses struggle when learning new things!',
      lesson: 'Being a beginner is the FIRST step to being good!',
    },
  ],
  10: [
    {
      task: 'Be perfect at everything',
      impossibleReason: 'Nobody is perfect at everything — or anything!',
      lesson: 'Perfection is impossible. Growth is what matters!',
    },
    {
      task: 'Never feel nervous',
      impossibleReason: 'Nervousness is your body helping you!',
      lesson: "Emotions aren't mistakes — they're information!",
    },
    {
      task: 'Please everyone all the time',
      impossibleReason: 'People want different things!',
      lesson: "You can't control others' feelings. Being kind is enough!",
    },
    {
      task: 'Know everything before trying',
      impossibleReason: 'Learning happens BY trying!',
      lesson: 'Not knowing is the starting point of ALL learning!',
    },
    {
      task: 'Succeed without any failures',
      impossibleReason: 'Every success story includes failures!',
      lesson: 'Mistakes are just practice for success!',
    },
  ],
};

const TIPS = [
  '💡 This game teaches something important: mistakes help us grow!',
  '💡 Scientists make thousands of "failed" experiments before discoveries!',
  '💡 The best athletes, artists, and inventors all have stories of failure.',
  '💡 Your brain actually GROWS when you make mistakes and try again!',
  '💡 The only real failure is not trying at all!',
];

type Phase = 'intro' | 'challenge' | 'result' | 'done';

function MistakeMasterGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const cycledStage = ((stage - 1) % 10) + 1;
  const challenges = ALL_CHALLENGES[cycledStage] || ALL_CHALLENGES[1];
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [lastChoice, setLastChoice] = useState<'tried' | 'admitted'>('tried');
  const [lastPoints, setLastPoints] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  const endedRef = useRef(false);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
    };
  }, []);

  const handleChoice = useCallback(
    (choice: 'tried' | 'admitted') => {
      const points = choice === 'tried' ? 30 : 40;
      setLastChoice(choice);
      setLastPoints(points);
      setScore(prev => prev + points);
      onScore(points);
      setPhase('result');
    },
    [onScore],
  );

  const handleNext = useCallback(() => {
    const nextRound = currentRound + 1;
    onProgress(nextRound / challenges.length);

    if (nextRound >= challenges.length) {
      const finalScore = score + lastPoints + 50;
      const maxScore = challenges.length * 40;
      const ratio = (score + lastPoints) / maxScore;
      const stars = ratio >= 0.9 ? 3 : ratio >= 0.75 ? 2 : 1;
      const summary =
        `You learned ${challenges.length} important lessons about mistakes! ` +
        'Remember: your brain grows when you try hard things, even if you "fail." ' +
        'The most successful people in the world made LOTS of mistakes first! 🌟';
      onMessage('All challenges complete!');
      if (endedRef.current) return;
      endedRef.current = true;
      onEnd({ score: finalScore, stars, summary });
      setPhase('done');
    } else {
      setCurrentRound(nextRound);
      setPhase('challenge');
    }
  }, [currentRound, score, lastPoints, challenges.length, onProgress, onMessage, onEnd]);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center">
        <GameArt gameId="mistake-master" emoji="🌱" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-success mb-2">Mistake Master</h2>
        <p className="text-success/70 mb-4 max-w-xs">
          Learn why mistakes are actually GOOD for your brain!
        </p>

        <div className="bg-card rounded-xl p-4 mb-5 max-w-sm">
          <div className="text-warning text-lg mb-2">🧠 Did you know?</div>
          <div className="text-text-dim text-sm">
            Your brain grows NEW connections when you make mistakes and try again!
          </div>
        </div>

        <div className="bg-surface rounded-lg p-3 mb-4 max-w-xs">
          <div className="text-primary text-sm">You'll try some IMPOSSIBLE tasks...</div>
          <div className="text-success text-sm mt-1">
            ...and learn why "failing" is actually winning! 🏆
          </div>
        </div>

        <p className="text-primary text-sm mb-5 max-w-xs">{tip}</p>

        <button
          onClick={() => setPhase('challenge')}
          className="bg-success text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Let's Learn! 🌱
        </button>
      </div>
    );
  }

  if (phase === 'challenge') {
    const challenge = challenges[currentRound];
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center p-4">
        <div className="flex gap-4 px-4 py-2 bg-card rounded-xl mb-4">
          <span className="text-success font-bold">
            Challenge {currentRound + 1}/{challenges.length}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
          <div className="text-4xl mb-4">🎯</div>
          <div className="bg-card rounded-xl p-5 text-center w-full mb-5">
            <div className="text-warning text-sm mb-2">YOUR CHALLENGE:</div>
            <div className="text-text text-lg font-bold">{challenge.task}</div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleChoice('tried')}
              className="bg-success text-bg font-bold px-6 py-3 rounded-xl hover:opacity-90 active:scale-95"
            >
              I'll Try! 💪
            </button>
            <button
              onClick={() => handleChoice('admitted')}
              className="bg-accent text-bg font-bold px-6 py-3 rounded-xl hover:opacity-90 active:scale-95"
            >
              Too Hard! 🤔
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    const challenge = challenges[currentRound];
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center p-4">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
          <div className="text-5xl mb-3">{lastChoice === 'tried' ? '🌟' : '🧠'}</div>
          <div className="text-success text-lg font-bold mb-4">
            {lastChoice === 'tried'
              ? "Great effort! Here's the secret..."
              : "Smart thinking! Here's why..."}
          </div>

          <div className="bg-card rounded-xl p-4 text-center w-full mb-4">
            <div className="text-danger text-sm mb-2">WHY IT'S HARD:</div>
            <div className="text-text text-sm">{challenge.impossibleReason}</div>
          </div>

          <div className="bg-success/10 rounded-xl p-4 text-center w-full mb-4">
            <div className="text-success text-sm mb-2">💡 THE LESSON:</div>
            <div className="text-text text-sm leading-relaxed">{challenge.lesson}</div>
          </div>

          <div className="text-warning text-sm mt-2">+{lastPoints} Growth Points! 🌱</div>
        </div>

        <button
          onClick={handleNext}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl hover:opacity-90 active:scale-95"
        >
          {currentRound < challenges.length - 1 ? 'Next Challenge →' : 'See Results! 🎉'}
        </button>
      </div>
    );
  }

  return null;
}

export default MistakeMasterGame;
