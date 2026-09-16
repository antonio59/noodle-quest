import { useNavigate } from 'react-router-dom';
import { getAllGames } from '@/lib/game-registry';
import {
  Brain,
  Gamepad2,
  Wind,
  Music,
  ChevronRight,
} from 'lucide-react';

const HIGHLIGHTS = [
  { icon: Brain, title: 'Brain games', desc: 'Focus, memory, and quick thinking — short rounds that feel like play.' },
  { icon: Gamepad2, title: 'Board night', desc: 'Chess, Scrabble, UNO, and more. Solo vs AI or invite the family.' },
  { icon: Wind, title: 'Breathe', desc: 'Guided calm in a few minutes when the day gets loud.' },
  { icon: Music, title: 'Soundscapes', desc: 'Lo-fi, nature, and focus tracks that keep playing while you game.' },
];

export function Landing() {
  const navigate = useNavigate();
  const gameCount = getAllGames().length;

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero — brand first, one job */}
      <section className="relative min-h-[88dvh] flex flex-col items-center justify-center px-6 pt-8 pb-10 text-center overflow-hidden">
        <div className="nq-hero-bowl" aria-hidden />
        <div className="relative z-10 flex flex-col items-center max-w-md mx-auto">
          <div className="relative mb-6">
            <span className="text-8xl leading-none select-none" aria-hidden>🍜</span>
            <span
              className="absolute left-1/2 -top-2 w-3 h-3 rounded-full bg-accent/40 animate-[steam_2.4s_ease-out_infinite]"
              style={{ marginLeft: '-18px' }}
              aria-hidden
            />
            <span
              className="absolute left-1/2 -top-1 w-2.5 h-2.5 rounded-full bg-primary/35 animate-[steam_2.8s_ease-out_0.6s_infinite]"
              style={{ marginLeft: '6px' }}
              aria-hidden
            />
            <span
              className="absolute left-1/2 -top-3 w-2 h-2 rounded-full bg-accent/30 animate-[steam_3.2s_ease-out_1.1s_infinite]"
              style={{ marginLeft: '-2px' }}
              aria-hidden
            />
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-text tracking-tight mb-3">
            Noodle Quest
          </h1>
          <p className="text-text-dim text-lg sm:text-xl font-semibold mb-8 leading-snug">
            Family games for bright minds and calm evenings.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate('/auth')}
              className="bg-accent text-bg font-bold px-8 py-3.5 rounded-2xl text-lg hover:brightness-110 transition-all active:scale-[0.98]"
            >
              Start playing
            </button>
            <button
              onClick={() => navigate('/qa/play/memory-match')}
              className="bg-card border border-white/10 text-text font-semibold px-8 py-3.5 rounded-2xl text-lg hover:bg-card-hover transition-all active:scale-[0.98]"
            >
              Try a game
            </button>
          </div>
          <p className="text-text-muted text-sm font-semibold mt-6 tracking-wide">
            {gameCount} games · no email · shared tablet friendly
          </p>
        </div>
      </section>

      {/* Marquee of games */}
      <div className="pb-12 space-y-2 overflow-hidden select-none" aria-hidden>
        {[0, 1].map(row => {
          const all = getAllGames().map(g => g.emoji);
          const half = Math.ceil(all.length / 2);
          const emojis = row === 0 ? all.slice(0, half) : all.slice(half);
          return (
            <div
              key={row}
              className="flex w-max"
              style={{ animation: `marquee ${emojis.length * 3.2}s linear infinite${row === 1 ? ' reverse' : ''}` }}
            >
              {[...emojis, ...emojis].map((e, i) => (
                <span
                  key={i}
                  className="flex items-center justify-center w-12 h-12 mx-1 text-2xl bg-card/80 border border-white/5 rounded-2xl flex-shrink-0"
                >
                  {e}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* What's inside — one job */}
      <section className="px-5 pb-14 max-w-2xl mx-auto">
        <h2 className="font-display text-2xl font-bold text-text text-center mb-2">What&apos;s in the bowl</h2>
        <p className="text-text-muted text-sm text-center mb-8 max-w-sm mx-auto">
          Pick a game, earn stars, challenge someone at home — or just breathe for a minute.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="rounded-2xl p-5 bg-card/70 border border-white/5">
              <item.icon size={22} className="text-accent mb-3" />
              <h3 className="font-display text-lg font-semibold text-text mb-1">{item.title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why play — the pitch to grown-ups */}
      <section className="px-5 pb-14 max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/why-play')}
          className="w-full text-left rounded-2xl bg-card/70 border border-white/5 hover:border-accent/30 p-6 transition group"
        >
          <p className="text-[11px] font-bold text-accent uppercase tracking-widest mb-2">For the grown-ups</p>
          <p className="font-display text-xl font-bold text-text leading-snug mb-2">
            Games are the active kind of screen time.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            What research says about play vs. the endless scroll — working memory, planning, calm, and why the dose matters. Sources named, claims honest.
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-accent">
            Read why it works <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" aria-hidden />
          </span>
        </button>
      </section>

      {/* How it works */}
      <section className="px-5 pb-14 max-w-md mx-auto">
        <h2 className="font-display text-2xl font-bold text-text text-center mb-8">Three steps</h2>
        <ol className="space-y-6">
          {[
            { n: '1', title: 'Pick who\'s playing', desc: 'Name, avatar, and a 6-digit passcode. No email.' },
            { n: '2', title: 'Jump into a game', desc: 'Brain training, board games, or a quick breathe.' },
            { n: '3', title: 'Play together', desc: 'Challenge siblings, keep a ranking, chat at home.' },
          ].map((s) => (
            <li key={s.n} className="flex gap-4 items-start">
              <span className="w-9 h-9 rounded-full bg-primary/20 text-primary font-display font-bold flex items-center justify-center flex-shrink-0">
                {s.n}
              </span>
              <div>
                <div className="font-semibold text-text">{s.title}</div>
                <div className="text-text-muted text-sm mt-0.5 leading-relaxed">{s.desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA */}
      <section className="px-5 pb-16 text-center">
        <div className="max-w-sm mx-auto">
          <p className="font-display text-2xl font-bold text-text mb-2">Ready when you are</p>
          <p className="text-text-muted text-sm mb-6">
            One shared tablet. Everyone gets their own bowl.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-2 bg-accent text-bg font-bold px-8 py-3.5 rounded-2xl text-lg hover:brightness-110 transition-all active:scale-[0.98]"
          >
            Start playing
            <ChevronRight size={20} />
          </button>
        </div>
      </section>
    </div>
  );
}
