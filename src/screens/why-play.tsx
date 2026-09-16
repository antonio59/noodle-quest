import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, Gamepad2, Smartphone } from 'lucide-react';
import { BRAIN_FOOD } from '@/data/brain-food';
import { useAuth } from '@/contexts/AuthContext';
import { GAME_CATEGORIES } from '@/types';

const CAT_LABEL = new Map(GAME_CATEGORIES.map(c => [c.id, `${c.emoji} ${c.label}`]));

export function WhyPlay() {
  const navigate = useNavigate();
  const { player } = useAuth();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 pt-4 pb-2 sticky top-0 bg-bg/90 backdrop-blur-sm z-10">
          <button
            onClick={() => navigate(player ? '/' : '/welcome')}
            aria-label="Back"
            className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center text-text-muted hover:text-text transition-colors flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl font-bold text-text">Why play?</h1>
        </div>

        {/* Hero: play vs. scroll */}
        <section className="rounded-3xl border border-white/8 bg-card/70 p-6 mt-2 mb-8">
          <p className="text-text text-lg font-bold leading-snug mb-4 text-balance">
            Not all screen time is the same.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface/80 border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-2 text-text-muted">
                <Smartphone size={16} aria-hidden />
                <span className="text-xs font-bold uppercase tracking-wide">Doomscrolling</span>
              </div>
              <ul className="text-sm text-text-muted space-y-1.5 leading-relaxed">
                <li>• Watches you back</li>
                <li>• Never ends on purpose</li>
                <li>• Your brain idles</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-accent/10 border border-accent/25 p-4">
              <div className="flex items-center gap-2 mb-2 text-accent">
                <Gamepad2 size={16} aria-hidden />
                <span className="text-xs font-bold uppercase tracking-wide">Playing games</span>
              </div>
              <ul className="text-sm text-text space-y-1.5 leading-relaxed">
                <li>• You make the moves</li>
                <li>• Rounds end; you choose to replay</li>
                <li>• Memory, planning, and calm get a workout</li>
              </ul>
            </div>
          </div>
          <p className="text-text-muted text-xs mt-4 leading-relaxed">
            Researchers call this the difference between <em className="text-text-dim not-italic font-semibold">passive</em> and
            <em className="text-text-dim not-italic font-semibold"> active</em> screen time. Below is what the science
            actually says — in plain words, with the sources named so you can check.
          </p>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          {BRAIN_FOOD.map(card => (
            <article
              key={card.id}
              className="rounded-2xl bg-card border border-white/5 p-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center text-2xl flex-shrink-0" aria-hidden>
                  {card.emoji}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-text text-base leading-tight mb-1">{card.title}</h2>
                  <p className="text-accent text-sm font-semibold leading-snug mb-2 text-pretty">{card.takeaway}</p>
                  <p className="text-text-muted text-sm leading-relaxed mb-3">{card.body}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {card.categories.map(c => (
                      <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-text-muted">
                        {CAT_LABEL.get(c) ?? c}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-text-muted/80 mt-2.5 italic">{card.source}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* CTA */}
        <section className="text-center mt-10">
          <p className="font-display text-xl font-bold text-text mb-2">Brains like reps, not lectures</p>
          <p className="text-text-muted text-sm mb-5">Ten minutes of the right game beats an hour of the wrong feed.</p>
          <button
            onClick={() => navigate(player ? '/games' : '/auth')}
            className="inline-flex items-center gap-2 bg-accent text-bg font-bold px-8 py-3.5 rounded-2xl text-lg hover:brightness-110 transition active:scale-[0.98]"
          >
            <Brain size={20} aria-hidden />
            {player ? 'Pick a game' : 'Start playing'}
          </button>
        </section>
      </div>
    </div>
  );
}
