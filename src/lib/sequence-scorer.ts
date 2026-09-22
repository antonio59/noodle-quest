/**
 * Order-based scoring for sequencing games (Story Builder, Routine Roadmap).
 *
 * Canonical `order` values define strict "must come before" pairs. Steps that
 * are genuinely interchangeable — declared via `swappable` pairs or `zones` —
 * are exempt, so a reasonable alternative order isn't punished. Scoring counts
 * respected strict pairs rather than exact positions, which is fairer: one
 * small mistake costs one violation, not two wrong positions.
 */

export interface SequenceItem {
  order: number;
}

export interface SequenceFlex {
  /** Canonical order pairs that may appear in either order. */
  swappable?: [number, number][];
  /** Groups of canonical orders that are mutually interchangeable. */
  zones?: number[][];
}

export interface SequenceResult {
  /** Per submitted position: false when the item takes part in an inverted strict pair. */
  flags: boolean[];
  /** Respected strict pairs / total strict pairs, 0–1. */
  accuracy: number;
  /** Number of strict pairs placed in the wrong relative order. */
  violations: number;
}

const pairKey = (a: number, b: number) => `${Math.min(a, b)}|${Math.max(a, b)}`;

export function evaluateSequence<T extends SequenceItem>(
  submitted: T[],
  flex: SequenceFlex = {},
): SequenceResult {
  const flexible = new Set<string>();
  for (const [a, b] of flex.swappable ?? []) flexible.add(pairKey(a, b));
  for (const zone of flex.zones ?? []) {
    for (let i = 0; i < zone.length; i++) {
      for (let j = i + 1; j < zone.length; j++) flexible.add(pairKey(zone[i], zone[j]));
    }
  }

  const pos = new Map(submitted.map((item, i) => [item.order, i]));
  const orders = [...pos.keys()].sort((a, b) => a - b);

  let strict = 0;
  let respected = 0;
  const bad = new Set<number>();
  for (let i = 0; i < orders.length; i++) {
    for (let j = i + 1; j < orders.length; j++) {
      const a = orders[i];
      const b = orders[j];
      if (flexible.has(pairKey(a, b))) continue;
      strict++;
      if (pos.get(a)! < pos.get(b)!) {
        respected++;
      } else {
        bad.add(a);
        bad.add(b);
      }
    }
  }

  return {
    flags: submitted.map(item => !bad.has(item.order)),
    accuracy: strict === 0 ? 1 : respected / strict,
    violations: strict - respected,
  };
}
