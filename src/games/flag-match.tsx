import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { GameProps } from '@/types';

interface Country {
  code: string;
  name: string;
  flag: string;
  continent: string;
  capital: string;
}

const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States',       flag: '🇺🇸', continent: 'Americas', capital: 'Washington D.C.' },
  { code: 'GB', name: 'United Kingdom',       flag: '🇬🇧', continent: 'Europe',   capital: 'London'          },
  { code: 'CA', name: 'Canada',               flag: '🇨🇦', continent: 'Americas', capital: 'Ottawa'          },
  { code: 'AU', name: 'Australia',            flag: '🇦🇺', continent: 'Oceania',  capital: 'Canberra'        },
  { code: 'DE', name: 'Germany',              flag: '🇩🇪', continent: 'Europe',   capital: 'Berlin'          },
  { code: 'FR', name: 'France',               flag: '🇫🇷', continent: 'Europe',   capital: 'Paris'           },
  { code: 'IT', name: 'Italy',                flag: '🇮🇹', continent: 'Europe',   capital: 'Rome'            },
  { code: 'ES', name: 'Spain',                flag: '🇪🇸', continent: 'Europe',   capital: 'Madrid'          },
  { code: 'JP', name: 'Japan',                flag: '🇯🇵', continent: 'Asia',     capital: 'Tokyo'           },
  { code: 'CN', name: 'China',                flag: '🇨🇳', continent: 'Asia',     capital: 'Beijing'         },
  { code: 'KR', name: 'South Korea',          flag: '🇰🇷', continent: 'Asia',     capital: 'Seoul'           },
  { code: 'IN', name: 'India',                flag: '🇮🇳', continent: 'Asia',     capital: 'New Delhi'       },
  { code: 'BR', name: 'Brazil',               flag: '🇧🇷', continent: 'Americas', capital: 'Brasília'        },
  { code: 'MX', name: 'Mexico',               flag: '🇲🇽', continent: 'Americas', capital: 'Mexico City'     },
  { code: 'AR', name: 'Argentina',            flag: '🇦🇷', continent: 'Americas', capital: 'Buenos Aires'    },
  { code: 'RU', name: 'Russia',               flag: '🇷🇺', continent: 'Europe',   capital: 'Moscow'          },
  { code: 'NL', name: 'Netherlands',          flag: '🇳🇱', continent: 'Europe',   capital: 'Amsterdam'       },
  { code: 'SE', name: 'Sweden',               flag: '🇸🇪', continent: 'Europe',   capital: 'Stockholm'       },
  { code: 'NO', name: 'Norway',               flag: '🇳🇴', continent: 'Europe',   capital: 'Oslo'            },
  { code: 'DK', name: 'Denmark',              flag: '🇩🇰', continent: 'Europe',   capital: 'Copenhagen'      },
  { code: 'FI', name: 'Finland',              flag: '🇫🇮', continent: 'Europe',   capital: 'Helsinki'        },
  { code: 'PL', name: 'Poland',               flag: '🇵🇱', continent: 'Europe',   capital: 'Warsaw'          },
  { code: 'CH', name: 'Switzerland',          flag: '🇨🇭', continent: 'Europe',   capital: 'Bern'            },
  { code: 'AT', name: 'Austria',              flag: '🇦🇹', continent: 'Europe',   capital: 'Vienna'          },
  { code: 'BE', name: 'Belgium',              flag: '🇧🇪', continent: 'Europe',   capital: 'Brussels'        },
  { code: 'PT', name: 'Portugal',             flag: '🇵🇹', continent: 'Europe',   capital: 'Lisbon'          },
  { code: 'GR', name: 'Greece',               flag: '🇬🇷', continent: 'Europe',   capital: 'Athens'          },
  { code: 'IE', name: 'Ireland',              flag: '🇮🇪', continent: 'Europe',   capital: 'Dublin'          },
  { code: 'NZ', name: 'New Zealand',          flag: '🇳🇿', continent: 'Oceania',  capital: 'Wellington'      },
  { code: 'ZA', name: 'South Africa',         flag: '🇿🇦', continent: 'Africa',   capital: 'Pretoria'        },
  { code: 'EG', name: 'Egypt',                flag: '🇪🇬', continent: 'Africa',   capital: 'Cairo'           },
  { code: 'NG', name: 'Nigeria',              flag: '🇳🇬', continent: 'Africa',   capital: 'Abuja'           },
  { code: 'KE', name: 'Kenya',                flag: '🇰🇪', continent: 'Africa',   capital: 'Nairobi'         },
  { code: 'TH', name: 'Thailand',             flag: '🇹🇭', continent: 'Asia',     capital: 'Bangkok'         },
  { code: 'VN', name: 'Vietnam',              flag: '🇻🇳', continent: 'Asia',     capital: 'Hanoi'           },
  { code: 'ID', name: 'Indonesia',            flag: '🇮🇩', continent: 'Asia',     capital: 'Jakarta'         },
  { code: 'MY', name: 'Malaysia',             flag: '🇲🇾', continent: 'Asia',     capital: 'Kuala Lumpur'    },
  { code: 'PH', name: 'Philippines',          flag: '🇵🇭', continent: 'Asia',     capital: 'Manila'          },
  { code: 'SG', name: 'Singapore',            flag: '🇸🇬', continent: 'Asia',     capital: 'Singapore'       },
  { code: 'TR', name: 'Turkey',               flag: '🇹🇷', continent: 'Asia',     capital: 'Ankara'          },
  { code: 'SA', name: 'Saudi Arabia',         flag: '🇸🇦', continent: 'Asia',     capital: 'Riyadh'          },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', continent: 'Asia',     capital: 'Abu Dhabi'       },
  { code: 'IL', name: 'Israel',               flag: '🇮🇱', continent: 'Asia',     capital: 'Jerusalem'       },
  { code: 'PK', name: 'Pakistan',             flag: '🇵🇰', continent: 'Asia',     capital: 'Islamabad'       },
  { code: 'BD', name: 'Bangladesh',           flag: '🇧🇩', continent: 'Asia',     capital: 'Dhaka'           },
  { code: 'CO', name: 'Colombia',             flag: '🇨🇴', continent: 'Americas', capital: 'Bogotá'          },
  { code: 'CL', name: 'Chile',                flag: '🇨🇱', continent: 'Americas', capital: 'Santiago'        },
  { code: 'PE', name: 'Peru',                 flag: '🇵🇪', continent: 'Americas', capital: 'Lima'            },
  { code: 'VE', name: 'Venezuela',            flag: '🇻🇪', continent: 'Americas', capital: 'Caracas'         },
  { code: 'UA', name: 'Ukraine',              flag: '🇺🇦', continent: 'Europe',   capital: 'Kyiv'            },
  { code: 'RO', name: 'Romania',              flag: '🇷🇴', continent: 'Europe',   capital: 'Bucharest'       },
  { code: 'HU', name: 'Hungary',              flag: '🇭🇺', continent: 'Europe',   capital: 'Budapest'        },
  { code: 'CZ', name: 'Czech Republic',       flag: '🇨🇿', continent: 'Europe',   capital: 'Prague'          },
  { code: 'HR', name: 'Croatia',              flag: '🇭🇷', continent: 'Europe',   capital: 'Zagreb'          },
  { code: 'RS', name: 'Serbia',               flag: '🇷🇸', continent: 'Europe',   capital: 'Belgrade'        },
  { code: 'BG', name: 'Bulgaria',             flag: '🇧🇬', continent: 'Europe',   capital: 'Sofia'           },
  { code: 'SK', name: 'Slovakia',             flag: '🇸🇰', continent: 'Europe',   capital: 'Bratislava'      },
  { code: 'SI', name: 'Slovenia',             flag: '🇸🇮', continent: 'Europe',   capital: 'Ljubljana'       },
  { code: 'LT', name: 'Lithuania',            flag: '🇱🇹', continent: 'Europe',   capital: 'Vilnius'         },
  { code: 'LV', name: 'Latvia',               flag: '🇱🇻', continent: 'Europe',   capital: 'Riga'            },
  { code: 'EE', name: 'Estonia',              flag: '🇪🇪', continent: 'Europe',   capital: 'Tallinn'         },
  { code: 'IS', name: 'Iceland',              flag: '🇮🇸', continent: 'Europe',   capital: 'Reykjavik'       },
  { code: 'MA', name: 'Morocco',              flag: '🇲🇦', continent: 'Africa',   capital: 'Rabat'           },
  { code: 'TN', name: 'Tunisia',              flag: '🇹🇳', continent: 'Africa',   capital: 'Tunis'           },
  { code: 'GH', name: 'Ghana',                flag: '🇬🇭', continent: 'Africa',   capital: 'Accra'           },
  { code: 'ET', name: 'Ethiopia',             flag: '🇪🇹', continent: 'Africa',   capital: 'Addis Ababa'     },
  { code: 'TZ', name: 'Tanzania',             flag: '🇹🇿', continent: 'Africa',   capital: 'Dodoma'          },
  { code: 'UG', name: 'Uganda',               flag: '🇺🇬', continent: 'Africa',   capital: 'Kampala'         },
  { code: 'TW', name: 'Taiwan',               flag: '🇹🇼', continent: 'Asia',     capital: 'Taipei'          },
  { code: 'NP', name: 'Nepal',                flag: '🇳🇵', continent: 'Asia',     capital: 'Kathmandu'       },
  { code: 'LK', name: 'Sri Lanka',            flag: '🇱🇰', continent: 'Asia',     capital: 'Sri Jayawardenepura Kotte' },
  { code: 'MM', name: 'Myanmar',              flag: '🇲🇲', continent: 'Asia',     capital: 'Naypyidaw'       },
  { code: 'KH', name: 'Cambodia',             flag: '🇰🇭', continent: 'Asia',     capital: 'Phnom Penh'      },
  { code: 'QA', name: 'Qatar',                flag: '🇶🇦', continent: 'Asia',     capital: 'Doha'            },
  { code: 'KW', name: 'Kuwait',               flag: '🇰🇼', continent: 'Asia',     capital: 'Kuwait City'     },
  { code: 'JO', name: 'Jordan',               flag: '🇯🇴', continent: 'Asia',     capital: 'Amman'           },
  { code: 'UZ', name: 'Uzbekistan',           flag: '🇺🇿', continent: 'Asia',     capital: 'Tashkent'        },
  { code: 'KZ', name: 'Kazakhstan',           flag: '🇰🇿', continent: 'Asia',     capital: 'Astana'          },
  { code: 'GE', name: 'Georgia',              flag: '🇬🇪', continent: 'Asia',     capital: 'Tbilisi'         },
];

const BEGINNER_CODES = [
  'US','GB','CA','AU','FR','DE','IT','ES','JP','CN','BR','IN','MX','KR','ZA',
  'RU','SE','CH','GR','IE','NZ','NG','TH','SG','TR','AR',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Most visually confusable flag per country (Jev content audit) — preferred
// wrong options teach kids to actually look at the flags.
const CONFUSABLE: Record<string, string> = {
  'Argentina': 'Brazil',          'Australia': 'New Zealand',    'Austria': 'Germany',
  'Bangladesh': 'Pakistan',       'Belgium': 'Germany',          'Brazil': 'Mexico',
  'Bulgaria': 'Russia',           'Cambodia': 'Thailand',        'Canada': 'Finland',
  'Chile': 'United States',       'China': 'Vietnam',            'Colombia': 'Venezuela',
  'Croatia': 'Hungary',           'Czech Republic': 'Slovakia',  'Denmark': 'Norway',
  'Egypt': 'United Arab Emirates','Estonia': 'Iceland',          'Ethiopia': 'Kenya',
  'Finland': 'Iceland',           'France': 'Ireland',           'Georgia': 'Switzerland',
  'Germany': 'Netherlands',       'Ghana': 'Ethiopia',           'Greece': 'Finland',
  'Hungary': 'Russia',            'Iceland': 'Finland',          'India': 'Pakistan',
  'Indonesia': 'Netherlands',     'Ireland': 'France',           'Israel': 'Jordan',
  'Italy': 'France',              'Japan': 'Indonesia',          'Jordan': 'Kuwait',
  'Kazakhstan': 'Uzbekistan',     'Kenya': 'Uganda',             'Kuwait': 'Qatar',
  'Latvia': 'Estonia',            'Lithuania': 'Latvia',         'Malaysia': 'Singapore',
  'Mexico': 'Italy',              'Morocco': 'Tunisia',          'Myanmar': 'Thailand',
  'Nepal': 'Sri Lanka',           'Netherlands': 'Indonesia',    'New Zealand': 'Australia',
  'Nigeria': 'Indonesia',         'Norway': 'Sweden',            'Pakistan': 'Bangladesh',
  'Peru': 'Colombia',             'Philippines': 'Singapore',    'Poland': 'Indonesia',
  'Portugal': 'Belgium',          'Qatar': 'Kuwait',             'Romania': 'Bulgaria',
  'Russia': 'Netherlands',        'Saudi Arabia': 'United Arab Emirates', 'Serbia': 'Russia',
  'Singapore': 'Malaysia',        'Slovakia': 'Czech Republic',  'Slovenia': 'Slovakia',
  'South Africa': 'Netherlands',  'South Korea': 'Japan',        'Spain': 'Italy',
  'Sri Lanka': 'Myanmar',         'Sweden': 'Denmark',           'Switzerland': 'Austria',
  'Taiwan': 'China',              'Tanzania': 'Uganda',          'Thailand': 'Netherlands',
  'Tunisia': 'Turkey',            'Turkey': 'Malaysia',          'Uganda': 'Tanzania',
  'Ukraine': 'Bulgaria',          'United Arab Emirates': 'Qatar','United Kingdom': 'New Zealand',
  'United States': 'Australia',   'Uzbekistan': 'Kazakhstan',    'Venezuela': 'Colombia',
  'Vietnam': 'China',
};

function pickWrongOptions(correct: Country, pool: Country[], count: number): Country[] {
  const confusable = CONFUSABLE[correct.name]
    ? pool.find(c => c.name === CONFUSABLE[correct.name])
    : undefined;
  const rest = pool.filter(c => c.code !== correct.code && c !== confusable);
  const sameContinent = rest.filter(c => c.continent === correct.continent);
  const other         = rest.filter(c => c.continent !== correct.continent);
  const candidates    = [...(confusable ? [confusable] : []), ...shuffle(sameContinent), ...shuffle(other)];
  return candidates.slice(0, count);
}

interface Question {
  correct: Country;
  options: Country[];
}

function buildQuestions(pool: Country[], count: number): Question[] {
  const flagPool = shuffle(pool).slice(0, count);
  return flagPool.map(correct => {
    const wrong   = pickWrongOptions(correct, pool, 3);
    const options = shuffle([correct, ...wrong]);
    return { correct, options };
  });
}

type AnswerState = { chosen: string; correct: boolean } | null;

export default function FlagGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const TOTAL_Q = Math.min(10 + Math.floor(stage / 2) * 2, 20);

  const pool = useMemo(() => {
    if (stage <= 2) return COUNTRIES.filter(c => BEGINNER_CODES.includes(c.code));
    if (stage <= 5) return COUNTRIES.slice(0, 50);
    return COUNTRIES;
  }, [stage]);

  const questions = useMemo(() => buildQuestions(pool, TOTAL_Q), [pool, TOTAL_Q]);

  const [qi, setQi]             = useState(0);
  const [score, setScore]       = useState(0);
  const [streak, setStreak]     = useState(0);
  const [answer, setAnswer]     = useState<AnswerState>(null);
  const [showFact, setShowFact] = useState(false);

  const endedRef  = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter(x => x !== id);
      if (!endedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const advance = useCallback(() => {
    const next = qi + 1;
    if (next >= questions.length) {
      if (endedRef.current) return;
      endedRef.current = true;
      const pct   = score / (questions.length * 10);
      const stars = pct >= 0.85 ? 3 : pct >= 0.6 ? 2 : 1;
      onEnd({ score, stars, summary: `Answered ${Math.round(score / 10)} of ${questions.length} flags correctly!` });
      return;
    }
    setQi(next);
    setAnswer(null);
    setShowFact(false);
    onProgress(next / questions.length);
    onMessage('Which country does this flag belong to?');
  }, [qi, questions.length, score, onEnd, onProgress, onMessage]);

  const handlePick = useCallback((chosen: Country) => {
    if (answer) return;
    const q       = questions[qi];
    const correct = chosen.code === q.correct.code;

    setAnswer({ chosen: chosen.code, correct });

    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      const bonus  = newStreak >= 3 ? 5 : 0;
      const pts    = 10 + bonus;
      setScore(s => s + pts);
      onScore(pts);
      setShowFact(true);
      onMessage(newStreak >= 3 ? `🔥 ${newStreak} streak! +${pts}` : '✓ Correct!');
      schedule(advance, 1800);
    } else {
      setStreak(0);
      setShowFact(true);
      onMessage(`The correct answer was ${q.correct.name}`);
      schedule(advance, 2600);
    }
  }, [answer, questions, qi, streak, onScore, onMessage, schedule, advance]);

  if (qi >= questions.length) return null;
  const q = questions[qi];

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-text-muted">Question {qi + 1}/{questions.length}</span>
          {streak >= 3 && (
            <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full font-bold animate-pulse">
              🔥 {streak} streak!
            </span>
          )}
        </div>
        <span className="bg-accent/20 text-accent rounded-lg px-2.5 py-1 text-sm font-bold">{score} pts</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden flex-shrink-0">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(qi / questions.length) * 100}%`,
            background: 'linear-gradient(90deg, var(--color-accent), #67e8f9)',
          }}
        />
      </div>

      {/* Flag display */}
      <div className="flex-shrink-0 flex flex-col items-center gap-2 py-2">
        <div className="text-7xl leading-none select-none">{q.correct.flag}</div>
        <p className="text-text-muted text-sm font-medium">Which country is this?</p>
      </div>

      {/* Answer options */}
      <div className="grid grid-cols-2 gap-2.5 flex-shrink-0">
        {q.options.map(opt => {
          const isChosen  = answer?.chosen === opt.code;
          const isCorrect = opt.code === q.correct.code;
          const revealed  = !!answer;

          let bg     = 'bg-card hover:bg-card-hover';
          let border = 'border border-white/5 hover:border-white/15';
          let text   = 'text-text';

          if (revealed) {
            if (isCorrect) {
              bg = 'bg-emerald-500/20'; border = 'border-2 border-emerald-400'; text = 'text-emerald-300 font-bold';
            } else if (isChosen) {
              bg = 'bg-red-500/20'; border = 'border-2 border-red-400'; text = 'text-red-300';
            } else {
              bg = 'bg-card/50'; border = 'border border-white/5'; text = 'text-text-muted';
            }
          }

          return (
            <button
              key={opt.code}
              onClick={() => handlePick(opt)}
              disabled={!!answer}
              className={`${bg} ${border} ${text} rounded-2xl px-3 py-3.5 text-sm font-semibold text-center transition-all active:scale-95 disabled:cursor-default relative overflow-hidden`}
            >
              {revealed && isCorrect && (
                <span className="absolute top-1.5 right-2 text-emerald-400 text-xs">✓</span>
              )}
              {revealed && isChosen && !isCorrect && (
                <span className="absolute top-1.5 right-2 text-red-400 text-xs">✗</span>
              )}
              {opt.name}
            </button>
          );
        })}
      </div>

      {/* Feedback / learning fact */}
      {showFact && answer && (
        <div className={`flex-shrink-0 rounded-2xl px-4 py-3 border text-sm transition-all ${
          answer.correct
            ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-300'
            : 'bg-red-500/12 border-red-500/25 text-red-300'
        }`}>
          {answer.correct ? (
            <div>
              <span className="font-bold">✓ Correct! </span>
              <span className="text-text-muted text-xs">
                Capital of {q.correct.name}: <span className="font-semibold text-text">{q.correct.capital}</span>
              </span>
            </div>
          ) : (
            <div>
              <span className="font-bold">✗ Not quite. </span>
              <span>
                {q.correct.flag} That flag belongs to{' '}
                <span className="font-bold text-emerald-300">{q.correct.name}</span>
                <span className="text-text-muted text-xs block mt-0.5">
                  Capital: {q.correct.capital}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Continent breadcrumb — subtle learning context */}
      {!answer && (
        <p className="text-center text-text-muted text-xs flex-shrink-0">
          {q.correct.continent}
        </p>
      )}
    </div>
  );
}
