/**
 * Unit conversion. Read this alongside CLAUDE.md, "The unit math".
 *
 * There are two incompatible units in this domain and the standard error in
 * this space is adding them together:
 *
 *   MICROMORT  a one-in-a-million chance of sudden death from an acute event.
 *              A probability of dying now.
 *   MICROLIFE  30 minutes of change in life expectancy from a chronic
 *              exposure. An erosion of expected lifespan.
 *
 * There is deliberately no function in this module that takes both. The only
 * legitimate way to combine them is to convert each into expected days of life
 * lost per year and add those. `tests/risk/units.test.ts` asserts this.
 */

import { remainingLifeExpectancyDays } from './lifetables';
import type { Sex } from './types';

/** A microlife is 30 minutes, by definition. */
export const MINUTES_PER_MICROLIFE = 30;

const MINUTES_PER_DAY = 60 * 24;

/**
 * Expected days of life lost from a count of micromorts.
 *
 * A micromort is a one-in-a-million chance of losing all remaining life, so its
 * expected cost is one millionth of remaining life expectancy. This is
 * age-dependent on purpose: the same skydive costs a 20 year old more expected
 * life than it costs an 80 year old, and the dashboard should surface that.
 */
export function micromortsToDaysLost(micromorts: number, age: number, sex: Sex): number {
  return micromorts * (remainingLifeExpectancyDays(age, sex) / 1_000_000);
}

/**
 * Expected days of life lost from a count of microlives.
 *
 * No age scaling. The microlife definition already bakes in a 57-year reference
 * adult; scaling it again would double-count.
 */
export function microlivesToDaysLost(microlives: number): number {
  return (microlives * MINUTES_PER_MICROLIFE) / MINUTES_PER_DAY;
}

/** Days lost per micromort at this age and sex. Useful for showing the age effect directly. */
export function daysLostPerMicromort(age: number, sex: Sex): number {
  return remainingLifeExpectancyDays(age, sex) / 1_000_000;
}
