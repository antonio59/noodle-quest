import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameProps } from '@/types';
import { GameArt } from '@/components/GameArt';

interface Question {
  scenario: string;
  emoji: string;
  correct: string;
  options: string[];
}

const allQuestions: Record<number, Question[]> = {
  1: [
    { scenario: 'You get a gold star on your work!', emoji: '⭐', correct: 'proud', options: ['proud', 'sad', 'scared'] },
    { scenario: 'Your friend shares their snack with you', emoji: '🍪', correct: 'happy', options: ['angry', 'happy', 'nervous'] },
    { scenario: 'Your balloon floats away', emoji: '🎈', correct: 'sad', options: ['excited', 'sad', 'proud'] },
  ],
  2: [
    { scenario: 'You got a perfect score on your test!', emoji: '📝', correct: 'proud', options: ['happy', 'proud', 'sad'] },
    { scenario: 'Your ice cream fell on the ground', emoji: '🍦', correct: 'sad', options: ['angry', 'sad', 'scared'] },
    { scenario: 'Someone took your toy without asking', emoji: '🧸', correct: 'angry', options: ['happy', 'angry', 'surprised'] },
    { scenario: 'A big dog runs toward you', emoji: '🐕', correct: 'scared', options: ['proud', 'scared', 'happy'] },
  ],
  3: [
    { scenario: 'You finished a really hard puzzle!', emoji: '🧩', correct: 'accomplished', options: ['bored', 'accomplished', 'jealous'] },
    { scenario: "Your friend got a gift and you didn't", emoji: '🎁', correct: 'jealous', options: ['jealous', 'relieved', 'confident'] },
    { scenario: 'You thought you lost your backpack but found it', emoji: '🎒', correct: 'relieved', options: ['embarrassed', 'relieved', 'disappointed'] },
    { scenario: 'You have to give a speech in front of class', emoji: '🎤', correct: 'nervous', options: ['nervous', 'excited', 'grateful'] },
  ],
  4: [
    { scenario: 'Your teacher praises your drawing', emoji: '🎨', correct: 'proud', options: ['proud', 'anxious', 'bored'] },
    { scenario: "Someone says you're really good at soccer", emoji: '⚽', correct: 'confident', options: ['scared', 'confident', 'jealous'] },
    { scenario: "You accidentally broke Mom's vase", emoji: '🏺', correct: 'guilty', options: ['happy', 'guilty', 'excited'] },
    { scenario: 'Tomorrow is your birthday party!', emoji: '🎂', correct: 'excited', options: ['sad', 'nervous', 'excited'] },
  ],
  5: [
    { scenario: 'You helped a lost kid find their mom', emoji: '👩‍👧', correct: 'helpful', options: ['anxious', 'helpful', 'jealous'] },
    { scenario: 'You tripped in front of everyone', emoji: '😳', correct: 'embarrassed', options: ['proud', 'embarrassed', 'relieved'] },
    { scenario: 'Your best friend moved away', emoji: '✈️', correct: 'sad', options: ['excited', 'sad', 'angry'] },
    { scenario: 'You got picked first for the team!', emoji: '🏀', correct: 'proud', options: ['nervous', 'proud', 'guilty'] },
    { scenario: 'Someone shared a secret with you', emoji: '🤫', correct: 'trusted', options: ['trusted', 'bored', 'angry'] },
  ],
  6: [
    { scenario: 'You won but your friend looked sad', emoji: '🏆', correct: 'conflicted', options: ['ecstatic', 'conflicted', 'ashamed'] },
    { scenario: 'You studied hard but still got it wrong', emoji: '📚', correct: 'disappointed', options: ['happy', 'jealous', 'disappointed'] },
    { scenario: 'Your friend forgave you after a fight', emoji: '🤝', correct: 'relieved', options: ['embarrassed', 'relieved', 'angry'] },
    { scenario: 'Everyone is laughing at your joke', emoji: '😂', correct: 'confident', options: ['anxious', 'confident', 'envious'] },
    { scenario: "You're waiting for test results", emoji: '📋', correct: 'anxious', options: ['bored', 'anxious', 'proud'] },
  ],
  7: [
    { scenario: 'Your friend is moving away', emoji: '✈️', correct: 'bittersweet', options: ['indifferent', 'bittersweet', 'furious'] },
    { scenario: 'Someone compliments your art unexpectedly', emoji: '🎨', correct: 'flattered', options: ['flattered', 'suspicious', 'overwhelmed'] },
    { scenario: 'You have too many fun things to choose from', emoji: '📅', correct: 'overwhelmed', options: ['bored', 'overwhelmed', 'content'] },
    { scenario: 'Your sibling got in trouble for what you did', emoji: '😬', correct: 'guilty', options: ['happy', 'guilty', 'nervous'] },
    { scenario: 'Someone kept their promise to you', emoji: '🤝', correct: 'grateful', options: ['surprised', 'grateful', 'jealous'] },
  ],
  8: [
    { scenario: 'You see your pet after a week apart', emoji: '🐶', correct: 'overjoyed', options: ['calm', 'overjoyed', 'worried'] },
    { scenario: 'Your friend got something you wanted', emoji: '📱', correct: 'envious', options: ['proud', 'envious', 'relaxed'] },
    { scenario: 'You finally beat a really hard game level', emoji: '🎮', correct: 'triumphant', options: ['bored', 'triumphant', 'anxious'] },
    { scenario: 'Someone copies your homework without asking', emoji: '📝', correct: 'frustrated', options: ['happy', 'frustrated', 'scared'] },
    { scenario: "You're the only one who knows the answer", emoji: '🙋', correct: 'confident', options: ['nervous', 'confident', 'embarrassed'] },
  ],
  9: [
    { scenario: 'Your drawing got picked for the school display', emoji: '🖼️', correct: 'honored', options: ['embarrassed', 'honored', 'anxious'] },
    { scenario: 'Someone said something mean about you', emoji: '💔', correct: 'hurt', options: ['proud', 'hurt', 'excited'] },
    { scenario: 'You found out the party was a surprise for YOU', emoji: '🎉', correct: 'shocked', options: ['bored', 'angry', 'shocked'] },
    { scenario: "You couldn't help a friend who was struggling", emoji: '😟', correct: 'helpless', options: ['happy', 'helpless', 'jealous'] },
    { scenario: 'Your hard work finally paid off', emoji: '🌟', correct: 'satisfied', options: ['frustrated', 'satisfied', 'nervous'] },
  ],
  10: [
    { scenario: 'Everyone is depending on you to win', emoji: '🏅', correct: 'pressured', options: ['calm', 'pressured', 'bored'] },
    { scenario: 'You made someone smile when they were sad', emoji: '😊', correct: 'fulfilled', options: ['guilty', 'fulfilled', 'jealous'] },
    { scenario: "You realized you forgot a friend's birthday", emoji: '📅', correct: 'remorseful', options: ['happy', 'remorseful', 'proud'] },
    { scenario: 'Your secret talent got discovered', emoji: '🌟', correct: 'exposed', options: ['exposed', 'angry', 'bored'] },
    { scenario: 'You finished everything and have free time', emoji: '⏰', correct: 'content', options: ['stressed', 'content', 'guilty'] },
    { scenario: 'Two friends are fighting and want you to pick sides', emoji: '😰', correct: 'torn', options: ['excited', 'torn', 'proud'] },
  ],
};

const emotions: Record<string, { emoji: string; color: string }> = {
  happy: { emoji: '😊', color: '#fbbf24' }, proud: { emoji: '🥰', color: '#ff6e6c' },
  sad: { emoji: '😢', color: '#67e8f9' }, angry: { emoji: '😠', color: '#ff6e6c' },
  scared: { emoji: '😨', color: '#c084fc' }, surprised: { emoji: '😲', color: '#f472b6' },
  accomplished: { emoji: '🤩', color: '#4ade80' }, bored: { emoji: '😴', color: '#94a3b8' },
  jealous: { emoji: '😒', color: '#f0a83a' }, relieved: { emoji: '😌', color: '#4ade80' },
  confident: { emoji: '😎', color: '#fbbf24' }, nervous: { emoji: '😰', color: '#67e8f9' },
  excited: { emoji: '🤗', color: '#ff6e6c' }, grateful: { emoji: '🥲', color: '#4ade80' },
  embarrassed: { emoji: '😳', color: '#f472b6' }, disappointed: { emoji: '😞', color: '#67e8f9' },
  bittersweet: { emoji: '🥺', color: '#c084fc' }, indifferent: { emoji: '😐', color: '#94a3b8' },
  conflicted: { emoji: '😕', color: '#f0a83a' }, ecstatic: { emoji: '🤯', color: '#ff6e6c' },
  ashamed: { emoji: '😔', color: '#64748b' }, flattered: { emoji: '☺️', color: '#f472b6' },
  suspicious: { emoji: '🤨', color: '#94a3b8' }, overwhelmed: { emoji: '😵', color: '#c084fc' },
  content: { emoji: '😌', color: '#4ade80' }, anxious: { emoji: '😟', color: '#67e8f9' },
  envious: { emoji: '👀', color: '#f0a83a' }, furious: { emoji: '🤬', color: '#dc2626' },
  guilty: { emoji: '😣', color: '#94a3b8' }, helpful: { emoji: '🤝', color: '#4ade80' },
  trusted: { emoji: '🤗', color: '#c084fc' }, overjoyed: { emoji: '🥳', color: '#fbbf24' },
  frustrated: { emoji: '😤', color: '#ff6e6c' }, triumphant: { emoji: '💪', color: '#4ade80' },
  honored: { emoji: '🙏', color: '#c084fc' }, hurt: { emoji: '💔', color: '#ff6e6c' },
  shocked: { emoji: '😱', color: '#f472b6' }, helpless: { emoji: '😓', color: '#94a3b8' },
  satisfied: { emoji: '😊', color: '#4ade80' }, pressured: { emoji: '😰', color: '#ff6e6c' },
  fulfilled: { emoji: '🥰', color: '#c084fc' }, remorseful: { emoji: '😢', color: '#67e8f9' },
  exposed: { emoji: '😳', color: '#f472b6' }, torn: { emoji: '😖', color: '#f0a83a' },
  calm: { emoji: '😌', color: '#4ade80' }, worried: { emoji: '😟', color: '#67e8f9' },
  relaxed: { emoji: '😎', color: '#4ade80' }, stressed: { emoji: '😫', color: '#ff6e6c' },
};

type Phase = 'intro' | 'playing' | 'feedback' | 'done';

function FeelingsFacesGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const cycledStage = ((stage - 1) % 10) + 1;
  const questions = allQuestions[cycledStage] || allQuestions[1];
  const [phase, setPhase] = useState<Phase>('intro');
  const [score, setScore] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#67e8f9');
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);

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
    setCurrentQ(0);
    setScore(0);
    setFeedback('');
    setSelectedOpt(null);
    setPhase('playing');
  }, []);

  const handleOption = useCallback((opt: string) => {
    if (phase !== 'playing') return;
    const q = questions[currentQ];
    setSelectedOpt(opt);
    setPhase('feedback');

    if (opt === q.correct) {
      const newScore = score + 30;
      setScore(newScore);
      onScore(30);
      setFeedback('✅ Exactly right! Great emotional awareness!');
      setFeedbackColor('#4ade80');

      schedule(() => {
        const next = currentQ + 1;
        if (next >= questions.length) {
          if (endedRef.current) return;
          endedRef.current = true;
          const avgScore = newScore / questions.length;
          const stars = avgScore > 25 ? 3 : avgScore > 15 ? 2 : 1;
          let summary: string;
          if (stars === 3) summary = 'Emotion expert! You really understand how people feel! This helps you be a great friend! 🏆';
          else if (stars === 2) summary = 'Good job! Understanding feelings takes practice. Keep noticing how you and others feel!';
          else summary = 'Nice try! Feelings can be tricky. Think about how YOU would feel in each situation.';
          onEnd({ score: newScore + 50, stars, summary });
        } else {
          setCurrentQ(next);
          setSelectedOpt(null);
          setFeedback('');
          setPhase('playing');
          onProgress(next / questions.length);
        }
      }, 900);
    } else {
      const correctEmo = emotions[q.correct] || { emoji: '❓' };
      setFeedback(`Not quite! It was "${q.correct}" ${correctEmo.emoji}`);
      setFeedbackColor('#fbbf24');

      schedule(() => {
        const next = currentQ + 1;
        if (next >= questions.length) {
          if (endedRef.current) return;
          endedRef.current = true;
          const avgScore = score / questions.length;
          const stars = avgScore > 20 ? 3 : avgScore > 10 ? 2 : 1;
          onEnd({
            score,
            stars,
            summary: `You identified ${Math.round(score / 30)} emotions correctly! Keep practicing — emotional intelligence grows with experience!`,
          });
        } else {
          setCurrentQ(next);
          setSelectedOpt(null);
          setFeedback('');
          setPhase('playing');
          onProgress(next / questions.length);
        }
      }, 1500);
    }
  }, [phase, currentQ, questions, score, onScore, onProgress, onEnd, schedule]);

  if (phase === 'intro') {
    const sampleEmojis = questions.map(q => q.emoji).slice(0, 5);
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center gap-4">
        <GameArt gameId="feelings-faces" emoji="🫀" size={80} />
        <h2 className="text-2xl font-bold text-accent">Feelings Faces</h2>
        <p className="text-text-dim max-w-xs">Read the situation and pick the feeling that matches!</p>

        <div className="bg-card rounded-xl p-4 max-w-xs w-full">
          <div className="text-warning font-bold mb-2">{questions.length} scenarios to explore</div>
          <div className="flex gap-2 justify-center flex-wrap text-2xl">
            {sampleEmojis.map((e, i) => <span key={i}>{e}</span>)}
          </div>
          <div className="text-text-muted text-sm mt-2">How would YOU feel?</div>
        </div>

        <div className="bg-surface rounded-lg p-3 max-w-xs w-full text-sm text-text-dim">
          💡 Think about how the person in each story would feel — put yourself in their shoes!
        </div>

        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start! 🫀
        </button>
      </div>
    );
  }

  const q = questions[currentQ];

  return (
    <div className="flex flex-col h-full min-h-[350px] items-center justify-center p-4">
      <div className="flex gap-4 px-4 py-2 bg-card rounded-xl mb-3">
        <span className="text-warning font-bold">Question {currentQ + 1}/{questions.length}</span>
        <span className="text-accent">Score: {score}</span>
      </div>

      <div className="text-5xl mb-2">{q.emoji}</div>
      <div className="bg-card p-4 px-5 rounded-xl text-center text-white text-base max-w-xs mb-3 shadow-lg">
        {q.scenario}
      </div>
      <div className="text-cyan-400 text-sm mb-3 font-medium">How would you feel?</div>

      <div className="flex flex-wrap gap-2.5 justify-center max-w-sm">
        {q.options.map((opt) => {
          const emo = emotions[opt] || { emoji: '❓', color: '#94a3b8' };
          let bg = `${emo.color}20`;
          let border = emo.color;
          let scale = 'scale(1)';
          if (phase === 'feedback' && selectedOpt === opt) {
            if (opt === q.correct) {
              bg = `${emo.color}60`;
              scale = 'scale(1.05)';
            } else {
              bg = '#ff6e6c22';
              border = '#ff6e6c';
            }
          }
          return (
            <button
              key={opt}
              onPointerDown={() => handleOption(opt)}
              disabled={phase !== 'playing'}
              className="text-white px-4 py-2.5 rounded-xl text-[0.95rem] flex items-center gap-2 transition-all duration-150"
              style={{
                background: bg,
                border: `2px solid ${border}`,
                opacity: phase !== 'playing' && selectedOpt !== opt ? 0.45 : 1,
                transform: scale,
                boxShadow: phase === 'feedback' && selectedOpt === opt && opt === q.correct
                  ? `0 0 16px ${emo.color}88` : 'none',
              }}
            >
              <span className="text-xl">{emo.emoji}</span>
              <span className="font-medium">{opt}</span>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="text-[0.95rem] min-h-[26px] mt-4 text-center px-4 font-medium" style={{ color: feedbackColor }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

export default FeelingsFacesGame;
