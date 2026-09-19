import { describe, expect, it } from 'vitest';

import { buildMonthGrid, monthRange } from '@/lib/calendar';

describe('monthRange', () => {
  it('umfasst den ganzen Monat', () => {
    const { from, to } = monthRange(2026, 8); // September
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(8);
    expect(to.getDate()).toBe(30);
    expect(to.getMonth()).toBe(8);
  });

  it('beachtet Schaltjahre', () => {
    expect(monthRange(2028, 1).to.getDate()).toBe(29);
    expect(monthRange(2026, 1).to.getDate()).toBe(28);
  });
});

describe('buildMonthGrid', () => {
  it('liefert sechs volle Wochen', () => {
    expect(buildMonthGrid(2026, 8)).toHaveLength(42);
  });

  it('beginnt an einem Montag', () => {
    for (const month of [0, 1, 5, 11]) {
      expect(buildMonthGrid(2026, month)[0].getDay()).toBe(1);
    }
  });

  it('enthält jeden Tag des Monats', () => {
    const grid = buildMonthGrid(2026, 8);
    const daysInMonth = grid.filter((day) => day.getMonth() === 8);
    expect(daysInMonth).toHaveLength(30);
  });

  it('läuft ohne Lücke durch', () => {
    const grid = buildMonthGrid(2026, 8);
    for (let index = 1; index < grid.length; index += 1) {
      const diff = grid[index].getTime() - grid[index - 1].getTime();
      // Zwischen zwei Tagen liegen 24 Stunden, bei Zeitumstellung 23 oder 25.
      expect(diff).toBeGreaterThanOrEqual(22 * 3600_000);
      expect(diff).toBeLessThanOrEqual(26 * 3600_000);
    }
  });
});
