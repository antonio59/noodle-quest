import { describe, expect, test } from 'vitest';
import { evaluateSequence } from '../sequence-scorer';

const items = (...orders: number[]) => orders.map(order => ({ order }));

describe('evaluateSequence', () => {
  test('canonical order is perfect', () => {
    const r = evaluateSequence(items(1, 2, 3, 4));
    expect(r.accuracy).toBe(1);
    expect(r.violations).toBe(0);
    expect(r.flags).toEqual([true, true, true, true]);
  });

  test('a declared swappable pair is still perfect when flipped', () => {
    const r = evaluateSequence(items(1, 3, 2, 4), { swappable: [[2, 3]] });
    expect(r.accuracy).toBe(1);
    expect(r.flags).toEqual([true, true, true, true]);
  });

  test('an undeclared adjacent swap costs exactly one pair', () => {
    // 4 items => 6 ordered pairs; flipping 2|3 violates only that pair.
    const r = evaluateSequence(items(1, 3, 2, 4));
    expect(r.violations).toBe(1);
    expect(r.accuracy).toBeCloseTo(5 / 6);
    expect(r.flags).toEqual([true, false, false, true]);
  });

  test('zones make every internal order acceptable', () => {
    const flex = { zones: [[1, 2, 3]] };
    for (const sub of [items(2, 1, 3, 4), items(3, 2, 1, 4), items(2, 3, 1, 4)]) {
      expect(evaluateSequence(sub, flex).accuracy).toBe(1);
    }
  });

  test('zone members still respect strict pairs against outsiders', () => {
    const r = evaluateSequence(items(4, 1, 2, 3), { zones: [[1, 2, 3]] });
    // 4 (outside the zone) placed first violates pairs (1,4), (2,4), (3,4).
    expect(r.violations).toBe(3);
    expect(r.flags).toEqual([false, false, false, false]);
  });

  test('swappable pairs do not chain — non-adjacent order still enforced', () => {
    // preheat can float vs mix and shape, but mix must still precede shape.
    const flex = { swappable: [[2, 3], [3, 4]] as [number, number][] };
    const floating = evaluateSequence(items(1, 3, 2, 4, 5), flex);
    expect(floating.accuracy).toBe(1);
    const inverted = evaluateSequence(items(1, 4, 3, 2, 5), flex);
    expect(inverted.violations).toBeGreaterThan(0);
    expect(inverted.flags[1]).toBe(false); // item 4 before item 2
  });

  test('full reversal violates everything', () => {
    const r = evaluateSequence(items(4, 3, 2, 1));
    expect(r.accuracy).toBe(0);
    expect(r.flags).toEqual([false, false, false, false]);
  });
});
