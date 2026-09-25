// Card colours and faces shared by the solo/online table and pass & play.
import type { UnoCard, UnoColor } from './logic';

export const COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  wild: '#1e1e2e',
};

export const SYMBOL_DISPLAY: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  skip: '⊘', reverse: '⟲', draw2: '+2', wild: '🌟',
};

const SYMBOL_NAMES: Record<string, string> = { skip: 'Skip', reverse: 'Reverse', draw2: '+2' };

export function colorName(color: UnoColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

/** Readable card name for labels and recaps, e.g. "Red 7", "Blue Skip", "Wild +4". */
export function cardName(card: UnoCard): string {
  if (card.type === 'wild') return 'Wild';
  if (card.type === 'wild4') return 'Wild +4';
  return `${colorName(card.color as UnoColor)} ${SYMBOL_NAMES[card.symbol] ?? card.symbol}`;
}
