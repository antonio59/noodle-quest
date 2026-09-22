import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '@/types';
import { EN_GB_CORE_WORDS } from '@/data/words/en-gb-core';
import { Sparkles, Trash2, Check } from 'lucide-react';

/**
 * Bookworm: click adjacent letter tiles to spell words.
 * Letters fall from above like Tetris; used tiles disappear and new tiles drop in.
 */

const COLS = 7;
const ROWS = 7;

// Approximate Scrabble-style letter frequency so boards feel playable.
const LETTER_BAG = (
  'EEEEEEEEEEEEAAAAAAAAIIIIIIIIINNNNNNNOOOOOOOOORRRRRRTTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ'
).split('');

// Qu is rare but signature; render as a combined "Qu" tile occasionally.
function rollLetter(rng: () => number): string {
  const r = rng();
  if (r < 0.015) return 'Qu';
  return LETTER_BAG[Math.floor(rng() * LETTER_BAG.length)];
}

interface Cell {
  id: number;
  letter: string;
}

interface StageCfg {
  target: number;
  timeLimitSec: number;
  label: string;
}

function cfgFor(stage: number): StageCfg {
  // Target score ramps; time stays generous at early stages.
  const base = 80;
  const target = base + (stage - 1) * 60;
  const timeLimitSec = Math.max(60, 180 - (stage - 1) * 8);
  return { target, timeLimitSec, label: `Stage ${stage}` };
}

// Build a lowercased Set of valid dictionary words (2–12 letters).
// Exported for tests — bookworm-timeout.test.tsx finds a real word on the board.
export const DICTIONARY: Set<string> = (() => {
  const s = new Set<string>();
  for (const w of EN_GB_CORE_WORDS) {
    if (w.tags.includes('proper-noun')) continue;
    const a = (w.answer || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (a.length >= 3 && a.length <= 12) s.add(a);
  }
  // Common short words that might not be in crossword dictionary.
  const extras = [
    'CAT','DOG','RUN','SUN','HAT','HOT','TOP','POP','POT','TOE','TIE','PIE',
    'EAR','EAT','ATE','TEA','TEN','NET','ONE','OWL','OUR','OUT',
    'ARE','AGE','ARM','BAT','BAD','BAG','BED','BIG','BIT','BOX','BOY',
    'CAB','CAN','CAR','COW','CRY','CUP','CUT','DAY','DID','DIG','DUE',
    'EAR','EAT','EGG','END','EYE','FAR','FAT','FEW','FIT','FLY','FUN',
    'GAP','GAS','GET','GOD','GOT','HEY','HIM','HIT','ICE','JOB',
    'JUG','KEY','KID','LAP','LAW','LEG','LID','LIE','LIP','LOG','LOT',
    'MAN','MAP','MAT','MIX','MOB','MOM','NEW','NOD','NOT','NOW','NUT',
    'OAK','OAT','ODD','OFF','OIL','OLD','OWL','OWN','PAD','PAL','PAN',
    'PAT','PAY','PEA','PEN','PIG','PIN','POT','PUN','RAG','RAN','RAT',
    'RAW','RED','RIB','RID','RIM','ROB','ROD','ROT','ROW','RUB','RUG',
    'RUN','SAD','SAT','SAY','SEA','SEE','SET','SHE','SHY','SIR','SIT',
    'SIX','SKI','SKY','SLY','SOB','SON','SPA','SPY','SUN','TAG','TAN',
    'TAP','TAR','TAX','TEA','TEN','THE','TIE','TIN','TIP','TOE','TON',
    'TOP','TOW','TOY','TRY','TUB','TWO','URN','USE','VAN','VET','VIA',
    'WAS','WAY','WEB','WED','WET','WHO','WHY','WIN','WIT','WOE',
    'WON','YAK','YAM','YAP','YEN','YES','YET','YEW','YOU','ZIP','ZOO',
    'ABLE','ACID','AGED','ALSO','AREA','ARMY','AWAY','BABY','BACK','BALL','BAND','BANK','BASE','BATH','BEAR','BEAT','BEEN','BELL','BELT','BEST','BILL','BIRD','BLOW','BLUE','BOAT','BODY','BOND','BONE','BOOK','BOOM','BORN','BOSS','BOTH','BOWL','BULK','BURN','BUSH','BUSY','CALL','CALM','CAME','CAMP','CARD','CARE','CASE','CASH','CAST','CELL','CHAT','CHEF','CHIP','CITY','CLUB','COAL','COAT','CODE','COLD','COME','COOK','COOL','COPE','COPY','CORE','COST','CREW','CROP','DARK','DATA','DATE','DAWN','DAYS','DEAL','DEAN','DEAR','DEBT','DEEP','DENY','DESK','DIAL','DIET','DISC','DISK','DOES','DONE','DOWN','DRAW','DREW','DROP','DUAL','DUKE','DUST','DUTY','EACH','EARN','EASE','EAST','EASY','EDGE','ELSE','EVEN','EVER','EXIT','FACE','FACT','FAIL','FAIR','FALL','FARM','FAST','FATE','FEAR','FEED','FEEL','FEET','FELL','FELT','FILE','FILL','FILM','FIND','FINE','FIRE','FIRM','FISH','FIVE','FLAT','FLOW','FOOD','FOOT','FORD','FORM','FORT','FOUR','FREE','FROM','FUEL','FULL','FUND','GAIN','GAME','GATE','GAVE','GEAR','GENE','GIFT','GIRL','GIVE','GLAD','GOAL','GOES','GOLD','GOLF','GONE','GOOD','GRAY','GREW','GREY','GROW','GULF','HAIR','HALF','HALL','HAND','HANG','HARD','HARM','HATE','HAVE','HEAD','HEAR','HEAT','HELD','HELP','HERE','HERO','HIGH','HILL','HIRE','HOLD','HOLE','HOLY','HOME','HOPE','HOST','HOUR','HUGE','HUNT','HURT','IDEA','INCH','INTO','IRON','ITEM','JACK','JEAN','JOIN','JUMP','JURY','JUST','KEEN','KEEP','KEPT','KICK','KIND','KING','KNEE','KNEW','KNOW','LACK','LADY','LAID','LAKE','LAND','LANE','LAST','LATE','LEAD','LEFT','LESS','LIFE','LIFT','LIKE','LINE','LINK','LIST','LIVE','LOAD','LOAN','LOCK','LOGO','LONG','LOOK','LORD','LOSE','LOSS','LOST','LOVE','LUCK','MADE','MAIL','MAIN','MAKE','MALE','MANY','MARK','MASS','MEAL','MEAN','MEAT','MEET','MENU','MERE','MILE','MILK','MILL','MIND','MINE','MISS','MODE','MOOD','MOON','MORE','MOST','MOVE','MUCH','MUST','NAME','NAVY','NEAR','NECK','NEED','NEWS','NEXT','NICE','NICK','NINE','NONE','NOSE','NOTE','OKAY','ONCE','ONLY','ONTO','OPEN','ORAL','OVER','PACE','PACK','PAGE','PAID','PAIN','PAIR','PALM','PARK','PART','PASS','PAST','PATH','PEAK','PICK','PINE','PINK','PIPE','PLAN','PLAY','PLOT','PLUG','PLUS','POEM','POET','POLL','POOL','POOR','PORT','POST','POUR','PRAY','PREP','PULL','PURE','PUSH','RACE','RAIL','RAIN','RANK','RARE','RATE','READ','REAL','REAR','RELY','RENT','REST','RICE','RICH','RIDE','RING','RISE','RISK','ROAD','ROCK','ROLE','ROLL','ROOF','ROOM','ROOT','ROSE','RULE','RUSH','SAFE','SAID','SALE','SALT','SAME','SAND','SAVE','SEAT','SEED','SEEK','SEEM','SEEN','SELF','SELL','SEND','SENT','SHIP','SHOP','SHOT','SHOW','SICK','SIDE','SIGN','SITE','SIZE','SKIN','SLIP','SLOW','SNOW','SOFT','SOIL','SOLD','SOLE','SOME','SONG','SOON','SORT','SOUL','SPOT','STAR','STAY','STEP','STIR','STOP','SUCH','SUIT','SURE','TAKE','TALE','TALK','TALL','TANK','TAPE','TASK','TEAM','TELL','TEND','TERM','TEST','TEXT','THAN','THAT','THEM','THEN','THEY','THIN','THIS','THUS','TIDE','TIED','TIES','TILE','TIME','TINY','TIRE','TOLD','TOLL','TONE','TOOK','TOOL','TOPS','TORE','TORN','TOUR','TOWN','TREE','TRIP','TRUE','TUBE','TUNE','TURN','TWIN','TYPE','UGLY','UNIT','UPON','USED','USER','VAIN','VARY','VAST','VERY','VIEW','VOTE','WAGE','WAIT','WAKE','WALK','WALL','WANT','WARD','WARM','WARN','WASH','WAVE','WEAK','WEAR','WEEK','WELL','WENT','WERE','WEST','WHAT','WHEN','WHOM','WIDE','WIFE','WILD','WILL','WIND','WING','WIRE','WISE','WISH','WITH','WOOD','WORD','WORE','WORK','YARD','YEAH','YEAR','YOUR','ZERO','ZONE',
  ];
  for (const e of extras) s.add(e.toUpperCase());
  return s;
})();

function letterValue(l: string): number {
  if (l === 'Qu') return 10;
  const u = l.toUpperCase();
  if ('EAIONRTLSU'.includes(u)) return 1;
  if ('DG'.includes(u)) return 2;
  if ('BCMP'.includes(u)) return 3;
  if ('FHVWY'.includes(u)) return 4;
  if (u === 'K') return 5;
  if ('JX'.includes(u)) return 8;
  if ('QZ'.includes(u)) return 10;
  return 1;
}

function scoreFor(letters: string[]): number {
  const base = letters.reduce((s, l) => s + letterValue(l), 0);
  const lengthBonus = Math.max(0, letters.length - 2) * 4;
  return base + lengthBonus;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBoard(seed: number): Cell[][] {
  const rng = mulberry32(seed);
  let id = 0;
  const board: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push({ id: id++, letter: rollLetter(rng) });
    }
    board.push(row);
  }
  return board;
}

export default function BookwormGame({ stage = 1, onScore, onProgress, onEnd, onMessage }: Partial<GameProps>) {
  const cfg = cfgFor(stage);
  const [ready, setReady] = useState(true);
  const [seed] = useState(() => Date.now());
  const idRef = useRef(ROWS * COLS);
  const [board, setBoard] = useState<Cell[][]>(() => buildBoard(seed));
  const [selection, setSelection] = useState<[number, number][]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [remainingMs, setRemainingMs] = useState(cfg.timeLimitSec * 1000);
  const [flash, setFlash] = useState<{ kind: 'good' | 'bad'; word: string } | null>(null);
  const endedRef = useRef(false);
  const scoreRef = useRef(0);
  useEffect(() => { scoreRef.current = totalScore; }, [totalScore]);

  // Timer — only starts once the player has left the intro screen
  useEffect(() => {
    if (ready) return;
    const start = Date.now();
    const total = cfg.timeLimitSec * 1000;
    const tick = () => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, total - elapsed);
      setRemainingMs(left);
      if (left <= 0) endGame();
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [ready]);

  const endGame = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    const target = cfg.target;
    const finalScore = scoreRef.current; // the timer closure's totalScore is stale
    const ratio = finalScore / target;
    const stars = ratio >= 1.2 ? 3 : ratio >= 1 ? 2 : ratio >= 0.5 ? 1 : 0;
    onEnd?.({
      score: finalScore,
      stars,
      summary: stars >= 2
        ? `Reached ${finalScore} points — target was ${target}`
        : `Made it to ${finalScore} of ${target}. Try again!`,
    });
  };

  // Report progress toward target.
  useEffect(() => {
    onProgress?.(Math.min(1, totalScore / cfg.target));
    if (totalScore >= cfg.target && !endedRef.current) {
      // Give a small grace period so the player can keep scoring within the time limit,
      // but mark the level as "won" — end after 1.5s of inactivity past target.
      const t = setTimeout(() => endGame(), 1500);
      return () => clearTimeout(t);
    }
  }, [totalScore, cfg.target]);

  const isAdjacent = (a: [number, number], b: [number, number]) => {
    const dr = Math.abs(a[0] - b[0]);
    const dc = Math.abs(a[1] - b[1]);
    return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
  };

  const toggleCell = (r: number, c: number) => {
    setSelection(prev => {
      // If already the last selected cell, deselect it.
      const last = prev[prev.length - 1];
      if (last && last[0] === r && last[1] === c) return prev.slice(0, -1);
      // If cell already somewhere in the chain, trim back to that cell.
      const idx = prev.findIndex(([rr, cc]) => rr === r && cc === c);
      if (idx >= 0) return prev.slice(0, idx + 1);
      // If chain empty, just start here.
      if (prev.length === 0) return [[r, c]];
      // Otherwise require adjacency to the last cell.
      if (!isAdjacent(last, [r, c])) return prev;
      return [...prev, [r, c]];
    });
  };

  const currentWord = selection.map(([r, c]) => board[r][c].letter).join('');
  const currentScore = scoreFor(selection.map(([r, c]) => board[r][c].letter));
  const isValid = currentWord.length >= 3 && DICTIONARY.has(currentWord.toUpperCase());

  const clearSelection = () => setSelection([]);

  const submit = () => {
    if (!isValid) {
      setFlash({ kind: 'bad', word: currentWord });
      onMessage?.(`"${currentWord}" is not a valid word`);
      setTimeout(() => setFlash(null), 800);
      setSelection([]);
      return;
    }
    const gained = currentScore;
    setFlash({ kind: 'good', word: currentWord });
    onMessage?.(`+${gained} for ${currentWord.toUpperCase()}`);
    onScore?.(gained);
    setTotalScore(s => s + gained);

    // Remove selected tiles and drop new ones in from the top.
    const picked = new Set(selection.map(([r, c]) => `${r},${c}`));
    setBoard(prev => {
      const next = prev.map(row => row.slice());
      for (let c = 0; c < COLS; c++) {
        // Collect surviving tiles for this column, from bottom up.
        const col: Cell[] = [];
        for (let r = ROWS - 1; r >= 0; r--) {
          if (!picked.has(`${r},${c}`)) col.push(next[r][c]);
        }
        // Refill missing cells from the top.
        const rng = mulberry32(Date.now() + c + selection.length);
        while (col.length < ROWS) {
          col.push({ id: idRef.current++, letter: rollLetter(rng) });
        }
        // Write back from bottom to top.
        for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) {
          next[r][c] = col[i];
        }
      }
      return next;
    });
    setSelection([]);
    setTimeout(() => setFlash(null), 600);
  };

  const selectedSet = useMemo(() => new Set(selection.map(([r, c]) => `${r},${c}`)), [selection]);

  if (ready) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="text-6xl">📚</div>
        <h2 className="text-2xl font-bold text-accent">Bookworm</h2>
        <div className="bg-card rounded-2xl p-4 max-w-xs w-full space-y-3 text-sm text-text-muted">
          <p>🔤 <span className="text-text">Tap adjacent letters</span> to spell words</p>
          <p>✅ <span className="text-text">3+ letters</span> make a valid word</p>
          <p>📏 <span className="text-text">Longer words</span> score more points!</p>
        </div>
        <div className="bg-surface rounded-xl px-4 py-3 max-w-xs w-full text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Target score</span>
            <span className="font-bold text-accent">{cfg.target} pts</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-text-muted">Time limit</span>
            <span className="font-bold text-text">{cfg.timeLimitSec}s</span>
          </div>
        </div>
        <button
          onClick={() => setReady(false)}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Reading! 📚
        </button>
      </div>
    );
  }

  const secs = Math.ceil(remainingMs / 1000);
  const timeColor = remainingMs < 15_000 ? 'text-danger' : 'text-text';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Status strip */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold">{totalScore}</span>
          <span className="text-text-muted">/ {cfg.target}</span>
          <span className={`ml-2 font-mono tabular-nums ${timeColor}`}>
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
          </span>
        </div>
        <button
          onClick={clearSelection}
          disabled={selection.length === 0}
          className="bg-card hover:bg-card-hover text-text px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40"
        >
          <Trash2 size={12} className="inline mr-1" /> Clear
        </button>
      </div>

      {/* Word tray */}
      <div className="mx-4 mb-2 bg-card rounded-xl p-3 flex items-center gap-3 min-h-[56px] flex-shrink-0">
        <div className="flex-1">
          <div className="text-xs text-text-muted mb-0.5">Your word</div>
          <div className={`font-bold text-lg tracking-wider uppercase ${
            flash?.kind === 'good' ? 'text-success' : flash?.kind === 'bad' ? 'text-danger' : 'text-text'
          }`}>
            {flash?.word || currentWord || <span className="text-text-muted font-normal text-sm">pick adjacent letters</span>}
          </div>
        </div>
        {selection.length > 0 && (
          <div className="text-right mr-2">
            <div className="text-[10px] text-text-muted">points</div>
            <div className={`font-bold ${isValid ? 'text-accent' : 'text-text-muted'}`}>{currentScore}</div>
          </div>
        )}
        <button
          onClick={submit}
          disabled={selection.length < 3}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
            isValid
              ? 'bg-success text-bg hover:opacity-90'
              : selection.length >= 3
                ? 'bg-danger/20 text-danger'
                : 'bg-card-hover text-text-muted cursor-not-allowed'
          }`}
        >
          <Check size={14} className="inline mr-1" /> Submit
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-3">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${COLS}, 2.5rem)` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isSelected = selectedSet.has(`${r},${c}`);
              const idx = selection.findIndex(([rr, cc]) => rr === r && cc === c);
              const isLast = idx === selection.length - 1 && idx >= 0;
              return (
                <button
                  key={cell.id}
                  onClick={() => toggleCell(r, c)}
                  className={`aspect-square rounded-md font-bold uppercase transition-all active:scale-95 relative ${
                    isSelected
                      ? isLast
                        ? 'bg-accent text-bg ring-2 ring-accent shadow-md'
                        : 'bg-accent/40 text-text'
                      : 'bg-gradient-to-b from-amber-100 to-amber-200 text-amber-900 hover:from-amber-50 hover:to-amber-100 shadow-sm'
                  }`}
                  style={{ fontSize: cell.letter.length > 1 ? '0.7rem' : '0.95rem' }}
                >
                  {cell.letter}
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 text-[9px] bg-accent text-bg rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="px-4 pb-3 text-center text-[11px] text-text-muted flex items-center justify-center gap-1 flex-shrink-0">
        <Sparkles size={11} /> Target: {cfg.target} points
      </div>
    </div>
  );
}
