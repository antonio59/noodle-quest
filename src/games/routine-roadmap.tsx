import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameProps } from '@/types';
import { evaluateSequence } from '@/lib/sequence-scorer';

interface Task {
  emoji: string;
  text: string;
  order: number;
}

interface Routine {
  name: string;
  tasks: Task[];
  /** Canonical orders whose members are interchangeable in any order. */
  zones?: number[][];
  /** Canonical order pairs that may be swapped freely. */
  swappable?: [number, number][];
}

const allRoutines: Record<number, Routine> = {
  1: {
    name: 'Morning Wake Up',
    tasks: [
      { emoji: '⏰', text: 'Alarm rings', order: 1 },
      { emoji: '🛏️', text: 'Get out of bed', order: 2 },
      { emoji: '🪥', text: 'Brush teeth', order: 3 },
    ],
  },
  2: {
    name: 'Getting Dressed',
    tasks: [
      { emoji: '🧦', text: 'Put on socks', order: 1 },
      { emoji: '👕', text: 'Put on shirt', order: 2 },
      { emoji: '👖', text: 'Put on pants', order: 3 },
      { emoji: '👟', text: 'Put on shoes', order: 4 },
    ],
    zones: [[1, 2, 3]],
  },
  3: {
    name: 'Morning Routine',
    tasks: [
      { emoji: '🛏️', text: 'Wake up', order: 1 },
      { emoji: '🪥', text: 'Brush teeth', order: 2 },
      { emoji: '👕', text: 'Get dressed', order: 3 },
      { emoji: '🥣', text: 'Eat breakfast', order: 4 },
      { emoji: '🎒', text: 'Pack bag', order: 5 },
    ],
    zones: [[2, 3, 4, 5]],
  },
  4: {
    name: 'Making a Sandwich',
    tasks: [
      { emoji: '🍞', text: 'Get bread', order: 1 },
      { emoji: '🧈', text: 'Spread butter', order: 2 },
      { emoji: '🧀', text: 'Add cheese', order: 3 },
      { emoji: '🥬', text: 'Add lettuce', order: 4 },
      { emoji: '🍞', text: 'Put top bread', order: 5 },
      { emoji: '🔪', text: 'Cut in half', order: 6 },
    ],
    zones: [[2, 3, 4]],
  },
  5: {
    name: 'Baking Cookies',
    tasks: [
      { emoji: '📖', text: 'Read recipe', order: 1 },
      { emoji: '🥣', text: 'Mix ingredients', order: 2 },
      { emoji: '🔥', text: 'Preheat oven', order: 3 },
      { emoji: '🍪', text: 'Shape cookies', order: 4 },
      { emoji: '⏰', text: 'Bake in oven', order: 5 },
      { emoji: '❄️', text: 'Let cool', order: 6 },
      { emoji: '😋', text: 'Enjoy!', order: 7 },
    ],
    swappable: [[2, 3], [3, 4]],
  },
  6: {
    name: 'Going to School',
    tasks: [
      { emoji: '⏰', text: 'Wake up early', order: 1 },
      { emoji: '🚿', text: 'Take shower', order: 2 },
      { emoji: '👕', text: 'Get dressed', order: 3 },
      { emoji: '🥣', text: 'Eat breakfast', order: 4 },
      { emoji: '🎒', text: 'Pack bag', order: 5 },
      { emoji: '👋', text: 'Say goodbye', order: 6 },
      { emoji: '🚌', text: 'Catch bus', order: 7 },
    ],
    zones: [[3, 4, 5]],
  },
  7: {
    name: 'Doing Homework',
    tasks: [
      { emoji: '🏠', text: 'Get home', order: 1 },
      { emoji: '🍎', text: 'Have a snack', order: 2 },
      { emoji: '📚', text: 'Get supplies', order: 3 },
      { emoji: '📝', text: 'Check assignments', order: 4 },
      { emoji: '✏️', text: 'Do homework', order: 5 },
      { emoji: '✅', text: 'Check work', order: 6 },
      { emoji: '🎒', text: 'Pack for tomorrow', order: 7 },
      { emoji: '🎮', text: 'Free time!', order: 8 },
    ],
    zones: [[2, 3, 4]],
  },
  8: {
    name: 'Plan Your Day',
    tasks: [
      { emoji: '🌅', text: 'Morning exercise', order: 1 },
      { emoji: '🥣', text: 'Healthy breakfast', order: 2 },
      { emoji: '📚', text: 'Study time', order: 3 },
      { emoji: '🍎', text: 'Healthy lunch', order: 4 },
      { emoji: '🎨', text: 'Creative time', order: 5 },
      { emoji: '🤝', text: 'Help family', order: 6 },
      { emoji: '📖', text: 'Read book', order: 7 },
      { emoji: '🎮', text: 'Game time', order: 8 },
      { emoji: '🌙', text: 'Bedtime routine', order: 9 },
    ],
  },
  9: {
    name: 'Throwing a Party',
    tasks: [
      { emoji: '📅', text: 'Pick a date', order: 1 },
      { emoji: '📝', text: 'Make guest list', order: 2 },
      { emoji: '💌', text: 'Send invitations', order: 3 },
      { emoji: '🛒', text: 'Buy supplies', order: 4 },
      { emoji: '🎈', text: 'Decorate', order: 5 },
      { emoji: '🍰', text: 'Prepare food', order: 6 },
      { emoji: '👋', text: 'Greet guests', order: 7 },
      { emoji: '🎉', text: 'Party time!', order: 8 },
      { emoji: '🧹', text: 'Clean up', order: 9 },
      { emoji: '💤', text: 'Rest!', order: 10 },
    ],
    swappable: [[1, 2], [3, 4], [5, 6]],
  },
  10: {
    name: 'Science Experiment',
    tasks: [
      { emoji: '❓', text: 'Ask a question', order: 1 },
      { emoji: '📚', text: 'Do research', order: 2 },
      { emoji: '💭', text: 'Make hypothesis', order: 3 },
      { emoji: '📝', text: 'Plan experiment', order: 4 },
      { emoji: '🧪', text: 'Gather materials', order: 5 },
      { emoji: '🔬', text: 'Do experiment', order: 6 },
      { emoji: '📊', text: 'Record results', order: 7 },
      { emoji: '🤔', text: 'Analyze data', order: 8 },
      { emoji: '✅', text: 'Draw conclusion', order: 9 },
      { emoji: '📢', text: 'Share findings', order: 10 },
    ],
  },
};

const tips = [
  '💡 Tip: Think about what HAS to happen FIRST before other things can happen.',
  "💡 Tip: Look for clues — you can't eat cookies before baking them!",
  '💡 Tip: Imagine yourself doing the activity — what would you do first?',
  '💡 Tip: Some tasks are obvious firsts (wake up) or lasts (enjoy/clean up).',
  '💡 Tip: If stuck, start with what you KNOW is first or last!',
];

type Phase = 'intro' | 'playing' | 'result' | 'done';

function RoutineRoadmapGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const cycledStage = ((stage - 1) % 10) + 1;
  const routine = allRoutines[cycledStage] || allRoutines[1];
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentOrder, setCurrentOrder] = useState<Task[]>([]);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#67e8f9');
  const [resultColors, setResultColors] = useState<(string | null)[]>([]);
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
  const draggedItem = useRef<number | null>(null);
  const touchStartY = useRef(0);
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
    setCurrentOrder([...routine.tasks].sort(() => Math.random() - 0.5));
    setFeedback('');
    setFeedbackColor('#67e8f9');
    setResultColors([]);
    setPhase('playing');
  }, [routine]);

  const handleDragStart = useCallback((idx: number) => {
    draggedItem.current = idx;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((idx: number) => {
    if (draggedItem.current !== null && draggedItem.current !== idx) {
      setCurrentOrder(prev => {
        const next = [...prev];
        const temp = next[draggedItem.current!];
        next.splice(draggedItem.current!, 1);
        next.splice(idx, 0, temp);
        return next;
      });
    }
    draggedItem.current = null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, idx: number) => {
    const endY = e.changedTouches[0].clientY;
    const deltaY = endY - touchStartY.current;
    const itemHeight = 56;
    const moveItems = Math.round(deltaY / itemHeight);
    const newIdx = Math.max(0, Math.min(currentOrder.length - 1, idx + moveItems));

    if (newIdx !== idx) {
      setCurrentOrder(prev => {
        const next = [...prev];
        const temp = next[idx];
        next.splice(idx, 1);
        next.splice(newIdx, 0, temp);
        return next;
      });
    }
  }, [currentOrder.length]);

  const checkOrder = useCallback(() => {
    const { flags, accuracy } = evaluateSequence(currentOrder, routine);
    const correct = flags.filter(Boolean).length;

    const newScore = Math.round(accuracy * 300);
    onScore(newScore);
    onProgress(accuracy);

    const colors = currentOrder.map((_, i) => (flags[i] ? '#4ade80' : '#ff6e6c'));
    setResultColors(colors);
    setPhase('result');

    if (accuracy === 1) {
      setFeedback('🎉 Perfect order! You nailed it!');
      setFeedbackColor('#4ade80');
      schedule(() => {
        if (endedRef.current) return;
        endedRef.current = true;
        const stars = accuracy >= 0.75 ? 3 : accuracy >= 0.4 ? 2 : 1;
        onEnd({
          score: newScore + 50,
          stars,
          summary: `Perfect! You put "${routine.name}" in exactly the right order! Great sequencing skills! 🏆`,
        });
      }, 1200);
    } else {
      setFeedback(`${correct}/${routine.tasks.length} in the right place. Green = correct!`);
      setFeedbackColor('#fbbf24');

      let summary: string;
      if (accuracy >= 0.8) {
        summary = `Almost perfect! ${correct}/${routine.tasks.length} correct. Look at the red items — what should come before/after them?`;
      } else if (accuracy >= 0.5) {
        summary = `${correct}/${routine.tasks.length} correct. Think about what MUST happen first before other things can happen.`;
      } else {
        summary = `${correct}/${routine.tasks.length} correct. Imagine doing "${routine.name}" yourself — what would you do first?`;
      }

      schedule(() => {
        if (endedRef.current) return;
        endedRef.current = true;
        const stars = accuracy >= 0.75 ? 3 : accuracy >= 0.4 ? 2 : 1;
        onEnd({
          score: newScore,
          stars,
          summary,
        });
      }, 2500);
    }
  }, [currentOrder, routine, onScore, onProgress, onEnd, schedule]);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-5 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-2xl font-bold text-[#fbbf24] mb-2">Routine Roadmap</h2>
        <p className="text-[#fcd34d] mb-4 max-w-xs">Put the tasks in the right order!</p>
        <div className="bg-[#1a332e] rounded-xl p-4 mb-5 max-w-xs">
          <div className="text-xl text-[#fbbf24] mb-2">{routine.name}</div>
          <div className="text-[#67e8f9]">{routine.tasks.length} steps to put in order</div>
          <div className="flex gap-1 justify-center flex-wrap mt-2">
            {routine.tasks.map((t, i) => (
              <span key={i} className="text-xl">{t.emoji}</span>
            ))}
          </div>
        </div>
        <div className="bg-[#1a1833] rounded-lg p-3 mb-4 max-w-xs">
          <div className="text-[#4ade80] text-sm">Drag tasks up/down to reorder them!</div>
        </div>
        <p className="text-[#67e8f9] text-sm mb-5 max-w-xs">{tip}</p>
        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Start Ordering! 📋
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[350px] items-center">
      <div className="px-4 py-2 bg-[#1a332e] rounded-xl mb-2 text-center">
        <span className="text-[#fbbf24] font-bold">{routine.name}</span>
      </div>
      <div className="text-[#67e8f9] text-sm mb-2">Drag to put in order! First at top.</div>
      <div className="flex flex-col gap-1.5 w-full max-w-sm flex-1 overflow-y-auto p-1">
        {currentOrder.map((task, i) => {
          const borderColor = resultColors[i] || '#c084fc';
          const bgColor = resultColors[i] ? `${resultColors[i]}26` : '#1a332e';
          return (
            <div
              key={`${task.order}-${i}`}
              draggable={phase === 'playing'}
              onDragStart={() => handleDragStart(i)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(i)}
              onTouchStart={(e) => handleTouchStart(e)}
              onTouchEnd={(e) => handleTouchEnd(e, i)}
              className="p-2.5 px-3.5 rounded-lg flex items-center gap-2.5 transition-all select-none"
              style={{
                background: bgColor,
                border: `2px solid ${borderColor}`,
                cursor: phase === 'playing' ? 'grab' : 'default',
              }}
            >
              <span className="text-[#6b7280] text-sm min-w-[20px]">{i + 1}.</span>
              <span className="text-2xl">{task.emoji}</span>
              <span className="flex-1 text-white text-[0.95rem]">{task.text}</span>
              <span className="text-[#67e8f9] text-lg">☰</span>
            </div>
          );
        })}
      </div>
      {phase === 'playing' && (
        <div className="flex gap-3 p-2.5">
          <button
            onClick={checkOrder}
            className="bg-[#4ade80] text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95"
          >
            Check Order! ✓
          </button>
        </div>
      )}
      <div className="text-sm min-h-[24px] text-center p-2" style={{ color: feedbackColor }}>
        {feedback}
      </div>
    </div>
  );
}

export default RoutineRoadmapGame;
