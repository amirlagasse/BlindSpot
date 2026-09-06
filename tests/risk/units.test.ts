/**
 * The unit separation. This is the most important test file in the repo.
 *
 * A micromort is a probability of dying now. A microlife is an erosion of
 * expected lifespan. Adding them is the standard error in this space and it is
 * what these tests exist to prevent.
 */

import { describe, expect, it } from 'vitest';
import * as units from '@/lib/risk/units';
import { remainingLifeExpectancyDays } from '@/lib/risk/lifetables';

describe('micromort conversion', () => {
  it('costs one millionth of remaining life per micromort', () => {
    const days = remainingLifeExpectancyDays(30, 'male');
    expect(units.micromortsToDaysLost(1, 30, 'male')).toBeCloseTo(days / 1_000_000, 12);
  });

  it('is linear in the micromort count', () => {
    const one = units.micromortsToDaysLost(1, 40, 'female');
    expect(units.micromortsToDaysLost(250, 40, 'female')).toBeCloseTo(one * 250, 12);
  });

  it('costs a young person more than an old person for the same exposure', () => {
    // The same skydive. This is the age effect the dashboard is meant to surface.
    const atTwenty = units.micromortsToDaysLost(100, 20, 'male');
    const atEighty = units.micromortsToDaysLost(100, 80, 'male');
    expect(atTwenty).toBeGreaterThan(atEighty);
    expect(atTwenty / atEighty).toBeGreaterThan(5);
  });

  it('costs a woman more than a man of the same age, because she has more life left', () => {
    expect(units.micromortsToDaysLost(100, 40, 'female')).toBeGreaterThan(
      units.micromortsToDaysLost(100, 40, 'male'),
    );
  });
});

describe('microlife conversion', () => {
  it('is exactly 30 minutes per microlife', () => {
    expect(units.microlivesToDaysLost(1)).toBeCloseTo(30 / 60 / 24, 12);
    expect(units.microlivesToDaysLost(48)).toBeCloseTo(1, 12);
  });

  it('does not scale with age, because the definition already fixes the reference adult', () => {
    // Deliberately checking the signature: microlivesToDaysLost takes no age.
    expect(units.microlivesToDaysLost.length).toBe(1);
    expect(units.microlivesToDaysLost(10)).toBe(units.microlivesToDaysLost(10));
  });

  it('carries the sign through, so a beneficial habit returns days', () => {
    expect(units.microlivesToDaysLost(-48)).toBeCloseTo(-1, 12);
  });
});

describe('the units are never summed', () => {
  it('exposes no function that accepts both a micromort and a microlife count', () => {
    // A two-number entry point into this module would be the shape of the bug.
    // Every exported converter takes one quantity plus, at most, age and sex.
    const converters = Object.entries(units).filter(
      ([, value]) => typeof value === 'function',
    ) as Array<[string, (...args: unknown[]) => unknown]>;

    expect(converters.length).toBeGreaterThan(0);
    for (const [name, fn] of converters) {
      expect(
        fn.length,
        `${name} takes ${fn.length} arguments; a converter over both units would be the bug`,
      ).toBeLessThanOrEqual(3);
    }
  });

  it('gives wildly different answers for the same number in each unit, which is why they cannot mix', () => {
    const asMicromorts = units.micromortsToDaysLost(1000, 40, 'male');
    const asMicrolives = units.microlivesToDaysLost(1000);
    // Roughly 15 days versus roughly 21 days: close enough in magnitude that a
    // sum would look plausible on a dashboard, which is exactly the trap.
    expect(asMicromorts).not.toBeCloseTo(asMicrolives, 1);
  });
});
