import type { QuizDataset } from '../types';
import { AntarcticaMap } from '../maps';

function a(id: string, label: string, x: number, y: number, ...aliases: string[]) {
  return { id, label, aliases, x, y };
}

export const antarcticaDataset: QuizDataset = {
  id: 'antarctica',
  title: 'Antarctic Territorial Claims',
  emoji: '🧊',
  description: 'Can you name the 7 countries with territorial claims in Antarctica?',
  mapComponent: AntarcticaMap,
  timeLimit: 3 * 60,
  answers: [
    a('gb', 'United Kingdom', 18, 18, 'uk', 'britain'),
    a('nz', 'New Zealand', 82, 22),
    a('fr', 'France', 28, 18),
    a('no', 'Norway', 12, 14),
    a('au', 'Australia', 60, 18),
    a('cl', 'Chile', 38, 22),
    a('ar', 'Argentina', 42, 20),
  ],
};
