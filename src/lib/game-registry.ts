import { lazy, type ComponentType } from 'react';
import type { GameMeta, GameProps } from '@/types';

/** Stored entry: metadata + pre-built lazy component. */
interface GameEntry {
  meta: GameMeta;
  LazyComponent: ComponentType<GameProps>;
}

const registry = new Map<string, GameEntry>();
const aliases = new Map<string, string>();

/**
 * Register a game with metadata and a dynamic import loader.
 * The lazy component is created here at registration time (module init),
 * not during render, satisfying react-hooks/static-components.
 */
export function registerGame(
  id: string,
  meta: GameMeta,
  loader: () => Promise<{ default: ComponentType<GameProps> }>,
) {
  registry.set(id, { meta, LazyComponent: lazy(loader) });
}

export function registerAlias(alias: string, targetId: string) {
  aliases.set(alias, targetId);
}

/** Registered id for `id`, following URL aliases (e.g. word-search → wordsearch). */
export function canonicalGameId(id: string): string {
  return registry.has(id) ? id : aliases.get(id) ?? id;
}

function resolveEntry(id: string): GameEntry | undefined {
  return registry.get(id) ?? registry.get(aliases.get(id) ?? '');
}

/** Get metadata for a game (no component import triggered). */
export function getGameMeta(id: string): (GameMeta & { id: string }) | undefined {
  const entry = resolveEntry(id);
  if (!entry) return undefined;
  return { id, ...entry.meta };
}

/** Get the pre-built lazy component for a game. */
export function getGameComponent(id: string): ComponentType<GameProps> | undefined {
  return resolveEntry(id)?.LazyComponent;
}

/** Get game metadata by id (alias for getGameMeta, kept for backward compat). */
export function getGame(id: string) {
  return getGameMeta(id);
}

export function getGameName(id: string) {
  const entry = resolveEntry(id);
  return entry ? `${entry.meta.emoji} ${entry.meta.name}` : id;
}

export function getAllGames() {
  return Array.from(registry.entries()).map(([id, entry]) => ({ id, ...entry.meta }));
}
