import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameProps } from '@/types';
import { GameArt } from '@/components/GameArt';

interface Scenario {
  friend: string;
  emoji: string;
  situation: string;
  options: { text: string; score: number }[];
}

const allScenarios: Record<number, Scenario[]> = {
  1: [
    { friend: 'Sam', emoji: '😢', situation: 'Sam dropped their ice cream. What do you say?', options: [
      { text: "That's sad! Want to share mine?", score: 3 },
      { text: 'You should be more careful', score: 1 },
      { text: 'Too bad!', score: 0 },
    ]},
    { friend: 'Alex', emoji: '😊', situation: 'Alex is excited about a birthday party! What do you say?', options: [
      { text: 'That sounds fun! Happy Birthday!', score: 3 },
      { text: 'Parties are boring', score: 0 },
      { text: 'I have better parties', score: 0 },
    ]},
  ],
  2: [
    { friend: 'Sam', emoji: '😢', situation: 'Sam dropped their ice cream and is crying. What do you say?', options: [
      { text: "That's so sad! Want to share mine?", score: 3 },
      { text: 'You should be more careful', score: 1 },
      { text: 'Ice cream is gross anyway', score: 0 },
    ]},
    { friend: 'Alex', emoji: '😰', situation: 'Alex is nervous about a test tomorrow. What do you say?', options: [
      { text: "You'll do great! Want to study together?", score: 3 },
      { text: "Tests are easy, don't worry", score: 1 },
      { text: 'I never study for tests', score: 0 },
    ]},
    { friend: 'Jordan', emoji: '😊', situation: 'Jordan is excited about their birthday party! What do you say?', options: [
      { text: 'That sounds fun! Happy Birthday!', score: 3 },
      { text: 'I have better parties', score: 0 },
      { text: 'Parties are too loud', score: 1 },
    ]},
  ],
  3: [
    { friend: 'Casey', emoji: '😔', situation: "Casey wasn't invited to a party everyone else is going to.", options: [
      { text: 'That hurts. Want to hang out instead?', score: 3 },
      { text: 'Maybe they forgot to invite you', score: 2 },
      { text: "Parties aren't that fun anyway", score: 1 },
    ]},
    { friend: 'Riley', emoji: '😤', situation: "Riley worked hard on a project but didn't win the contest.", options: [
      { text: 'Your work was amazing! I\'m proud of you.', score: 3 },
      { text: 'The judges made a mistake', score: 2 },
      { text: "Winning isn't everything", score: 1 },
    ]},
    { friend: 'Morgan', emoji: '😟', situation: "Morgan's pet is sick and at the vet.", options: [
      { text: "I'm here for you. I hope they feel better!", score: 3 },
      { text: 'Pets usually get better', score: 2 },
      { text: "It's just an animal", score: 0 },
    ]},
  ],
  4: [
    { friend: 'Quinn', emoji: '😳', situation: 'Quinn accidentally called the teacher "mom."', options: [
      { text: 'That happens to everyone! I did it once too.', score: 3 },
      { text: "That's embarrassing but funny", score: 2 },
      { text: "Everyone's staring at you", score: 0 },
    ]},
    { friend: 'Jamie', emoji: '😢', situation: 'Jamie fell down during the race and came in last.', options: [
      { text: 'Are you okay? It takes courage to keep going!', score: 3 },
      { text: 'At least you finished', score: 2 },
      { text: 'You should practice more', score: 1 },
    ]},
    { friend: 'Dana', emoji: '😊', situation: 'Dana just learned to ride a bike!', options: [
      { text: "That's awesome! Want to ride together?", score: 3 },
      { text: 'I learned years ago', score: 0 },
      { text: 'Cool', score: 1 },
    ]},
    { friend: 'Max', emoji: '😰', situation: 'Max is scared of the dark during a sleepover.', options: [
      { text: "That's okay! Let's leave a light on.", score: 3 },
      { text: "There's nothing to be scared of", score: 1 },
      { text: "Don't be a baby", score: 0 },
    ]},
  ],
  5: [
    { friend: 'Taylor', emoji: '😕', situation: "Taylor wants to play a game you don't like.", options: [
      { text: "Okay, let's play! Your company matters more.", score: 3 },
      { text: 'Can we play something else after?', score: 2 },
      { text: 'That game is boring, no thanks', score: 0 },
    ]},
    { friend: 'Avery', emoji: '😢', situation: "Avery's grandma passed away. They seem really sad.", options: [
      { text: "I'm so sorry. I'm here if you need me.", score: 3 },
      { text: "She's in a better place now", score: 2 },
      { text: "You'll feel better soon", score: 1 },
    ]},
    { friend: 'Peyton', emoji: '😤', situation: 'Peyton is mad because someone spread a rumor about them.', options: [
      { text: "That's not fair. Want help talking to them?", score: 3 },
      { text: 'Rumors fade eventually', score: 2 },
      { text: "Maybe it's partly true?", score: 0 },
    ]},
    { friend: 'Sage', emoji: '😰', situation: 'Sage is moving away and scared about making new friends.', options: [
      { text: "You're so kind, you'll make friends easily! We'll stay in touch.", score: 3 },
      { text: 'Making friends is easy', score: 1 },
      { text: "You'll forget about us anyway", score: 0 },
    ]},
  ],
  6: [
    { friend: 'Drew', emoji: '😔', situation: "Drew helped you cheat on a test and got caught, but you didn't.", options: [
      { text: "I'm so sorry. I should tell the truth too.", score: 3 },
      { text: 'Thanks for not telling on me', score: 0 },
      { text: "You shouldn't have gotten caught", score: 0 },
    ]},
    { friend: 'Blake', emoji: '😊', situation: 'Blake finally beat the hardest level in a game!', options: [
      { text: "That's amazing! I knew you could do it!", score: 3 },
      { text: 'I beat that ages ago', score: 0 },
      { text: 'It took you long enough', score: 0 },
    ]},
    { friend: 'Charlie', emoji: '😢', situation: "Charlie's parents are getting divorced.", options: [
      { text: "I'm really sorry. That must be so hard.", score: 3 },
      { text: 'Lots of people have divorced parents', score: 1 },
      { text: 'At least you\'ll get two bedrooms', score: 0 },
    ]},
    { friend: 'Robin', emoji: '😳', situation: 'Robin wore mismatched shoes to school by accident.', options: [
      { text: "Ha! That's actually kind of cool. Own it!", score: 3 },
      { text: 'Nobody probably noticed', score: 2 },
      { text: "That's so embarrassing", score: 0 },
    ]},
  ],
  7: [
    { friend: 'Skyler', emoji: '😟', situation: "Skyler's art project got ruined by accident.", options: [
      { text: 'Oh no! Do you want help making a new one?', score: 3 },
      { text: 'You can always make another', score: 2 },
      { text: 'Be more careful next time', score: 1 },
    ]},
    { friend: 'River', emoji: '😤', situation: "River got blamed for something they didn't do.", options: [
      { text: "That's so unfair! I'll tell them the truth.", score: 3 },
      { text: 'Just explain what happened', score: 2 },
      { text: "Life isn't always fair", score: 1 },
    ]},
    { friend: 'Phoenix', emoji: '😰', situation: 'Phoenix is scared to try out for the team.', options: [
      { text: "You should try! I'll cheer for you no matter what.", score: 3 },
      { text: "Tryouts aren't that hard", score: 1 },
      { text: "If you're scared, don't do it", score: 0 },
    ]},
    { friend: 'Rowan', emoji: '😊', situation: 'Rowan got the lead role in the school play!', options: [
      { text: 'You deserve it! You\'re going to be amazing!', score: 3 },
      { text: 'I wanted that role', score: 0 },
      { text: "Don't mess it up", score: 0 },
    ]},
    { friend: 'Harper', emoji: '😢', situation: "Harper's best friend started hanging out with someone else.", options: [
      { text: "That hurts. Friends can have other friends, but you're still special.", score: 3 },
      { text: 'Find new friends then', score: 1 },
      { text: 'Maybe you did something wrong', score: 0 },
    ]},
  ],
  8: [
    { friend: 'Finn', emoji: '😔', situation: "Finn didn't get picked for any team at recess.", options: [
      { text: 'Come play with me! We can start our own game.', score: 3 },
      { text: 'Maybe you\'ll get picked next time', score: 2 },
      { text: 'You need to get better at sports', score: 0 },
    ]},
    { friend: 'Ellis', emoji: '😤', situation: 'Ellis worked really hard but someone else got the award.', options: [
      { text: 'Your effort was amazing. I saw how hard you worked.', score: 3 },
      { text: "Awards don't mean everything", score: 2 },
      { text: 'Maybe try harder next time', score: 0 },
    ]},
    { friend: 'Remy', emoji: '😰', situation: 'Remy has to present in front of the whole school.', options: [
      { text: "You've practiced so much. I believe in you!", score: 3 },
      { text: 'Just imagine everyone in their underwear', score: 1 },
      { text: "Don't throw up on stage", score: 0 },
    ]},
    { friend: 'Kai', emoji: '😢', situation: "Kai found out they're failing a class.", options: [
      { text: "Let's figure this out together. I can help you study.", score: 3 },
      { text: 'Talk to the teacher', score: 2 },
      { text: 'You should have studied more', score: 0 },
    ]},
    { friend: 'Luca', emoji: '😊', situation: 'Luca just got their first job!', options: [
      { text: 'Congratulations! Tell me everything about it!', score: 3 },
      { text: 'Jobs are a lot of work', score: 1 },
      { text: 'How much do you get paid?', score: 0 },
    ]},
  ],
  9: [
    { friend: 'Ezra', emoji: '😟', situation: 'Ezra made a big mistake and everyone knows.', options: [
      { text: "Everyone makes mistakes. It doesn't define you.", score: 3 },
      { text: 'People will forget eventually', score: 2 },
      { text: 'What were you thinking?', score: 0 },
    ]},
    { friend: 'Nova', emoji: '😔', situation: 'Nova feels like nobody likes them.', options: [
      { text: "I like you! You're important to me.", score: 3 },
      { text: "That's not true", score: 1 },
      { text: 'Maybe try being nicer', score: 0 },
    ]},
    { friend: 'Ash', emoji: '😤', situation: "Ash's sibling always gets more attention.", options: [
      { text: 'That feels really unfair. Your feelings matter.', score: 3 },
      { text: 'Parents try to be equal', score: 1 },
      { text: 'Stop complaining', score: 0 },
    ]},
    { friend: 'Indigo', emoji: '😰', situation: 'Indigo is worried their parents might split up.', options: [
      { text: "That must be really scary. I'm here for you.", score: 3 },
      { text: "Maybe it won't happen", score: 2 },
      { text: 'That happens to a lot of families', score: 1 },
    ]},
    { friend: 'Juno', emoji: '😊', situation: 'Juno got accepted into their dream school!', options: [
      { text: "I'm SO happy for you! You worked so hard!", score: 3 },
      { text: 'I hope I get in too', score: 1 },
      { text: 'That school is too expensive', score: 0 },
    ]},
  ],
  10: [
    { friend: 'Eden', emoji: '😔', situation: 'Eden trusted someone who shared their secret.', options: [
      { text: "I'm so sorry. That's a real betrayal. I'm always safe to talk to.", score: 3 },
      { text: "You shouldn't have told them", score: 0 },
      { text: 'What was the secret?', score: 0 },
    ]},
    { friend: 'Sage', emoji: '😤', situation: 'Sage is always compared to their "perfect" sibling.', options: [
      { text: "You're amazing in your own way. Comparing isn't fair.", score: 3 },
      { text: 'Try to do better', score: 0 },
      { text: "At least you're not the worst", score: 0 },
    ]},
    { friend: 'Ocean', emoji: '😟', situation: "Ocean is being pressured to do something they don't want to.", options: [
      { text: 'Your boundaries matter. It\'s okay to say no. I support you.', score: 3 },
      { text: 'Just do it to fit in', score: 0 },
      { text: "What's the big deal?", score: 0 },
    ]},
    { friend: 'Winter', emoji: '😢', situation: 'Winter failed after trying their very best.', options: [
      { text: "I'm proud you tried. Failure is part of growth. What's next?", score: 3 },
      { text: 'At least you tried', score: 2 },
      { text: "Maybe this isn't for you", score: 0 },
    ]},
    { friend: 'Storm', emoji: '😰', situation: 'Storm is scared to stand up to a bully.', options: [
      { text: "Let's talk to an adult together. You don't have to face this alone.", score: 3 },
      { text: 'Just ignore them', score: 1 },
      { text: 'Stand up for yourself', score: 1 },
    ]},
    { friend: 'Sky', emoji: '😊', situation: 'Sky finally conquered their biggest fear!', options: [
      { text: "That took SO much courage! I'm incredibly proud of you!", score: 3 },
      { text: 'What was your fear?', score: 1 },
      { text: "That wasn't a big deal", score: 0 },
    ]},
  ],
};

const tips = [
  '💡 Tip: The BEST responses show you understand how they feel!',
  '💡 Tip: Good friends listen first, then respond with kindness.',
  '💡 Tip: Offering help is often better than giving advice.',
  '💡 Tip: Sometimes people just need to know you care!',
  '💡 Tip: Avoid responses that blame or dismiss their feelings.',
];

type Phase = 'intro' | 'playing' | 'feedback' | 'done';

function EmpathyEngineGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const cycledStage = ((stage - 1) % 10) + 1;
  const scenarios = allScenarios[cycledStage] || allScenarios[1];
  const [phase, setPhase] = useState<Phase>('intro');
  const [score, setScore] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#4ade80');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);

  const endedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

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
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

  const handleOption = useCallback((optIdx: number) => {
    if (phase !== 'playing') return;
    const opt = scenarios[currentQ].options[optIdx];
    const points = opt.score * 10;
    setSelectedIdx(optIdx);
    setScore(s => s + points);
    onScore(points);
    setPhase('feedback');

    if (opt.score === 3) {
      setFeedback('💚 Perfect! You really showed you care!');
      setFeedbackColor('#4ade80');
    } else if (opt.score === 2) {
      setFeedback('💛 Good thought! There might be an even kinder way.');
      setFeedbackColor('#fbbf24');
    } else if (opt.score === 1) {
      setFeedback('🧡 Okay, but try to show more understanding.');
      setFeedbackColor('#fb923c');
    } else {
      setFeedback('💔 That might hurt their feelings.');
      setFeedbackColor('#ff6e6c');
    }

    schedule(() => {
      const next = currentQ + 1;
      if (next >= scenarios.length) {
        const finalScore = score + points;
        const avgScore = finalScore / scenarios.length;
        let stars: number;
        let summary: string;
        if (avgScore > 25) {
          stars = 3;
          summary = 'Empathy champion! You know exactly how to help friends feel better! Your kindness makes the world better! 💝';
        } else if (avgScore > 15) {
          stars = 2;
          summary = 'Good heart! You care about your friends. Keep practicing showing you understand how they feel!';
        } else {
          stars = 1;
          summary = 'Keep practicing! The best responses show you understand AND offer support. Try asking yourself: "How would I feel?"';
        }
        if (endedRef.current) return;
        endedRef.current = true;
        onEnd({ score: finalScore + 50, stars, summary });
      } else {
        setCurrentQ(next);
        setSelectedIdx(null);
        setFeedback('');
        setPhase('playing');
        onProgress(next / scenarios.length);
      }
    }, 1200);
  }, [phase, currentQ, scenarios, score, onScore, onProgress, onEnd, schedule]);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-5 text-center">
        <GameArt gameId="empathy-engine" emoji="💝" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-[#f472b6] mb-2">Empathy Engine</h2>
        <p className="text-[#fb7185] mb-4 max-w-xs">Choose the most helpful response for your friends!</p>
        <div className="bg-[#1a332e] rounded-xl p-4 mb-5 max-w-xs">
          <div className="text-[#67e8f9] mb-2">{scenarios.length} friends need your help!</div>
          <div className="flex gap-1.5 justify-center flex-wrap">
            {scenarios.map((s, i) => (
              <span key={i} className="text-2xl">{s.emoji}</span>
            ))}
          </div>
        </div>
        <div className="bg-[#1a1833] rounded-lg p-2.5 mb-4 max-w-xs">
          <div className="text-[#4ade80] text-sm">Pick responses that show you UNDERSTAND and CARE! 💚</div>
        </div>
        <p className="text-[#67e8f9] text-sm mb-5 max-w-xs">{tip}</p>
        <button
          onClick={() => setPhase('playing')}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Help Friends! 💝
        </button>
      </div>
    );
  }

  const s = scenarios[currentQ];

  return (
    <div className="flex flex-col h-full min-h-[350px] items-center justify-center p-4">
      <div className="flex gap-4 px-4 py-2 bg-[#1a332e] rounded-xl mb-3">
        <span className="text-[#f472b6] font-bold">Friend {currentQ + 1}/{scenarios.length}</span>
        <span className="text-[#c084fc]">Score: {score}</span>
      </div>
      <div className="text-5xl mb-1">{s.emoji}</div>
      <div className="text-[#f472b6] text-base mb-2">{s.friend}</div>
      <div className="bg-[#1a332e] p-3.5 px-4 rounded-xl text-center text-white text-[0.95rem] max-w-xs leading-snug mb-2.5">
        {s.situation}
      </div>
      <div className="text-[#67e8f9] text-sm mb-2.5">What would you say?</div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {s.options.map((opt, optIdx) => {
          let bg = '#1a332e';
          let border = '#c084fc';
          if (phase === 'feedback' && selectedIdx === optIdx) {
            if (opt.score === 3) { bg = '#4ade80'; border = '#4ade80'; }
            else if (opt.score === 2) { bg = '#fbbf24'; border = '#fbbf24'; }
            else if (opt.score === 1) { bg = '#fb923c'; border = '#fb923c'; }
            else { bg = '#ff6e6c'; border = '#ff6e6c'; }
          }
          return (
            <button
              key={optIdx}
              onPointerDown={() => handleOption(optIdx)}
              disabled={phase !== 'playing'}
              className="border-2 text-white p-3 rounded-lg text-sm text-left transition-all"
              style={{ background: bg, borderColor: border, opacity: phase !== 'playing' && selectedIdx !== optIdx ? 0.5 : 1 }}
            >
              &quot;{opt.text}&quot;
            </button>
          );
        })}
      </div>
      {feedback && (
        <div className="text-base min-h-[26px] mt-2.5 text-center max-w-xs" style={{ color: feedbackColor }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

export default EmpathyEngineGame;
