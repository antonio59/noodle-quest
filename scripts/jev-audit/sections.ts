import { noul, choice, score, type Question, type EntryType } from '@typesafe-ai/sdk';
import * as D from './data.js';

// ---------- shared types ----------

export interface Finding {
  section: string;
  severity: 'flag' | 'info';
  item: string;
  issue: string;
  detail?: string;
}

export interface Unit {
  label: string;
  state: EntryType;
  questions: Record<string, Question>;
  interpret: (answers: Record<string, any>) => Finding[];
}

export interface Section {
  id: string;
  title: string;
  blurb: string;
  units: (limit?: number) => Unit[];
}

// ---------- helpers ----------

const batch = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const take = <T>(items: T[], limit?: number) => (limit && limit > 0 ? items.slice(0, limit) : items);

const pct = (n: number) => `${Math.round(n * 100)}%`;

// Jev evaluates the proposition as stated — appended directives ("answer no
// if…", "or would…") get folded into the claim and corrupt the probability.
// Keep instructions a single clean question; put nuance in criteria.
const OK_CRITERIA = {
  true: 'Appropriate — safe for a 7-year-old',
  false: 'Inappropriate: profanity, slurs, sexual, drug/alcohol, or violent/frightening connotations',
} as const;
const APPROPRIATE = (text: string, ctx = "a children's family brain-game app") =>
  noul(`Is "${text}" appropriate content for ${ctx}?`, OK_CRITERIA);

const REAL_CRITERIA = {
  true: 'A standard common English word',
  false: 'A proper noun, abbreviation, acronym, or misspelling',
} as const;

const top2 = (probs: Record<string, number>) =>
  Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 2);

// ---------- sections ----------

const words: Section = {
  id: 'words',
  title: 'Core word list (en-gb-core)',
  blurb: 'Appropriateness, "real word" sanity, and banned-flag agreement for every WordEntry.',
  units: limit => batch(take(D.coreWords, limit), 10).map((group, gi) => {
    const questions: Record<string, Question> = {};
    group.forEach((w, i) => {
      questions[`w${i}_ok`] = APPROPRIATE(w.answer);
      questions[`w${i}_real`] = noul(`Is "${w.answer}" a standard English word?`, REAL_CRITERIA);
      if (w.difficulty === 1) {
        questions[`w${i}_known`] = noul(`Would most children aged 7–10 know the word "${w.answer}"?`);
      }
    });
    return {
      label: `words batch ${gi + 1}`,
      state: { words: group.map(w => ({ answer: w.answer, tags: w.tags, difficulty: w.difficulty, banned: !!w.banned })) },
      questions,
      interpret: answers => group.flatMap((w, i): Finding[] => {
        const out: Finding[] = [];
        const ok = answers[`w${i}_ok`]?.noul;
        const real = answers[`w${i}_real`]?.noul;
        const known = answers[`w${i}_known`]?.noul;
        if (ok !== undefined && !w.banned && ok < 0.6) {
          out.push({ section: 'words', severity: 'flag', item: w.answer,
            issue: 'May be inappropriate for kids but is not banned', detail: `appropriate=${pct(ok)}` });
        }
        if (ok !== undefined && w.banned && ok > 0.8) {
          out.push({ section: 'words', severity: 'info', item: w.answer,
            issue: 'Flagged banned but looks acceptable — possible over-ban', detail: `appropriate=${pct(ok)}` });
        }
        const isProper = w.tags.includes('proper-noun');
        if (real !== undefined && real < 0.6 && !isProper) {
          out.push({ section: 'words', severity: 'flag', item: w.answer,
            issue: 'May not be a standard English word', detail: `standard-word=${pct(real)}` });
        }
        if (real !== undefined && real > 0.8 && isProper) {
          out.push({ section: 'words', severity: 'info', item: w.answer,
            issue: 'Tagged proper-noun but looks like a standard word — tag may be wrong',
            detail: `standard-word=${pct(real)}` });
        }
        if (known !== undefined && known < 0.5) {
          out.push({ section: 'words', severity: 'flag', item: w.answer,
            issue: 'Marked difficulty 1 but likely unknown to 7–10 year olds', detail: `kid-known=${pct(known)}` });
        }
        return out;
      }),
    };
  }),
};

const clues: Section = {
  id: 'clues',
  title: 'Core clues (crossword / word games)',
  blurb: 'Each clue should point clearly to its answer and be kid-readable. Unresolved wordIds are reported too.',
  units: limit => {
    const valid = take(D.coreClues, limit)
      .map(c => ({ c, answer: D.answerByWordId.get(c.wordId) }))
      .filter((r): r is { c: (typeof D.coreClues)[0]; answer: string } => !!r.answer);
    return batch(valid, 10).map((group, gi) => {
      const questions: Record<string, Question> = {};
      group.forEach(({ c, answer }, i) => {
        questions[`c${i}_fits`] = noul(
          `For a children's crossword, does the clue "${c.clue}" clearly and correctly point to the answer "${answer}"?`,
          { true: 'The clue clearly points to this answer', false: 'The clue is ambiguous or fits a different common word better' });
        questions[`c${i}_kid`] = noul(`Is the clue "${c.clue}" understandable and appropriate for children aged 6–12?`);
      });
      return {
        label: `clues batch ${gi + 1}`,
        state: { clues: group.map(({ c, answer }) => ({ answer, clue: c.clue, type: c.clueType })) },
        questions,
        interpret: answers => group.flatMap(({ c, answer }, i): Finding[] => {
          const out: Finding[] = [];
          const fits = answers[`c${i}_fits`]?.noul;
          const kid = answers[`c${i}_kid`]?.noul;
          if (fits !== undefined && fits < 0.6) {
            out.push({ section: 'clues', severity: 'flag', item: `${answer} ← "${c.clue}"`,
              issue: 'Clue may not point clearly to the answer', detail: `fits=${pct(fits)}` });
          }
          if (kid !== undefined && kid < 0.6) {
            out.push({ section: 'clues', severity: 'flag', item: `${answer} ← "${c.clue}"`,
              issue: 'Clue may be too hard or inappropriate for kids', detail: `kid=${pct(kid)}` });
          }
          return out;
        }),
      };
    });
  },
};

const fillBlank: Section = {
  id: 'fill-blank',
  title: 'Fill in the Blank puzzles',
  blurb: 'Clue→word fit, kid readability, and theme membership for all 150 puzzle items.',
  units: limit => {
    const items = take(D.fillBlankThemes().flatMap(t => t.words.map(w => ({ ...w, theme: t.name }))), limit);
    return batch(items, 8).map((group, gi) => {
      const questions: Record<string, Question> = {};
      group.forEach((w, i) => {
        questions[`p${i}_fits`] = noul(
          `Does the clue "${w.clue}" clearly identify "${w.word}" as the missing word?`,
          { true: 'The clue clearly identifies this word', false: 'A child could reasonably fill in a different word' });
        questions[`p${i}_kid`] = noul(`Is the clue "${w.clue}" understandable and appropriate for children aged 6–12?`);
        questions[`p${i}_theme`] = noul(`Does the word "${w.word}" belong in the theme "${w.theme}"?`);
      });
      return {
        label: `fill-blank batch ${gi + 1}`,
        state: { puzzles: group },
        questions,
        interpret: answers => group.flatMap((w, i): Finding[] => {
          const out: Finding[] = [];
          const fits = answers[`p${i}_fits`]?.noul;
          const kid = answers[`p${i}_kid`]?.noul;
          const theme = answers[`p${i}_theme`]?.noul;
          if (fits !== undefined && fits < 0.6) {
            out.push({ section: 'fill-blank', severity: 'flag', item: `${w.word} ← "${w.clue}"`,
              issue: 'Clue may not uniquely identify the answer', detail: `fits=${pct(fits)}` });
          }
          if (kid !== undefined && kid < 0.6) {
            out.push({ section: 'fill-blank', severity: 'flag', item: `${w.word} ← "${w.clue}"`,
              issue: 'Clue may be too hard for kids', detail: `kid=${pct(kid)}` });
          }
          if (theme !== undefined && theme < 0.6) {
            out.push({ section: 'fill-blank', severity: 'flag', item: `${w.word} (${w.theme})`,
              issue: 'Word may not fit its theme', detail: `theme-fit=${pct(theme)}` });
          }
          return out;
        }),
      };
    });
  },
};

const feelings: Section = {
  id: 'feelings',
  title: 'Feelings Faces answer keys',
  blurb: 'Re-judges each scenario against its own options; flags wrong keys and ambiguous items.',
  units: limit => batch(take(D.feelingsQuestions(), limit), 6).map((group, gi) => {
    const questions: Record<string, Question> = {};
    group.forEach((q, i) => {
      const criteria: Record<string, null> = {};
      for (const o of q.options) criteria[o] = null;
      questions[`f${i}`] = choice(
        `A child sees this scenario: "${q.scenario}". Which emotion is the BEST single answer?`, criteria);
    });
    return {
      label: `feelings batch ${gi + 1}`,
      state: { scenarios: group.map(q => ({ scenario: q.scenario, options: q.options, expected: q.correct })) },
      questions,
      interpret: answers => group.flatMap((q, i): Finding[] => {
        const a = answers[`f${i}`];
        if (!a || a.type !== 'choice') return [];
        const [first, second] = top2(a.probabilities as Record<string, number>);
        const margin = second ? first[1] - second[1] : 1;
        if (a.choice !== q.correct) {
          return [{ section: 'feelings', severity: 'flag', item: `"${q.scenario}"`,
            issue: `Answer key "${q.correct}" may be wrong — Jev prefers "${a.choice}"`,
            detail: `probs: ${Object.entries(a.probabilities).map(([k, v]) => `${k}=${pct(v as number)}`).join(', ')}` }];
        }
        if (margin < 0.15) {
          return [{ section: 'feelings', severity: 'info', item: `"${q.scenario}"`,
            issue: `Ambiguous — "${second![0]}" is nearly as plausible as the key "${q.correct}"`,
            detail: `${q.correct}=${pct(first[1])}, ${second![0]}=${pct(second![1])}` }];
        }
        return [];
      }),
    };
  }),
};

const EMPATHY_RUBRIC = [
  'Unkind, hurtful, or dismissive — would make the friend feel worse',
  'Unhelpful — ignores the situation or changes the subject',
  'Somewhat helpful — acknowledges the situation with mild support',
  'Very empathetic — validates the feeling and offers genuine help or comfort',
] as const;

const empathy: Section = {
  id: 'empathy',
  title: 'Empathy Engine option scores',
  blurb: 'Independently scores each response option and compares against hand-assigned 0–3 scores.',
  units: limit => {
    const items = take(D.empathyScenarios(), limit);
    return batch(items, 2).map((group, gi) => {
      const questions: Record<string, Question> = {};
      const flat: { item: (typeof items)[0]; opt: { text: string; score: number }; key: string }[] = [];
      group.forEach((it, si) => it.scenario.options.forEach((opt, oi) => {
        const key = `s${si}_o${oi}`;
        questions[key] = score(
          `Scenario: "${it.scenario.situation}". How good is this response for a child to say to their friend: "${opt.text}"?`,
          EMPATHY_RUBRIC);
        flat.push({ item: it, opt, key });
      }));
      return {
        label: `empathy batch ${gi + 1}`,
        state: { scenarios: group.map(it => ({ friend: it.scenario.friend, situation: it.scenario.situation, options: it.scenario.options })) },
        questions,
        interpret: answers => flat.flatMap(({ item, opt, key }): Finding[] => {
          const a = answers[key];
          if (!a || a.type !== 'score') return [];
          const got = a.score as number;
          const want = opt.score;
          if (Math.abs(got - want) >= 1.5 || (want === 3 && got < 2) || (want === 0 && got > 2)) {
            return [{ section: 'empathy', severity: 'flag', item: `"${item.scenario.situation}" → "${opt.text}"`,
              issue: `Hand score ${want} but Jev rates it ${got.toFixed(1)}`,
              detail: `confidence=${pct(a.confidence)}` }];
          }
          return [];
        }),
      };
    });
  },
};

const HEAT_RUBRIC = [
  'Minor annoyance — a child shrugs it off quickly (heat ≈ 40)',
  'Moderately upsetting — ruins the moment, not the day (heat ≈ 55)',
  'Very upsetting — a child needs real help calming down (heat ≈ 70)',
  'Overwhelming — among the worst everyday feelings for a child (heat ≈ 85)',
] as const;
const HEAT_MAP = [40, 55, 70, 85];
const STRATEGY_RUBRIC = ['Not helpful for calming down', 'Slightly helpful', 'Effective', 'Very effective'] as const;

const volcano: Section = {
  id: 'volcano',
  title: 'Emotion Volcano heat & strategies',
  blurb: 'Calibrates trigger heat values and sanity-checks the relative power of cooling strategies.',
  units: limit => {
    const { triggers, strategies } = D.volcanoData();
    const units: Unit[] = batch(take(triggers, limit), 10).map((group, gi) => {
      const questions: Record<string, Question> = {};
      group.forEach((it, i) => {
        questions[`t${i}`] = score(
          `How upsetting is this for a typical child aged 6–12: "${it.t.trigger}"?`, HEAT_RUBRIC);
      });
      return {
        label: `volcano triggers batch ${gi + 1}`,
        state: { triggers: group.map(it => ({ trigger: it.t.trigger, heat: it.t.heat, stage: it.stage })) },
        questions,
        interpret: answers => group.flatMap((it, i): Finding[] => {
          const a = answers[`t${i}`];
          if (!a || a.type !== 'score') return [];
          const mapped = HEAT_MAP[Math.round(a.score as number)] ?? 55;
          if (Math.abs(it.t.heat - mapped) > 25) {
            return [{ section: 'volcano', severity: 'flag', item: `"${it.t.trigger}"`,
              issue: `heat=${it.t.heat} but Jev places it near ${mapped}`,
              detail: `level=${(a.score as number).toFixed(1)}, confidence=${pct(a.confidence)}` }];
          }
          return [];
        }),
      };
    });
    // strategies: one call, each scored on the same effectiveness rubric
    const sq: Record<string, Question> = {};
    strategies.forEach((s, i) => {
      sq[`s${i}`] = score(
        `How effective is "${s.name}" (${s.tip}) as a calm-down strategy for an upset child?`, STRATEGY_RUBRIC);
    });
    units.push({
      label: 'volcano strategies',
      state: { strategies },
      questions: sq,
      interpret: answers => strategies.flatMap((s, i): Finding[] => {
        const a = answers[`s${i}`];
        if (!a || a.type !== 'score') return [];
        const expectedLevel = s.power >= 20 ? 3 : s.power >= 16 ? 2 : s.power >= 13 ? 1 : 0;
        if (Math.abs((a.score as number) - expectedLevel) >= 1.5) {
          return [{ section: 'volcano', severity: 'flag', item: s.name,
            issue: `power=${s.power} but Jev effectiveness=${(a.score as number).toFixed(1)}/3`,
            detail: `tip: "${s.tip}"` }];
        }
        return [];
      }),
    });
    return units;
  },
};

const sequences: Section = {
  id: 'sequences',
  title: 'Story Builder + Routine Roadmap orderings',
  blurb: 'Checks coherence, then asks whether each adjacent step MUST precede the next — flags pairs where strict ordering may be unfair.',
  units: limit => {
    const ordered = [
      ...take(D.stories(), limit).map(s => ({ kind: 'story', title: s.title, steps: [...s.panels].sort((a, b) => a.order - b.order).map(p => p.text) })),
      ...take(D.routines(), limit).map(r => ({ kind: 'routine', title: r.name, steps: [...r.tasks].sort((a, b) => a.order - b.order).map(t => t.text) })),
    ];
    return ordered.map(it => {
      const questions: Record<string, Question> = { coherent: noul(
        `Is "${it.title}" a clear, coherent sequence of steps a child could follow?`) };
      it.steps.slice(0, -1).forEach((a, i) => {
        questions[`pair_${i}`] = noul(
          `Must "${a}" come before "${it.steps[i + 1]}" for the sequence "${it.title}" to be correct?`,
          { true: 'Swapping would be clearly wrong', false: 'Swapping would still be a reasonable order' });
      });
      return {
        label: `${it.kind}: ${it.title}`,
        state: { kind: it.kind, title: it.title, steps: it.steps },
        questions,
        interpret: answers => {
          const out: Finding[] = [];
          const coh = answers['coherent']?.noul;
          if (coh !== undefined && coh < 0.6) {
            out.push({ section: 'sequences', severity: 'flag', item: `${it.kind} "${it.title}"`,
              issue: 'Sequence may be incoherent or inappropriate', detail: `coherent=${pct(coh)}` });
          }
          it.steps.slice(0, -1).forEach((a, i) => {
            const p = answers[`pair_${i}`]?.noul;
            if (p !== undefined && p < 0.5) {
              out.push({ section: 'sequences', severity: 'flag', item: `${it.kind} "${it.title}"`,
                issue: `Steps "${a}" → "${it.steps[i + 1]}" look swappable — strict order may punish a correct answer`,
                detail: `must-precede=${pct(p)}` });
            }
          });
          return out;
        },
      };
    });
  },
};

const mistakes: Section = {
  id: 'mistakes',
  title: 'Mistake Master fact-checks',
  blurb: 'Verifies each "impossible" claim and each lesson text.',
  units: limit => batch(take(D.mistakeChallenges(), limit), 6).map((group, gi) => {
    const questions: Record<string, Question> = {};
    group.forEach((c, i) => {
      questions[`m${i}_fact`] = noul(`Is this claim accurate: "${c.impossibleReason}"?`);
      questions[`m${i}_lesson`] = noul(`Is "${c.lesson}" accurate, encouraging advice that is appropriate for children?`);
    });
    return {
      label: `mistakes batch ${gi + 1}`,
      state: { challenges: group },
      questions,
      interpret: answers => group.flatMap((c, i): Finding[] => {
        const out: Finding[] = [];
        const fact = answers[`m${i}_fact`]?.noul;
        const lesson = answers[`m${i}_lesson`]?.noul;
        if (fact !== undefined && fact < 0.6) {
          out.push({ section: 'mistakes', severity: 'flag', item: `"${c.task}"`,
            issue: `"Impossible" claim may be inaccurate: "${c.impossibleReason}"`, detail: `true=${pct(fact)}` });
        }
        if (lesson !== undefined && lesson < 0.6) {
          out.push({ section: 'mistakes', severity: 'flag', item: `"${c.task}"`,
            issue: `Lesson may be off: "${c.lesson}"`, detail: `ok=${pct(lesson)}` });
        }
        return out;
      }),
    };
  }),
};

const mapAliases: Section = {
  id: 'map-aliases',
  title: 'Map Quiz labels & aliases',
  blurb: 'Validates every answer label and every alias across all 5 datasets; flags aliases that could match a different place.',
  units: limit => {
    const datasets = D.mapDatasets();
    const items = datasets.flatMap(ds => ds.answers.map(a => ({ ds: ds.title, ...a })));
    return batch(take(items, limit), 8).map((group, gi) => {
      const questions: Record<string, Question> = {};
      group.forEach((a, i) => {
        questions[`a${i}_real`] = noul(`Is "${a.label}" a real place that belongs on a map of "${a.ds}"?`);
        a.aliases.forEach((al, j) => {
          questions[`a${i}_${j}_valid`] = noul(
            `Is "${al}" a valid alternative name, common exonym, or accepted spelling for "${a.label}"?`);
          questions[`a${i}_${j}_amb`] = noul(
            `Could "${al}" also refer to a different place than "${a.label}"?`);
        });
      });
      return {
        label: `map batch ${gi + 1}`,
        state: { dataset: group[0]?.ds, answers: group.map(a => ({ label: a.label, aliases: a.aliases })) },
        questions,
        interpret: answers => group.flatMap((a, i): Finding[] => {
          const out: Finding[] = [];
          const real = answers[`a${i}_real`]?.noul;
          if (real !== undefined && real < 0.6) {
            out.push({ section: 'map-aliases', severity: 'flag', item: `${a.label} (${a.ds})`,
              issue: 'Label may not be a real/correct place for this map', detail: `real=${pct(real)}` });
          }
          a.aliases.forEach((al, j) => {
            const valid = answers[`a${i}_${j}_valid`]?.noul;
            const amb = answers[`a${i}_${j}_amb`]?.noul;
            if (valid !== undefined && valid < 0.6) {
              out.push({ section: 'map-aliases', severity: 'flag', item: `${a.label} ← alias "${al}" (${a.ds})`,
                issue: 'Alias may not be a valid name for this answer', detail: `valid=${pct(valid)}` });
            }
            if (amb !== undefined && amb > 0.5) {
              out.push({ section: 'map-aliases', severity: 'flag', item: `${a.label} ← alias "${al}" (${a.ds})`,
                issue: 'Alias is ambiguous — could mean a different place', detail: `ambiguous=${pct(amb)}` });
            }
          });
          return out;
        }),
      };
    });
  },
};

const flags: Section = {
  id: 'flags',
  title: 'Flag Match capitals & continents',
  blurb: 'Verifies each capital (multi-capital aware) and continent tag for all 76 countries.',
  units: limit => batch(take(D.flagCountries(), limit), 10).map((group, gi) => {
    const questions: Record<string, Question> = {};
    group.forEach((c, i) => {
      questions[`c${i}_cap`] = noul(`Is ${c.capital} an official capital of ${c.name}?`,
        { true: `${c.capital} is the capital or one of the official capitals of ${c.name}`, false: `${c.capital} is not a capital of ${c.name}` });
      questions[`c${i}_cont`] = noul(`Is ${c.name} located in the region "${c.continent}"?`);
    });
    return {
      label: `flags batch ${gi + 1}`,
      state: { countries: group.map(c => ({ name: c.name, capital: c.capital, continent: c.continent })) },
      questions,
      interpret: answers => group.flatMap((c, i): Finding[] => {
        const out: Finding[] = [];
        const cap = answers[`c${i}_cap`]?.noul;
        const cont = answers[`c${i}_cont`]?.noul;
        if (cap !== undefined && cap < 0.6) {
          out.push({ section: 'flags', severity: 'flag', item: `${c.flag} ${c.name}`,
            issue: `Capital "${c.capital}" may be wrong`, detail: `is-capital=${pct(cap)}` });
        }
        if (cont !== undefined && cont < 0.5) {
          out.push({ section: 'flags', severity: 'flag', item: `${c.flag} ${c.name}`,
            issue: `Continent tag "${c.continent}" may be wrong`, detail: `in-region=${pct(cont)}` });
        }
        return out;
      }),
    };
  }),
};

const flagDistractors: Section = {
  id: 'flag-distractors',
  title: 'Flag Match distractor suggestions',
  blurb: 'Picks the most visually confusable flag per country — data for better wrong options.',
  units: limit => {
    const countries = take(D.flagCountries(), limit);
    const allNames = D.flagCountries().map(c => c.name);
    return batch(countries, 6).map((group, gi) => {
      const questions: Record<string, Question> = {};
      group.forEach((c, i) => {
        const criteria: Record<string, null> = {};
        for (const n of allNames) if (n !== c.name) criteria[n] = null;
        questions[`d${i}`] = choice(`Which country's flag looks MOST visually similar to ${c.name}'s flag?`, criteria);
      });
      return {
        label: `distractors batch ${gi + 1}`,
        state: { countries: group.map(c => c.name) },
        questions,
        interpret: answers => group.flatMap((c, i): Finding[] => {
          const a = answers[`d${i}`];
          if (!a || a.type !== 'choice') return [];
          return [{ section: 'flag-distractors', severity: 'info', item: `${c.flag} ${c.name}`,
            issue: `Most confusable flag: ${a.choice}`,
            detail: `confidence=${pct(a.confidence)}` }];
        }),
      };
    });
  },
};

const bookworm: Section = {
  id: 'bookworm',
  title: 'Bookworm dictionary',
  blurb: 'Every dictionary word checked for "real common word" and kid-appropriateness.',
  units: limit => {
    const words = take([...D.bookwormDictionary()].sort(), limit);
    return batch(words, 20).map((group, gi) => {
      const questions: Record<string, Question> = {};
      group.forEach((w, i) => {
        questions[`w${i}_real`] = noul(`Is "${w}" a standard English word?`, REAL_CRITERIA);
        questions[`w${i}_ok`] = APPROPRIATE(w, "a children's word game");
      });
      return {
        label: `bookworm batch ${gi + 1}`,
        state: { words: group },
        questions,
        interpret: answers => group.flatMap((w, i): Finding[] => {
          const out: Finding[] = [];
          const real = answers[`w${i}_real`]?.noul;
          const ok = answers[`w${i}_ok`]?.noul;
          if (real !== undefined && real < 0.6) {
            out.push({ section: 'bookworm', severity: 'flag', item: w,
              issue: 'May not be a valid common English word', detail: `standard-word=${pct(real)}` });
          }
          if (ok !== undefined && ok < 0.6) {
            out.push({ section: 'bookworm', severity: 'flag', item: w,
              issue: 'May be inappropriate for a kids word game', detail: `appropriate=${pct(ok)}` });
          }
          return out;
        }),
      };
    });
  },
};

const brainFood: Section = {
  id: 'brain-food',
  title: 'Brain Food claims',
  blurb: 'Checks each research card for overclaiming and kid-suitability.',
  units: limit => [{
    label: 'brain-food',
    state: { cards: take(D.brainFood, limit).map(c => ({ title: c.title, takeaway: c.takeaway, body: c.body, source: c.source })) },
    questions: Object.fromEntries(take(D.brainFood, limit).map((c, i) => [
      `b${i}`, noul(
        `Is this an accurate, appropriately-hedged claim for a kids' educational app? Claim: "${c.takeaway}". Detail: "${c.body}". Named source: ${c.source}.`),
    ])),
    interpret: answers => take(D.brainFood, limit).flatMap((c, i): Finding[] => {
      const p = answers[`b${i}`]?.noul;
      if (p !== undefined && p < 0.6) {
        return [{ section: 'brain-food', severity: 'flag', item: `"${c.title}"`,
          issue: `Claim may overstate the research: "${c.takeaway}"`, detail: `fair=${pct(p)}` }];
      }
      return [];
    }),
  }],
};

const anagram: Section = {
  id: 'anagram',
  title: 'Anagram Blast words & hints',
  blurb: 'Hint accuracy and category fit for every word.',
  units: limit => {
    const items = take(D.anagramWords(), limit);
    const cats = [...new Set(D.anagramWords().map(w => w.word.category))];
    return batch(items, 10).map((group, gi) => {
      const questions: Record<string, Question> = {};
      group.forEach(({ word: w }, i) => {
        questions[`a${i}_hint`] = noul(`Is "${w.hint}" an accurate hint for the word "${w.word}"?`);
        const criteria: Record<string, null> = {};
        for (const c of cats) criteria[c] = null;
        questions[`a${i}_cat`] = choice(`Which category best fits the word "${w.word}"?`, criteria);
      });
      return {
        label: `anagram batch ${gi + 1}`,
        state: { words: group.map(({ word }) => word) },
        questions,
        interpret: answers => group.flatMap(({ word: w }, i): Finding[] => {
          const out: Finding[] = [];
          const hint = answers[`a${i}_hint`]?.noul;
          const cat = answers[`a${i}_cat`];
          if (hint !== undefined && hint < 0.6) {
            out.push({ section: 'anagram', severity: 'flag', item: `${w.word} ← "${w.hint}"`,
              issue: 'Hint may be inaccurate or misleading', detail: `accurate=${pct(hint)}` });
          }
          if (cat && cat.type === 'choice' && cat.choice !== w.category && (cat.confidence as number) > 0.6) {
            out.push({ section: 'anagram', severity: 'info', item: w.word,
              issue: `Categorised "${w.category}" but "${cat.choice}" may fit better`,
              detail: `confidence=${pct(cat.confidence)}` });
          }
          return out;
        }),
      };
    });
  },
};

// ---------- deterministic checks (no API) ----------

export function codeChecks(): Finding[] {
  const out: Finding[] = [];
  const push = (item: string, issue: string) =>
    out.push({ section: 'code-checks', severity: 'flag', item, issue });

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // duplicate word IDs / answers in the core list
  const seenId = new Map<string, number>();
  const seenAns = new Map<string, number>();
  for (const w of D.coreWords) {
    seenId.set(w.id, (seenId.get(w.id) ?? 0) + 1);
    seenAns.set(norm(w.answer), (seenAns.get(norm(w.answer)) ?? 0) + 1);
  }
  for (const [id, n] of seenId) if (n > 1) push(id, `Duplicate word id ×${n}`);
  for (const [a, n] of seenAns) if (n > 1) push(a, `Duplicate normalised answer ×${n}`);

  // clues referencing a wordId with no WordEntry
  for (const c of D.coreClues) {
    if (!D.answerByWordId.has(c.wordId)) {
      push(c.wordId, `Clue "${c.clue}" references a wordId with no matching WordEntry`);
    }
  }

  // map-quiz: id dupes + alias collisions (alias equals another answer's label/alias)
  for (const ds of D.mapDatasets()) {
    const ids = new Map<string, number>();
    for (const a of ds.answers) ids.set(a.id, (ids.get(a.id) ?? 0) + 1);
    for (const [id, n] of ids) if (n > 1) push(`${ds.title}:${id}`, `Duplicate answer id ×${n}`);

    const owner = new Map<string, string>();
    for (const a of ds.answers) {
      owner.set(norm(a.label), a.label);
      for (const al of a.aliases) owner.set(norm(al), a.label);
    }
    for (const a of ds.answers) {
      for (const al of a.aliases) {
        const other = owner.get(norm(al));
        if (other && other !== a.label) {
          push(`${ds.title}: "${al}"`, `Alias for "${a.label}" collides with "${other}" — typing it credits the wrong answer`);
        }
      }
    }
  }

  // flag-match dupes
  const flagNames = new Map<string, number>();
  for (const c of D.flagCountries()) flagNames.set(c.name, (flagNames.get(c.name) ?? 0) + 1);
  for (const [n, k] of flagNames) if (k > 1) push(`flag-match:${n}`, `Duplicate country ×${k}`);

  // fill-blank dup words per theme
  for (const t of D.fillBlankThemes()) {
    const seen = new Map<string, number>();
    for (const w of t.words) seen.set(w.word, (seen.get(w.word) ?? 0) + 1);
    for (const [w, n] of seen) if (n > 1) push(`${t.name}:${w}`, `Duplicate puzzle word ×${n}`);
  }

  return out;
}

export const SECTIONS: Section[] = [
  words, clues, fillBlank, feelings, empathy, volcano, sequences,
  mistakes, mapAliases, flags, flagDistractors, bookworm, brainFood, anagram,
];
