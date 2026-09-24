export interface GameDefinition {
  name: string;
  emoji: string;
  description: string;
  category: GameCategory;
  stages: number;
  component: React.ComponentType<GameProps>;
  benefits?: string[];
  duration?: string;
  bestFor?: string[];
  /** If true, AI difficulty scales automatically with the player's stage progress. */
  hasAdaptiveAi?: boolean;
  tabDescription?: string;
  tabBenefits?: string[];
  /** Minimum human players for an online multiplayer session. Defaults to 2. */
  minPlayers?: number;
  /** Maximum human players for an online multiplayer session. Defaults to 2. */
  maxPlayers?: number;
  /** Seat range for pass & play on one device. Absent = not supported. */
  passAndPlay?: { min: number; max: number };
}

/** A person at the table in pass & play. */
export interface LocalSeat {
  name: string;
  avatar: string;
}

export interface MultiplayerSeat {
  id: string;
  name: string;
  avatar: string;
  seat: number;
}

/** Metadata-only definition used for game hub listing (no component import). */
export type GameMeta = Omit<GameDefinition, 'component'>;

export interface GameProps {
  stage: number;
  onScore: (points: number) => void;
  onProgress: (pct: number) => void;
  onMessage: (msg: string) => void;
  onEnd: (result: GameResult) => void;
  multiplayerState?: MultiplayerState;
  onMultiplayerMove?: (move: unknown) => void;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
  /** Total seats for games that support local N-player hot-seat
   *  (default 2: one human + one AI). Ignored by single-player games. */
  numPlayers?: number;
  /** True when the page is hidden (tab switched, screen locked, incoming call).
   *  Games that run internal timers should freeze them while paused. */
  paused?: boolean;
  /** Pass & play: every seat (1-indexed, in turn order) is a person on this
   *  device. When set, games skip the AI and report `winnerSeat` in onEnd. */
  localSeats?: LocalSeat[];
}

export interface GameResult {
  score: number;
  stars: number;
  summary: string;
  /** Pass & play only: the winning 1-indexed seat, or 0 for a draw. */
  winnerSeat?: number;
}

export interface MultiplayerState {
  sessionId: string;
  /** 1-indexed seat number of the current local player. */
  playerNumber: number;
  /** 1-indexed seat number whose turn it is. */
  currentPlayer: number;
  boardState: unknown;
  /** Kept for backwards compatibility with 2-player games; first non-self seat. */
  opponentName: string;
  opponentAvatar: string;
  /** Full roster of humans in this session. Use this for 3+ player games. */
  players?: MultiplayerSeat[];
  status: 'waiting' | 'lobby' | 'playing' | 'finished';
  winner?: number | 'draw';
}

export type GameCategory =
  | 'focus'
  | 'memory'
  | 'motor'
  | 'flexibility'
  | 'social'
  | 'sequence'
  | 'board'
  | 'breathe';

export interface Player {
  playerId: string;
  name: string;
  avatar: string;
  sessionToken: string;
  /** When true, Chat is activity-only (no free typing / GIFs). */
  kidMode?: boolean;
  theme?: 'dark' | 'light';
}

export interface Track {
  id: string;
  name: string;
  emoji: string;
  type: 'lofi' | 'focus' | 'nature' | 'meditation';
  bpm?: number;
  duration?: number;
  description: string;
}

interface Playlist {
  _id: string;
  playerId: string;
  name: string;
  trackIds: string[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

interface FeedPost {
  id: string;
  authorName: string;
  authorAvatar: string;
  type: string;
  content: string;
  gameId?: string;
  gameName?: string;
  gameEmoji?: string;
  stage?: number;
  stars?: number;
  createdAt: number;
}

interface MultiplayerInvite {
  _id: string;
  gameId: string;
  fromId: string;
  fromName: string;
  fromAvatar: string;
  toId?: string;
  toName?: string;
  inviteCode: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: number;
  expiresAt: number;
}

interface MultiplayerSession {
  _id: string;
  gameId: string;
  players: MultiplayerSeat[];
  minPlayers: number;
  maxPlayers: number;
  // Legacy mirrors
  player1Id: string;
  player1Name: string;
  player1Avatar: string;
  player2Id?: string;
  player2Name?: string;
  player2Avatar?: string;
  boardState: unknown;
  currentPlayer: number;
  status: 'waiting' | 'lobby' | 'playing' | 'finished';
  winner?: number;
  moves: unknown[];
  createdAt: number;
  updatedAt: number;
}

export const GAME_CATEGORIES: { id: GameCategory; label: string; emoji: string }[] = [
  { id: 'focus', label: 'Focus', emoji: '🎯' },
  { id: 'memory', label: 'Memory', emoji: '🧠' },
  { id: 'motor', label: 'Motor', emoji: '🖐️' },
  { id: 'flexibility', label: 'Flexibility', emoji: '🔄' },
  { id: 'social', label: 'Social', emoji: '💛' },
  { id: 'sequence', label: 'Sequence', emoji: '🔢' },
  { id: 'board', label: 'Board', emoji: '🎲' },
  { id: 'breathe', label: 'Breathe', emoji: '🌬️' },
];
