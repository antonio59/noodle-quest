// Server-side ports of the pure game rules used by the client.
// These run inside Convex mutations so the server can deal, roll, and
// validate transitions without trusting client-supplied hidden state.
// Keep these in sync with src/games/*/logic.ts.

// ── Randomness ─────────────────────────────────────────────────────────

/** Crypto-backed Fisher-Yates. Convex provides crypto.getRandomValues. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  const rand = new Uint32Array(a.length);
  crypto.getRandomValues(rand);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rollDie(): number {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return (r[0] % 6) + 1;
}

// ── UNO ────────────────────────────────────────────────────────────────

export const UNO_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type UnoColor = (typeof UNO_COLORS)[number];
const UNO_ACTION_SYMBOLS = ['skip', 'reverse', 'draw2'] as const;

export interface UnoCard {
  color: UnoColor | 'wild';
  symbol: string;
  type: 'number' | 'action' | 'wild' | 'wild4';
  id: number;
}

export function createUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let id = 0;
  for (const color of UNO_COLORS) {
    deck.push({ color, symbol: '0', type: 'number', id: id++ });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, symbol: String(i), type: 'number', id: id++ });
      deck.push({ color, symbol: String(i), type: 'number', id: id++ });
    }
    for (const sym of UNO_ACTION_SYMBOLS) {
      deck.push({ color, symbol: sym, type: 'action', id: id++ });
      deck.push({ color, symbol: sym, type: 'action', id: id++ });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', symbol: 'wild', type: 'wild', id: id++ });
    deck.push({ color: 'wild', symbol: 'wild', type: 'wild4', id: id++ });
  }
  return shuffle(deck);
}

export interface UnoDeal {
  hands: Record<number, UnoCard[]>;
  deck: UnoCard[];
  discard: UnoCard[];
  color: UnoColor;
}

export function dealUno(playerCount: number): UnoDeal {
  const d = createUnoDeck();
  const hands: Record<number, UnoCard[]> = {};
  for (let seat = 1; seat <= playerCount; seat++) {
    hands[seat] = d.slice((seat - 1) * 7, seat * 7);
  }
  let rest = d.slice(playerCount * 7);
  // Starter must be a number card to avoid wild-start edge cases.
  const starterIdx = rest.findIndex(c => c.type === 'number');
  const starter = starterIdx >= 0 ? rest[starterIdx] : rest[0];
  rest = rest.filter(c => c.id !== starter.id);
  return {
    hands,
    deck: rest,
    discard: [starter],
    color: starter.color === 'wild' ? 'red' : (starter.color as UnoColor),
  };
}

export function isUnoCard(c: unknown): c is UnoCard {
  if (typeof c !== 'object' || c === null) return false;
  const card = c as Record<string, unknown>;
  const colorOk = card.color === 'wild' || (UNO_COLORS as readonly string[]).includes(card.color as string);
  const typeOk = card.type === 'number' || card.type === 'action' || card.type === 'wild' || card.type === 'wild4';
  const symbolOk = typeof card.symbol === 'string' && card.symbol.length <= 8;
  return colorOk && typeOk && symbolOk && typeof card.id === 'number';
}

export function unoCanPlay(card: UnoCard, topCard: UnoCard, currentColor: UnoColor): boolean {
  if (card.type === 'wild' || card.type === 'wild4') return true;
  if (card.color === currentColor) return true;
  if (topCard.type === 'wild' || topCard.type === 'wild4') return false;
  return card.symbol === topCard.symbol;
}

/** Cards a player draws when the given played card resolves against them. */
export function unoDrawPenalty(card: UnoCard): number {
  if (card.symbol === 'draw2') return 2;
  if (card.type === 'wild4') return 4;
  return 0;
}

/** Playing this card keeps the turn with the mover (skip/reverse/+2/+4). */
export function unoKeepsTurn(card: UnoCard): boolean {
  return card.symbol === 'skip' || card.symbol === 'reverse' || unoDrawPenalty(card) > 0;
}

// ── Scrabble ───────────────────────────────────────────────────────────

const SCRABBLE_TILE_COUNTS: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
};

export const SCRABBLE_BOARD_SIZE = 15;
export const SCRABBLE_RACK_SIZE = 7;

export function isScrabbleLetter(l: unknown): l is string {
  return typeof l === 'string' && l in SCRABBLE_TILE_COUNTS;
}

export function buildScrabblePool(): string[] {
  const pool: string[] = [];
  for (const [letter, count] of Object.entries(SCRABBLE_TILE_COUNTS)) {
    for (let i = 0; i < count; i++) pool.push(letter);
  }
  return shuffle(pool);
}

export interface ScrabbleDeal {
  board: (string | null)[][];
  racks: string[][];
  pool: string[];
  scores: number[];
}

export function dealScrabble(playerCount: number): ScrabbleDeal {
  const pool = buildScrabblePool();
  const racks: string[][] = [];
  for (let i = 0; i < playerCount; i++) {
    racks.push(pool.splice(0, SCRABBLE_RACK_SIZE));
  }
  return {
    board: Array.from({ length: SCRABBLE_BOARD_SIZE }, () => Array(SCRABBLE_BOARD_SIZE).fill(null)),
    racks,
    pool,
    scores: Array(playerCount).fill(0),
  };
}

// ── Ludo ───────────────────────────────────────────────────────────────
// Positions are relative to each side's route: -1 base, 0..47 shared
// track, 48..53 home stretch, 54 home. Mirrors src/games/ludo/logic.ts.

export const LUDO_TRACK_LEN = 48;
export const LUDO_STRETCH_START = 48;
export const LUDO_HOME = 54;

const LUDO_ENTRIES = [0, 13, 39, 24]; // by sidesForCount order: red, green, yellow, blue

/** 1-indexed seats in play for an N-player game → entry offsets. */
export function ludoEntries(playerCount: number): number[] {
  if (playerCount <= 2) return [LUDO_ENTRIES[0], LUDO_ENTRIES[3]]; // red, blue
  if (playerCount === 3) return [LUDO_ENTRIES[0], LUDO_ENTRIES[1], LUDO_ENTRIES[3]];
  return LUDO_ENTRIES;
}

export const LUDO_SAFE = new Set([0, 8, 13, 21, 24, 34, 39, 47]);

export function ludoToAbsolute(rel: number, entry: number): number {
  if (rel < 0 || rel >= LUDO_STRETCH_START) return -1;
  return (entry + rel) % LUDO_TRACK_LEN;
}

export function ludoAdvance(rel: number, steps: number): number {
  if (rel === -1) return steps === 6 ? 0 : -1;
  const next = rel + steps;
  return next > LUDO_HOME ? rel : next;
}

export function ludoMovable(pieces: number[], d: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const pos = pieces[i];
    if (pos >= LUDO_HOME) continue;
    const np = ludoAdvance(pos, d);
    if (np === pos || np === -1) continue;
    out.push(i);
  }
  return out;
}

/** Opp piece indices captured when the mover lands on relative `moverRel`. */
export function ludoCaptured(moverRel: number, moverEntry: number, oppPieces: number[], oppEntry: number): number[] {
  const abs = ludoToAbsolute(moverRel, moverEntry);
  if (abs < 0 || LUDO_SAFE.has(abs)) return [];
  const out: number[] = [];
  for (let i = 0; i < oppPieces.length; i++) {
    if (ludoToAbsolute(oppPieces[i], oppEntry) === abs) out.push(i);
  }
  return out;
}

/**
 * Verify `next` is a legal Ludo result of rolling `roll` from `prev` for
 * seat `moverIdx` (0-indexed) in a `playerCount`-seat game. Legal means:
 * every non-mover seat is unchanged except pieces captured by the landing
 * (which go to -1), and the mover either moves exactly one piece by the
 * rules or, when nothing can move, stays put.
 */
export function isLegalLudoResult(prev: number[][], next: number[][], moverIdx: number, roll: number): boolean {
  const entries = ludoEntries(prev.length);
  const moverEntry = entries[moverIdx];
  if (moverEntry === undefined) return false;

  const prevMine = prev[moverIdx];
  const nextMine = next[moverIdx];
  if (!Array.isArray(prevMine) || !Array.isArray(nextMine) || prevMine.length !== 4 || nextMine.length !== 4) return false;

  // Find mover deltas: exactly one piece may move, to advance(old, roll).
  let movedIdx = -1;
  for (let i = 0; i < 4; i++) {
    if (nextMine[i] === prevMine[i]) continue;
    if (movedIdx !== -1) return false; // two pieces moved
    movedIdx = i;
  }

  if (movedIdx === -1) {
    // No mover change — only legal if nothing could move.
    if (ludoMovable(prevMine, roll).length > 0) return false;
  } else {
    if (ludoAdvance(prevMine[movedIdx], roll) !== nextMine[movedIdx]) return false;
    if (nextMine[movedIdx] === prevMine[movedIdx]) return false;
  }

  const landedRel = movedIdx === -1 ? -1 : nextMine[movedIdx];
  const allowedCaptures = new Map<number, Set<number>>();
  if (landedRel >= 0 && landedRel < LUDO_STRETCH_START) {
    for (let s = 0; s < prev.length; s++) {
      if (s === moverIdx) continue;
      for (const pi of ludoCaptured(landedRel, moverEntry, prev[s], entries[s])) {
        if (!allowedCaptures.has(s)) allowedCaptures.set(s, new Set());
        allowedCaptures.get(s)!.add(pi);
      }
    }
  }

  // Other seats: unchanged except captured pieces -> -1.
  for (let s = 0; s < prev.length; s++) {
    if (s === moverIdx) continue;
    const p = prev[s];
    const n = next[s];
    if (!Array.isArray(p) || !Array.isArray(n) || p.length !== 4 || n.length !== 4) return false;
    const captures = allowedCaptures.get(s) ?? new Set<number>();
    for (let i = 0; i < 4; i++) {
      if (n[i] === p[i]) continue;
      if (!(captures.has(i) && n[i] === -1)) return false;
    }
  }
  return true;
}

// ── Snakes & Ladders ───────────────────────────────────────────────────

export const SNL_BOARD_SIZE = 100;

const SNL_SNAKES: Record<number, number> = {
  16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78,
};
const SNL_LADDERS: Record<number, number> = {
  1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91,
};

export function snlResolve(pos: number): number {
  const visited = new Set<number>();
  let cur = pos;
  while (!visited.has(cur)) {
    visited.add(cur);
    if (SNL_SNAKES[cur]) cur = SNL_SNAKES[cur];
    else if (SNL_LADDERS[cur]) cur = SNL_LADDERS[cur];
    else break;
  }
  return cur;
}

/**
 * Legal result of rolling `roll` for mover index `moverIdx`: mover lands
 * on resolve(prev+roll) (or stays if overshooting 100); others unchanged.
 */
export function isLegalSnakesResult(prev: number[], next: number[], moverIdx: number, roll: number): boolean {
  for (let i = 0; i < prev.length; i++) {
    if (i === moverIdx) continue;
    if (next[i] !== prev[i]) return false;
  }
  const p = prev[moverIdx];
  const n = next[moverIdx];
  if (typeof p !== 'number' || typeof n !== 'number') return false;
  const target = p + roll;
  const expected = target > SNL_BOARD_SIZE ? p : snlResolve(target);
  return n === expected;
}

// ── Bingo ──────────────────────────────────────────────────────────────

export const BINGO_COL_RANGES: [number, number][] = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];

export function bingoPool(): number[] {
  return shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
}

export function isBingoCard(card: unknown): card is (number | 'FREE')[][] {
  if (!Array.isArray(card) || card.length !== 5) return false;
  for (let r = 0; r < 5; r++) {
    const row = card[r];
    if (!Array.isArray(row) || row.length !== 5) return false;
    for (let c = 0; c < 5; c++) {
      const v = row[c];
      if (r === 2 && c === 2) {
        if (v !== 'FREE') return false;
        continue;
      }
      if (typeof v !== 'number' || !Number.isInteger(v)) return false;
      const [lo, hi] = BINGO_COL_RANGES[c];
      if (v < lo || v > hi) return false;
    }
  }
  // Each column must have distinct numbers.
  for (let c = 0; c < 5; c++) {
    const seen = new Set<number>();
    for (let r = 0; r < 5; r++) {
      const v = card[r][c];
      if (v === 'FREE') continue;
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  return true;
}

export function isBingoMarks(marks: unknown): marks is boolean[][] {
  return (
    Array.isArray(marks) &&
    marks.length === 5 &&
    marks.every(row => Array.isArray(row) && row.length === 5 && row.every(v => typeof v === 'boolean'))
  );
}

export function bingoLineCount(marks: boolean[][]): number {
  let n = 0;
  for (let r = 0; r < 5; r++) if (marks[r].every(Boolean)) n++;
  for (let c = 0; c < 5; c++) if (marks.every(row => row[c])) n++;
  if (marks.every((row, i) => row[i])) n++;
  if (marks.every((row, i) => row[4 - i])) n++;
  return n;
}

/**
 * A Bingo claim is provable when every marked cell is FREE or a called
 * number present on that card position, and at least one line completes.
 */
export function isProvableBingoWin(card: (number | 'FREE')[][], marks: boolean[][], called: number[]): boolean {
  const calledSet = new Set(called);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!marks[r][c]) continue;
      const cell = card[r][c];
      if (cell === 'FREE') continue;
      if (!calledSet.has(cell)) return false;
    }
  }
  return bingoLineCount(marks) >= 1;
}

// ── Cube Twist ─────────────────────────────────────────────────────────
// Port of src/games/cube-twist/logic.ts (cubie model only — no three.js).

export type CubeVec3 = [number, number, number];
export type CubeAxis = 0 | 1 | 2;
export type CubeColor = 'W' | 'Y' | 'G' | 'B' | 'R' | 'O';
export interface CubeCubie {
  pos: CubeVec3;
  colors: (CubeColor | null)[];
}
export type Cube = CubeCubie[];
export interface CubeMove {
  axis: CubeAxis;
  layer: -1 | 0 | 1;
  dir: -1 | 1;
}

const CUBE_FACE_NORMALS: CubeVec3[] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];
const CUBE_FACE_COLORS: CubeColor[] = ['R', 'O', 'W', 'Y', 'G', 'B'];

export function newCube(): Cube {
  const cube: Cube = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const pos: CubeVec3 = [x, y, z];
        const colors = CUBE_FACE_NORMALS.map((n, i) =>
          n[0] * x + n[1] * y + n[2] * z === 1 &&
          (Math.abs(n[0]) * Math.abs(x) + Math.abs(n[1]) * Math.abs(y) + Math.abs(n[2]) * Math.abs(z)) === 1
            ? CUBE_FACE_COLORS[i]
            : null,
        );
        cube.push({ pos, colors });
      }
    }
  }
  return cube;
}

function cubeRotVec(v: CubeVec3, axis: CubeAxis, dir: 1 | -1): CubeVec3 {
  const [x, y, z] = v;
  if (axis === 0) return dir === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return dir === 1 ? [z, y, -x] : [-z, y, x];
  return dir === 1 ? [-y, x, z] : [y, -x, z];
}

function cubeFaceIndex(n: CubeVec3): number {
  return CUBE_FACE_NORMALS.findIndex(f => f[0] === n[0] && f[1] === n[1] && f[2] === n[2]);
}

export function applyCubeMove(cube: Cube, move: CubeMove): Cube {
  return cube.map(cubie => {
    if (cubie.pos[move.axis] !== move.layer) return cubie;
    const pos = cubeRotVec(cubie.pos, move.axis, move.dir);
    const colors: (CubeColor | null)[] = [null, null, null, null, null, null];
    for (let i = 0; i < 6; i++) {
      if (cubie.colors[i] === null) continue;
      colors[cubeFaceIndex(cubeRotVec(CUBE_FACE_NORMALS[i], move.axis, move.dir))] = cubie.colors[i];
    }
    return { pos, colors };
  });
}

export function scrambleCube(n: number): Cube {
  let cur = newCube();
  let prev: CubeMove | null = null;
  let rand = new Uint32Array(0);
  let ri = 0;
  const next = () => {
    if (ri >= rand.length) {
      rand = new Uint32Array(64);
      crypto.getRandomValues(rand);
      ri = 0;
    }
    return rand[ri++];
  };
  let applied = 0;
  while (applied < n) {
    const move: CubeMove = {
      axis: (next() % 3) as CubeAxis,
      layer: next() % 2 === 0 ? -1 : 1,
      dir: next() % 2 === 0 ? -1 : 1,
    };
    if (prev && move.axis === prev.axis && move.layer === prev.layer) continue;
    cur = applyCubeMove(cur, move);
    applied++;
    prev = move;
  }
  return cur;
}

export function cubeIsSolved(cube: Cube): boolean {
  for (let face = 0; face < 6; face++) {
    const n = CUBE_FACE_NORMALS[face];
    const axis = n.findIndex(c => c !== 0) as CubeAxis;
    const layer = n[axis];
    const stickers = cube.filter(c => c.pos[axis] === layer).map(c => c.colors[face]);
    if (stickers.length !== 9) return false;
    if (stickers.some(s => s === null || s !== stickers[0])) return false;
  }
  return true;
}

const CUBE_COLOR_SET = new Set(['W', 'Y', 'G', 'B', 'R', 'O']);

export function isCubeShape(cube: unknown): cube is Cube {
  if (!Array.isArray(cube) || cube.length !== 26) return false;
  const seen = new Set<string>();
  for (const cubie of cube) {
    if (typeof cubie !== 'object' || cubie === null) return false;
    const { pos, colors } = cubie as Record<string, unknown>;
    if (!Array.isArray(pos) || pos.length !== 3 || !pos.every(v => v === -1 || v === 0 || v === 1)) return false;
    if (pos.every(v => v === 0)) return false;
    if (!Array.isArray(colors) || colors.length !== 6) return false;
    if (!colors.every(c => c === null || CUBE_COLOR_SET.has(c as string))) return false;
    seen.add((pos as number[]).join(','));
  }
  return seen.size === 26;
}

function cubesEqual(a: Cube, b: Cube): boolean {
  if (a.length !== b.length) return false;
  const key = (c: CubeCubie) => `${c.pos.join(',')}|${c.colors.join(',')}`;
  const bs = new Map<string, number>();
  for (const c of b) {
    const k = key(c);
    bs.set(k, (bs.get(k) ?? 0) + 1);
  }
  for (const c of a) {
    const k = key(c);
    const n = bs.get(k);
    if (!n) return false;
    bs.set(k, n - 1);
  }
  return true;
}

/**
 * True when `next` is exactly one legal quarter-turn away from `prev`
 * (or identical — allowed so clients can re-submit state idempotently).
 */
export function isOneCubeTwist(prev: Cube, next: Cube): boolean {
  if (cubesEqual(prev, next)) return true;
  for (const axis of [0, 1, 2] as CubeAxis[]) {
    for (const layer of [-1, 0, 1] as const) {
      for (const dir of [-1, 1] as const) {
        if (cubesEqual(applyCubeMove(prev, { axis, layer, dir }), next)) return true;
      }
    }
  }
  return false;
}
