import type { AgeBand, MinuteRange } from '@/types';

/** Who the chips are picking for. `2plus` is Home's "2 or more", both 2 and 3–4. */
export type PlayerChip = '1' | '2' | '3-4' | '2plus';

export interface PickerFilters {
  age: AgeBand | null;
  players: PlayerChip | null;
  time: 5 | 15 | null;
}

export interface PickerGame {
  age?: AgeBand;
  minutes?: MinuteRange;
  minPlayers?: number;
  maxPlayers?: number;
  passAndPlay?: { min: number; max: number };
}

export const AGE_CHIPS: { id: AgeBand; label: string }[] = [
  { id: 'everyone', label: 'Everyone' },
  { id: '4+', label: '4+' },
  { id: '7+', label: '7+' },
  { id: '10+', label: '10+' },
];

export const PLAYER_CHIPS: { id: '1' | '2' | '3-4'; label: string }[] = [
  { id: '1', label: '1' },
  { id: '2', label: '2' },
  { id: '3-4', label: '3–4' },
];

export const TIME_CHIPS: { id: 5 | 15; label: string }[] = [
  { id: 5, label: 'Under 5' },
  { id: 15, label: 'Under 15' },
];

const AGE_RANK: Record<AgeBand, number> = { everyone: 0, '4+': 4, '7+': 7, '10+': 10 };

const PLAYER_LABEL: Record<PlayerChip, string> = {
  '1': '1 player',
  '2': '2 players',
  '3-4': '3–4 players',
  '2plus': '2 or more players',
};

/** Seats the manifest already declares. No together-range means one player. */
export function playerSpan(game: PickerGame): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  if (game.passAndPlay) {
    min = Math.min(min, game.passAndPlay.min);
    max = Math.max(max, game.passAndPlay.max);
  }
  if (game.minPlayers != null || game.maxPlayers != null) {
    const lo = game.minPlayers ?? game.maxPlayers ?? 1;
    const hi = game.maxPlayers ?? game.minPlayers ?? 1;
    min = Math.min(min, lo);
    max = Math.max(max, hi);
  }
  if (min === Infinity) return { min: 1, max: 1 };
  return { min, max };
}

function matchesPlayers(span: { min: number; max: number }, chip: PlayerChip): boolean {
  if (chip === '1') return span.min <= 1 && span.max >= 1;
  if (chip === '2') return span.min <= 2 && span.max >= 2;
  if (chip === '3-4') return span.max >= 3 && span.min <= 4;
  return span.max >= 2;
}

/**
 * Age chip is the youngest person in the room (a 4+ game is too old for Everyone).
 * Time chip matches when the long end of a sitting is at most that many minutes.
 * Missing tags stay visible: the fields are optional.
 */
export function matchesPicker(game: PickerGame, filters: PickerFilters): boolean {
  if (filters.age && game.age && AGE_RANK[game.age] > AGE_RANK[filters.age]) return false;
  if (filters.time && game.minutes && game.minutes.max > filters.time) return false;
  if (filters.players && !matchesPlayers(playerSpan(game), filters.players)) return false;
  return true;
}

export function hasPickerFilters(filters: PickerFilters): boolean {
  return filters.age != null || filters.players != null || filters.time != null;
}

export function toggleAge(current: AgeBand | null, age: AgeBand): AgeBand | null {
  return current === age ? null : age;
}

export function toggleTime(current: 5 | 15 | null, time: 5 | 15): 5 | 15 | null {
  return current === time ? null : time;
}

/** 1 is exclusive. 2 and 3–4 combine into 2plus so Home can preset both. */
export function togglePlayers(current: PlayerChip | null, chip: '1' | '2' | '3-4'): PlayerChip | null {
  if (chip === '1') return current === '1' ? null : '1';
  const on = current === '2plus' ? ['2', '3-4'] : current === '2' || current === '3-4' ? [current] : [];
  const next = on.includes(chip) ? on.filter(item => item !== chip) : [...on, chip];
  if (next.length === 2) return '2plus';
  return (next[0] as '2' | '3-4' | undefined) ?? null;
}

export function playerChipOn(current: PlayerChip | null, chip: '1' | '2' | '3-4'): boolean {
  if (chip === '1') return current === '1';
  if (current === '2plus') return chip === '2' || chip === '3-4';
  return current === chip;
}

export function parsePickerParams(params: URLSearchParams): PickerFilters {
  const age = params.get('age');
  const players = params.get('players');
  const time = params.get('time');
  return {
    age: age === 'everyone' || age === '4+' || age === '7+' || age === '10+' ? age : null,
    players: players === '1' || players === '2' || players === '3-4' || players === '2plus' ? players : null,
    time: time === '5' ? 5 : time === '15' ? 15 : null,
  };
}

export function writePickerParams(params: URLSearchParams, filters: PickerFilters) {
  const set = (key: string, value: string | null) => {
    if (value == null) params.delete(key);
    else params.set(key, value);
  };
  set('age', filters.age);
  set('players', filters.players);
  set('time', filters.time == null ? null : String(filters.time));
}

export function playTogetherHref(): string {
  const params = new URLSearchParams({ tab: 'board', players: '2plus' });
  return `/games?${params.toString()}`;
}

/** Names the active chips. Null when nothing is selected, so search can keep its own line. */
export function loosenChipMessage(filters: PickerFilters, extraChips: string[] = [], search?: string): string | null {
  const chips = [
    ...extraChips,
    ...(filters.age ? [AGE_CHIPS.find(chip => chip.id === filters.age)!.label] : []),
    ...(filters.players ? [PLAYER_LABEL[filters.players]] : []),
    ...(filters.time ? [TIME_CHIPS.find(chip => chip.id === filters.time)!.label] : []),
  ];
  if (chips.length === 0) return null;
  const last = chips[chips.length - 1];
  const list = chips.length === 1
    ? last
    : chips.length === 2
      ? `${chips[0]} or ${last}`
      : `${chips.slice(0, -1).join(', ')}, or ${last}`;
  return search ? `No games match "${search}". Loosen ${list}.` : `No games match. Loosen ${list}.`;
}
