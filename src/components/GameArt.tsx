import { useState } from 'react';
import { canonicalGameId } from '@/lib/game-registry';

interface GameArtProps {
  gameId: string;
  /** Shown instead if the tile image can't load. */
  emoji: string;
  /** Rendered size in px (tiles are square). */
  size?: number;
  className?: string;
}

/**
 * The game's illustrated tile (public/art/<id>.svg, built by `pnpm art:build`).
 * Decorative: the game's name is always shown next to it.
 */
export function GameArt({ gameId, emoji, size = 48, className = '' }: GameArtProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-hidden
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.7 }}
      >
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={`/art/${canonicalGameId(gameId)}.svg`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={`select-none flex-shrink-0 ${className}`}
    />
  );
}
