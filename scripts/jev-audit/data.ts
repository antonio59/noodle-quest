import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractConst } from './extract.js';
import { EN_GB_CORE_WORDS, EN_GB_CORE_CLUES } from '../../src/data/words/en-gb-core.js';
import { BRAIN_FOOD } from '../../src/data/brain-food.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const GAME = (f: string) => path.join(ROOT, 'src', 'games', f);

// ---- Shapes mirrored from game files (plain data, kept local to the audit) ----

export interface FBTheme { id: string; name: string; words: { word: string; clue: string }[] }
export interface AnagramWord { word: string; category: string; hint: string }
export interface FeelQ { scenario: string; correct: string; options: string[]; hint?: string; category?: string }
export interface EmpathyScenario { friend: string; emoji: string; situation: string; options: { text: string; score: number }[] }
export interface VolcanoTrigger { trigger: string; emoji: string; heat: number }
export interface CoolStrategy { name: string; emoji: string; power: number; tip: string }
export interface Challenge { task: string; impossibleReason: string; lesson: string }
export interface Story { title: string; panels: { emoji: string; text: string; order: number }[] }
export interface Routine { name: string; tasks: { emoji: string; text: string; order: number }[] }
export interface FlagCountry { name: string; flag: string; continent: string; capital: string }
export interface QuizAnswer { id: string; label: string; aliases: string[]; x: number; y: number }
export interface QuizDataset { id: string; title: string; emoji: string; description: string; answers: QuizAnswer[] }

// ---- Loaders ----

export const coreWords = EN_GB_CORE_WORDS;
export const coreClues = EN_GB_CORE_CLUES;
export const brainFood = BRAIN_FOOD;

/** wordId (`gb-<NORMALISED>`) -> answer text, for resolving ClueEntry.wordId. */
export const answerByWordId = new Map(coreWords.map(w => [w.id, w.answer]));

export function fillBlankThemes(): FBTheme[] {
  return extractConst<FBTheme[]>(GAME('fill-blank.tsx'), 'THEMES');
}

export function anagramWords(): { length: number; word: AnagramWord }[] {
  const byLen = extractConst<Record<number, AnagramWord[]>>(GAME('anagram.tsx'), 'WORDS_BY_LENGTH');
  return Object.entries(byLen).flatMap(([len, ws]) => ws.map(word => ({ length: Number(len), word })));
}

export function feelingsQuestions(): FeelQ[] {
  const byStage = extractConst<Record<number, FeelQ[]>>(GAME('feelings-faces.tsx'), 'allQuestions');
  return Object.values(byStage).flat();
}

export function empathyScenarios(): { stage: number; scenario: EmpathyScenario }[] {
  const byStage = extractConst<Record<number, EmpathyScenario[]>>(GAME('empathy-engine.tsx'), 'allScenarios');
  return Object.entries(byStage).flatMap(([s, arr]) => arr.map(scenario => ({ stage: Number(s), scenario })));
}

export function volcanoData(): { triggers: { stage: number; t: VolcanoTrigger }[]; strategies: CoolStrategy[] } {
  const file = GAME('emotion-volcano.tsx');
  const byStage = extractConst<Record<number, VolcanoTrigger[]>>(file, 'allScenarios');
  const strategies = extractConst<CoolStrategy[]>(file, 'coolingStrategies');
  return {
    triggers: Object.entries(byStage).flatMap(([s, arr]) => arr.map(t => ({ stage: Number(s), t }))),
    strategies,
  };
}

export function mistakeChallenges(): Challenge[] {
  const byStage = extractConst<Record<number, Challenge[]>>(GAME('mistake-master.tsx'), 'ALL_CHALLENGES');
  return Object.values(byStage).flat();
}

export function stories(): Story[] {
  return Object.values(extractConst<Record<number, Story>>(GAME('story-builder.tsx'), 'allStories'));
}

export function routines(): Routine[] {
  return Object.values(extractConst<Record<number, Routine>>(GAME('routine-roadmap.tsx'), 'allRoutines'));
}

export function flagCountries(): FlagCountry[] {
  return extractConst<FlagCountry[]>(GAME('flag-match.tsx'), 'COUNTRIES');
}

export function bookwormDictionary(): Set<string> {
  return extractConst<Set<string>>(GAME('bookworm.tsx'), 'DICTIONARY', { EN_GB_CORE_WORDS });
}

const mapAnswer = (id: string, label: string, x: number, y: number, ...aliases: string[]) =>
  ({ id, label, aliases, x, y });
const MAP_SCOPE = { a: mapAnswer, WorldMap: 0, AfricaMap: 0, OceaniaMap: 0, AntarcticaMap: 0, UkMap: 0 };

export function mapDatasets(): QuizDataset[] {
  const dir = GAME('map-quiz/data');
  const files: [string, string][] = [
    ['world.ts', 'worldDataset'],
    ['africa.ts', 'africaDataset'],
    ['oceania.ts', 'oceaniaDataset'],
    ['antarctica.ts', 'antarcticaDataset'],
    ['uk.ts', 'ukDataset'],
  ];
  return files.map(([f, name]) => extractConst<QuizDataset>(path.join(dir, f), name, MAP_SCOPE));
}
