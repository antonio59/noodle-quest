// Every game tile, keyed by game id (must match src/lib/game-manifest.ts).
import { BOARD_TILES } from './tiles-board.js';
import { BRAIN_TILES } from './tiles-brain.js';
import { CALM_TILES } from './tiles-calm.js';
import type { Tile } from './shapes.js';

export const TILES: Record<string, Tile> = { ...BOARD_TILES, ...BRAIN_TILES, ...CALM_TILES };
