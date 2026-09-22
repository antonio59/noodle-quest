import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameProps } from '@/types';
import { evaluateSequence } from '@/lib/sequence-scorer';

interface Panel {
  emoji: string;
  text: string;
  order: number;
}

interface Story {
  title: string;
  panels: Panel[];
  /** Canonical orders whose members are interchangeable in any order. */
  zones?: number[][];
  /** Canonical order pairs that may be swapped freely. */
  swappable?: [number, number][];
}

const allStories: Record<number, Story> = {
  1: {
    title: 'The Surprise Gift',
    panels: [
      { emoji: '🎁', text: 'A box appears', order: 1 },
      { emoji: '🤔', text: "What's inside?", order: 2 },
      { emoji: '😺', text: "It's a kitten!", order: 3 },
    ],
  },
  2: {
    title: 'Rainy Day',
    panels: [
      { emoji: '☁️', text: 'Clouds gather', order: 1 },
      { emoji: '🌧️', text: 'Rain falls', order: 2 },
      { emoji: '☔', text: 'Get umbrella', order: 3 },
      { emoji: '🌈', text: 'Rainbow appears!', order: 4 },
    ],
  },
  3: {
    title: 'Planting a Flower',
    panels: [
      { emoji: '🪴', text: 'Get a pot', order: 1 },
      { emoji: '🌱', text: 'Plant the seed', order: 2 },
      { emoji: '💧', text: 'Water it daily', order: 3 },
      { emoji: '☀️', text: 'Give it sunlight', order: 4 },
      { emoji: '🌸', text: 'Flower blooms!', order: 5 },
    ],
    zones: [[3, 4]],
  },
  4: {
    title: 'Baking Cookies',
    panels: [
      { emoji: '📖', text: 'Find a recipe', order: 1 },
      { emoji: '🥣', text: 'Mix ingredients', order: 2 },
      { emoji: '🍪', text: 'Shape cookies', order: 3 },
      { emoji: '🔥', text: 'Put in oven', order: 4 },
      { emoji: '😋', text: 'Delicious!', order: 5 },
    ],
  },
  5: {
    title: 'Building a Snowman',
    panels: [
      { emoji: '❄️', text: 'Snow falls', order: 1 },
      { emoji: '⚪', text: 'Roll big ball', order: 2 },
      { emoji: '🔵', text: 'Add medium ball', order: 3 },
      { emoji: '🟡', text: 'Add head', order: 4 },
      { emoji: '🥕', text: 'Add carrot nose', order: 5 },
      { emoji: '⛄', text: 'Snowman done!', order: 6 },
    ],
  },
  6: {
    title: 'Space Journey',
    panels: [
      { emoji: '🚀', text: 'Blast off!', order: 1 },
      { emoji: '🌙', text: 'Pass the moon', order: 2 },
      { emoji: '🪐', text: 'See Saturn', order: 3 },
      { emoji: '👽', text: 'Meet aliens', order: 4 },
      { emoji: '📸', text: 'Take photos', order: 5 },
      { emoji: '🏠', text: 'Return home', order: 6 },
    ],
    zones: [[3, 4, 5]],
  },
  7: {
    title: 'The Lost Dog',
    panels: [
      { emoji: '🐕', text: 'Dog runs away', order: 1 },
      { emoji: '😢', text: 'Owner is sad', order: 2 },
      { emoji: '📋', text: 'Make posters', order: 3 },
      { emoji: '🔍', text: 'Search everywhere', order: 4 },
      { emoji: '👀', text: 'Neighbor sees dog', order: 5 },
      { emoji: '📱', text: 'Calls owner', order: 6 },
      { emoji: '🤗', text: 'Reunited!', order: 7 },
    ],
    zones: [[2, 3, 4, 5]],
  },
  8: {
    title: 'Birthday Surprise',
    panels: [
      { emoji: '💌', text: 'Send invites', order: 1 },
      { emoji: '🎈', text: 'Decorate', order: 2 },
      { emoji: '🎂', text: 'Bake cake', order: 3 },
      { emoji: '🚪', text: 'Guests arrive', order: 4 },
      { emoji: '😮', text: 'Birthday surprise!', order: 5 },
      { emoji: '🎁', text: 'Open presents', order: 6 },
      { emoji: '🎉', text: 'Party time!', order: 7 },
      { emoji: '😴', text: 'Tired but happy', order: 8 },
    ],
    zones: [[1, 2, 3]],
  },
  9: {
    title: 'Science Fair Project',
    panels: [
      { emoji: '💡', text: 'Get an idea', order: 1 },
      { emoji: '📚', text: 'Do research', order: 2 },
      { emoji: '📝', text: 'Write hypothesis', order: 3 },
      { emoji: '🧪', text: 'Do experiment', order: 4 },
      { emoji: '📊', text: 'Record results', order: 5 },
      { emoji: '🖼️', text: 'Make poster', order: 6 },
      { emoji: '🎤', text: 'Present project', order: 7 },
      { emoji: '🏆', text: 'Win a ribbon!', order: 8 },
    ],
  },
  10: {
    title: 'The Camping Trip',
    panels: [
      { emoji: '🗺️', text: 'Plan the trip', order: 1 },
      { emoji: '🎒', text: 'Pack supplies', order: 2 },
      { emoji: '🚗', text: 'Drive to camp', order: 3 },
      { emoji: '⛺', text: 'Set up tent', order: 4 },
      { emoji: '🥾', text: 'Go hiking', order: 5 },
      { emoji: '🐿️', text: 'See wildlife', order: 6 },
      { emoji: '🏕️', text: 'Make campfire', order: 7 },
      { emoji: '🌟', text: 'Watch stars', order: 8 },
      { emoji: '😴', text: 'Sleep in tent', order: 9 },
      { emoji: '🏠', text: 'Head home', order: 10 },
    ],
    zones: [[6, 7]],
  },
};

const tips = [
  '💡 Tip: Look for cause and effect — what makes the next thing happen?',
  '💡 Tip: Stories have a beginning, middle, and end. Find the START!',
  '💡 Tip: Think about time — what happens FIRST in the story?',
  '💡 Tip: The last panel usually shows the result or happy ending.',
  '💡 Tip: Tap two panels to swap them around!',
];

type Phase = 'intro' | 'playing' | 'result' | 'done';

function StoryBuilderGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const cycledStage = ((stage - 1) % 10) + 1;
  const story = allStories[cycledStage] || allStories[1];
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentOrder, setCurrentOrder] = useState<Panel[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#67e8f9');
  const [resultColors, setResultColors] = useState<(string | null)[]>([]);
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
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

  const startGame = useCallback(() => {
    setCurrentOrder([...story.panels].sort(() => Math.random() - 0.5));
    setSelectedIndex(null);
    setFeedback('');
    setFeedbackColor('#67e8f9');
    setResultColors([]);
    setPhase('playing');
  }, [story]);

  const handlePanelTap = useCallback((idx: number) => {
    if (phase !== 'playing') return;
    if (selectedIndex === null) {
      setSelectedIndex(idx);
    } else if (selectedIndex === idx) {
      setSelectedIndex(null);
    } else {
      setCurrentOrder(prev => {
        const next = [...prev];
        const temp = next[selectedIndex!];
        next[selectedIndex!] = next[idx];
        next[idx] = temp;
        return next;
      });
      setSelectedIndex(null);
      setFeedback('Swapped! Keep arranging...');
    }
  }, [phase, selectedIndex]);

  const checkOrder = useCallback(() => {
    const { flags, accuracy } = evaluateSequence(currentOrder, story);
    const correct = flags.filter(Boolean).length;

    const newScore = Math.round(accuracy * 300);
    onScore(newScore);
    onProgress(accuracy);

    const colors = currentOrder.map((_, i) => (flags[i] ? '#4ade80' : '#ff6e6c'));
    setResultColors(colors);
    setPhase('result');

    if (accuracy === 1) {
      setFeedback('🎉 Perfect story! You told it perfectly!');
      setFeedbackColor('#4ade80');
      schedule(() => {
        if (endedRef.current) return;
        endedRef.current = true;
        const stars = accuracy >= 0.75 ? 3 : accuracy >= 0.4 ? 2 : 1;
        onEnd({
          score: newScore + 50,
          stars,
          summary: `Storytelling master! "${story.title}" was in perfect order! You understand how stories flow! 🏆`,
        });
      }, 1200);
    } else {
      setFeedback(`${correct}/${story.panels.length} panels in right order. Green = correct!`);
      setFeedbackColor('#fbbf24');

      let summary: string;
      if (accuracy >= 0.8) {
        summary = `Almost! ${correct}/${story.panels.length} correct. Check the red panels — what should come before/after?`;
      } else {
        summary = `${correct}/${story.panels.length} correct. Think about the story: what happens FIRST? What's the ending?`;
      }

      schedule(() => {
        if (endedRef.current) return;
        endedRef.current = true;
        const stars = accuracy >= 0.75 ? 3 : accuracy >= 0.4 ? 2 : 1;
        onEnd({ score: newScore, stars, summary });
      }, 2500);
    }
  }, [currentOrder, story, onScore, onProgress, onEnd, schedule]);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-5 text-center">
        <div className="text-6xl mb-4">📖</div>
        <h2 className="text-2xl font-bold text-[#c084fc] mb-2">Story Builder</h2>
        <p className="text-[#f0a83a] mb-4 max-w-xs">Put the comic panels in order to tell the story!</p>
        <div className="bg-[#1a332e] rounded-xl p-4 mb-5 max-w-xs">
          <div className="text-xl text-[#ff6e6c] mb-2">&quot;{story.title}&quot;</div>
          <div className="text-[#67e8f9]">{story.panels.length} panels to arrange</div>
          <div className="flex gap-1 justify-center flex-wrap mt-2">
            {story.panels.map((p, i) => (
              <span key={i} className="text-xl">{p.emoji}</span>
            ))}
          </div>
        </div>
        <p className="text-[#67e8f9] text-sm mb-5 max-w-xs">{tip}</p>
        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Start Building! 📖
        </button>
      </div>
    );
  }

  const panelWidth = story.panels.length > 6 ? 80 : 95;

  return (
    <div className="flex flex-col h-full min-h-[350px] items-center">
      <div className="px-4 py-2 bg-[#1a332e] rounded-xl mb-2">
        <span className="text-[#ff6e6c] font-bold">{story.title}</span>
      </div>
      <div className="text-[#67e8f9] text-sm mb-2">Tap two panels to swap them!</div>
      <div className="flex flex-wrap gap-2.5 justify-center p-2 flex-1 content-start">
        {currentOrder.map((panel, i) => {
          const isSelected = selectedIndex === i;
          const borderColor = resultColors[i] || (isSelected ? '#ff6e6c' : '#c084fc');
          const bgColor = resultColors[i] ? `${resultColors[i]}26` : '#1a332e';
          return (
            <button
              key={`${panel.order}-${i}`}
              onPointerDown={() => handlePanelTap(i)}
              disabled={phase !== 'playing'}
              className="rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all p-1.5"
              style={{
                width: panelWidth,
                height: panelWidth + 25,
                background: bgColor,
                border: `3px solid ${borderColor}`,
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <span className={panelWidth > 80 ? 'text-3xl' : 'text-2xl'}>{panel.emoji}</span>
              <span className="text-[0.65rem] text-white text-center leading-tight">{panel.text}</span>
              <span className="text-[0.6rem] text-[#6b7280]">{i + 1}</span>
            </button>
          );
        })}
      </div>
      {phase === 'playing' && (
        <div className="p-2.5">
          <button
            onClick={checkOrder}
            className="bg-[#4ade80] text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95"
          >
            Tell the Story! ✓
          </button>
        </div>
      )}
      <div className="text-sm min-h-[24px] text-center p-2" style={{ color: feedbackColor }}>
        {feedback}
      </div>
    </div>
  );
}

export default StoryBuilderGame;
