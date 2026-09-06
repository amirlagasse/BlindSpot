/**
 * The SSA period life table, and the baseline hazard derived from it.
 *
 * These tests check shape and monotonicity rather than pinning every value: the
 * table is real data and pinning it would mean rewriting the suite on every
 * annual update. The three anchor values below are checked because a silent
 * change to them would mean the file was replaced with something else entirely.
 */

import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_YEAR,
  LIFE_TABLE_SOURCE,
  MAX_AGE,
  MIN_AGE,
  annualDeathProbability,
  baselineDaysLostPerYear,
  baselineMicromorts,
  remainingLifeExpectancyDays,
  remainingLifeExpectancyYears,
} from '@/lib/risk/lifetables';

describe('the table itself', () => {
  it('covers every single year of age from 0 to 119', () => {
    expect(MIN_AGE).toBe(0);
    expect(MAX_AGE).toBe(119);
  });

  it('carries a real citation, because nothing in this repo ships without one', () => {
    expect(LIFE_TABLE_SOURCE.url).toContain('ssa.gov');
    expect(LIFE_TABLE_SOURCE.year).toBe(2023);
    expect(LIFE_TABLE_SOURCE.confidence).toBe('high');
    expect(LIFE_TABLE_SOURCE.citation.length).toBeGreaterThan(40);
  });

  it('matches the published life expectancy at birth', () => {
    expect(remainingLifeExpectancyYears(0, 'male')).toBe(75.79);
    expect(remainingLifeExpectancyYears(0, 'female')).toBe(81.06);
  });
});

describe('life expectancy', () => {
  it('falls with age', () => {
    for (let age = 1; age <= MAX_AGE; age += 1) {
      expect(remainingLifeExpectancyYears(age, 'male')).toBeLessThanOrEqual(
        remainingLifeExpectancyYears(age - 1, 'male'),
      );
    }
  });

  it('is higher for women at every adult age', () => {
    for (let age = 18; age <= 100; age += 1) {
      expect(remainingLifeExpectancyYears(age, 'female')).toBeGreaterThan(
        remainingLifeExpectancyYears(age, 'male'),
      );
    }
  });

  it('converts to days with a leap-year-aware year length', () => {
    expect(remainingLifeExpectancyDays(40, 'male')).toBeCloseTo(
      remainingLifeExpectancyYears(40, 'male') * DAYS_PER_YEAR,
      9,
    );
  });

  it('clamps rather than throwing outside the table', () => {
    expect(remainingLifeExpectancyYears(-5, 'male')).toBe(
      remainingLifeExpectancyYears(0, 'male'),
    );
    expect(remainingLifeExpectancyYears(500, 'female')).toBe(
      remainingLifeExpectancyYears(MAX_AGE, 'female'),
    );
  });
});

describe('baseline hazard', () => {
  it('is a probability between 0 and 1 at every age', () => {
    for (let age = MIN_AGE; age <= MAX_AGE; age += 1) {
      const q = annualDeathProbability(age, 'male');
      expect(q).toBeGreaterThan(0);
      expect(q).toBeLessThanOrEqual(1);
    }
  });

  it('rises steeply with age across adulthood', () => {
    expect(annualDeathProbability(70, 'male')).toBeGreaterThan(
      annualDeathProbability(30, 'male') * 10,
    );
  });

  it('expresses itself in micromorts as well as days', () => {
    const age = 45;
    expect(baselineMicromorts(age, 'female')).toBeCloseTo(
      annualDeathProbability(age, 'female') * 1_000_000,
      6,
    );
    expect(baselineDaysLostPerYear(age, 'female')).toBeCloseTo(
      annualDeathProbability(age, 'female') * remainingLifeExpectancyDays(age, 'female'),
      9,
    );
  });

  it('is never zero, because nothing the user does removes it', () => {
    expect(baselineDaysLostPerYear(25, 'female')).toBeGreaterThan(0);
  });
});
