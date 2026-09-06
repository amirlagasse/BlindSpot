/**
 * SSA period life table lookups.
 *
 * The life table does two jobs in this engine:
 *
 *  1. It supplies remaining life expectancy, which is what converts a
 *     micromort into expected days of life lost. A micromort is a
 *     one-in-a-million chance of losing everything you have left, so its
 *     expected cost is one millionth of your remaining life. This is why the
 *     same micromort costs a 20 year old more than an 80 year old.
 *
 *  2. It supplies the baseline hazard: the age-and-sex-specific annual
 *     probability of death. That is the floor. Nothing the user does removes
 *     it, and the dashboard shows it as its own segment labeled unavoidable.
 */

import table from './data/ssa-period-life-table-2023.json';
import type { Sex, SourceRef } from './types';

interface LifeTableRow {
  age: number;
  maleQx: number;
  maleEx: number;
  femaleQx: number;
  femaleEx: number;
}

const ROWS = table.rows as LifeTableRow[];

export const LIFE_TABLE_SOURCE: SourceRef = table.source as SourceRef;

export const MIN_AGE = ROWS[0].age;
export const MAX_AGE = ROWS[ROWS.length - 1].age;

export const DAYS_PER_YEAR = 365.25;

function row(age: number): LifeTableRow {
  // Ages outside the table clamp to its ends rather than throwing. A 3 year old
  // is not a plausible user, but the engine must never crash on an odd input.
  const clamped = Math.min(MAX_AGE, Math.max(MIN_AGE, Math.floor(age)));
  return ROWS[clamped - MIN_AGE];
}

/** Average remaining years of life at this exact age, from the period life table. */
export function remainingLifeExpectancyYears(age: number, sex: Sex): number {
  const r = row(age);
  return sex === 'male' ? r.maleEx : r.femaleEx;
}

/** The same figure in days. This is the denominator of the micromort conversion. */
export function remainingLifeExpectancyDays(age: number, sex: Sex): number {
  return remainingLifeExpectancyYears(age, sex) * DAYS_PER_YEAR;
}

/**
 * Probability of dying within one year at this exact age.
 *
 * This is all-cause mortality: it already contains the driving, the smoking and
 * the occupational risk of the average person of this age and sex. It is the
 * population baseline, not a residual, and the engine treats it as such.
 */
export function annualDeathProbability(age: number, sex: Sex): number {
  const r = row(age);
  return sex === 'male' ? r.maleQx : r.femaleQx;
}

/** The baseline expressed in the engine's common currency: expected days lost per year. */
export function baselineDaysLostPerYear(age: number, sex: Sex): number {
  return annualDeathProbability(age, sex) * remainingLifeExpectancyDays(age, sex);
}

/** Baseline in micromorts, for the acute panel's population comparison. */
export function baselineMicromorts(age: number, sex: Sex): number {
  return annualDeathProbability(age, sex) * 1_000_000;
}
