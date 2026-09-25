// Offline start screen: rules, bonus-square key and the lexicon picker.
// Start stays disabled until the chosen dictionary has downloaded.
import type { ReactNode } from 'react';
import { DICTIONARIES, type DictStatus, type DictVariant } from './dictionary';

interface StartScreenProps {
  /** One-line pitch under the title (differs for vs-AI and pass & play). */
  intro: ReactNode;
  dictVariant: DictVariant;
  dictStatus: DictStatus;
  onChooseDictionary: (v: DictVariant) => void;
  onUseFallback: () => void;
  onStart: () => void;
}

const BONUS_KEY = [
  { label: 'TW', color: 'bg-red-700', desc: 'Triple Word' },
  { label: 'DW', color: 'bg-rose-500', desc: 'Double Word' },
  { label: 'TL', color: 'bg-blue-600', desc: 'Triple Letter' },
  { label: 'DL', color: 'bg-sky-500', desc: 'Double Letter' },
];

export function StartScreen({ intro, dictVariant, dictStatus, onChooseDictionary, onUseFallback, onStart }: StartScreenProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-4 overflow-y-auto">
      <div className="text-5xl">🅰️</div>
      <h2 className="text-2xl font-bold">Scrabble</h2>
      <p className="text-text-muted text-sm text-center max-w-xs">{intro}</p>
      <HowToPlay />
      <DictionaryPicker value={dictVariant} onChoose={onChooseDictionary} />

      {dictStatus === 'error' ? (
        <div className="w-full max-w-xs bg-danger/10 border border-danger/30 rounded-xl p-3 text-center space-y-2">
          <p className="text-xs text-text-muted">Couldn't download the dictionary — check your connection.</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => onChooseDictionary(dictVariant)}
              className="bg-accent text-bg font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90 active:scale-95"
            >
              Retry
            </button>
            <button
              onClick={onUseFallback}
              title="A small built-in word list — many valid words will be rejected"
              className="bg-card hover:bg-card-hover text-text-muted font-semibold px-4 py-2 rounded-xl text-sm"
            >
              Use basic list
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onStart}
          disabled={dictStatus === 'loading'}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
        >
          {dictStatus === 'loading' ? 'Loading dictionary…' : 'Start Game'}
        </button>
      )}
      {dictStatus === 'fallback' && (
        <p className="text-[10px] text-warning text-center max-w-xs">
          Playing with the basic built-in list — some valid words may be rejected.
        </p>
      )}
    </div>
  );
}

function HowToPlay() {
  return (
    <div className="w-full max-w-xs bg-card rounded-2xl p-4 flex flex-col gap-2 ring-1 ring-white/10">
      <span className="text-xs font-bold text-text-muted uppercase tracking-wide">How to play</span>
      <div className="flex flex-col gap-1.5 text-xs text-text-muted">
        <div className="flex items-start gap-2">
          <span className="text-amber-400 font-bold text-base leading-none mt-0.5">★</span>
          <span>First word must cross the <span className="text-text font-semibold">center star</span></span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-base leading-none mt-0.5">🔗</span>
          <span>Every word after must <span className="text-text font-semibold">connect</span> to an existing tile</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-base leading-none mt-0.5">🎯</span>
          <span>Use all 7 tiles in one move for a <span className="text-text font-semibold">+50 Bingo bonus!</span></span>
        </div>
      </div>
      <div className="border-t border-white/10 pt-2 mt-1">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide block mb-1.5">Bonus squares</span>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {BONUS_KEY.map(b => (
            <div key={b.label} className="flex items-center gap-1.5">
              <span className={`${b.color} text-white font-bold rounded px-1 py-0.5 text-[9px] min-w-[22px] text-center`}>{b.label}</span>
              <span className="text-text-muted">{b.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DictionaryPicker({ value, onChoose }: { value: DictVariant; onChoose: (v: DictVariant) => void }) {
  return (
    <div className="w-full max-w-xs" role="radiogroup" aria-label="Dictionary">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide block mb-1.5">Dictionary</span>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(DICTIONARIES) as DictVariant[]).map(v => (
          <button
            key={v}
            onClick={() => onChoose(v)}
            role="radio"
            aria-checked={value === v}
            title={DICTIONARIES[v].blurb}
            className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              value === v ? 'bg-accent-soft ring-1 ring-accent text-text' : 'bg-card hover:bg-card-hover text-text-muted'
            }`}
          >
            <span className="text-base" aria-hidden>{DICTIONARIES[v].flag}</span>
            {DICTIONARIES[v].label}
          </button>
        ))}
      </div>
    </div>
  );
}
