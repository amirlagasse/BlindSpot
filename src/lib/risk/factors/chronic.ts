/**
 * Habits: the chronic domain, denominated in microlives.
 *
 * Nothing in this file produces micromorts. Chronic exposures erode expected
 * lifespan; they do not carry a probability of dying today. Keeping the two
 * domains in separate modules is part of how the unit separation is enforced.
 *
 * Several of these have a dose response that is not linear and not monotonic.
 * Alcohol and exercise both have a first unit that differs from subsequent
 * units, so each is split into two factors rather than fitted to a curve we
 * would then have to source.
 */

import { contribute } from './shared';
import type { DomainResult } from './shared';
import type { HabitsInput, Profile, RiskContribution, RiskFactor } from '../types';

export const CHRONIC_FACTOR_IDS = {
  /** Microlives per cigarette. Negative value means life gained, so this one is positive. */
  cigarette: 'chronic.cigarette',
  /** The first drink of the day, which published curves treat differently from the rest. */
  alcoholFirstDrink: 'chronic.alcohol_first_drink',
  alcoholAdditionalDrink: 'chronic.alcohol_additional_drink',
  /** Per 1 kg/m2 of BMI above the healthy ceiling, per day. */
  bmiExcessPerUnit: 'chronic.bmi_excess_per_unit',
  /** The first 15 minutes of daily exercise, which carries most of the benefit. */
  exerciseFirst15Min: 'chronic.exercise_first_15_min',
  exerciseAdditional15Min: 'chronic.exercise_additional_15_min',
  sleepShort: 'chronic.sleep_short',
  sleepLong: 'chronic.sleep_long',
} as const;

const DAYS_PER_YEAR = 365.25;
const DAYS_PER_WEEK = 7;

/**
 * Upper end of the healthy BMI band. Excess is measured from here, matching the
 * Global BMI Mortality Collaboration's finding that all-cause mortality is
 * minimal from 20.0 to 25.0 kg/m2 and rises log-linearly above it.
 */
const HEALTHY_BMI_CEILING = 25;

/**
 * The exercise curve's first block, where the return is largest.
 *
 * 15 minutes because that is the dose Wen et al. measured: 92 minutes a week,
 * about 15 a day, against an inactive baseline. Every additional 15 minutes
 * carries a much smaller further reduction.
 */
const EXERCISE_FIRST_BLOCK_MIN = 15;
const EXERCISE_BLOCK_MIN = 15;

/**
 * Beyond this we stop crediting additional minutes.
 *
 * Wen et al. reported the marginal benefit per additional 15 minutes without
 * naming an upper bound, and extrapolating a linear credit to a two-hour daily
 * habit would produce a life-expectancy gain no cohort has measured.
 */
const EXERCISE_CREDITED_CEILING_MIN = 60;

const SLEEP_SHORT_BELOW_HOURS = 6;
const SLEEP_LONG_ABOVE_HOURS = 9;

export function evaluateChronic(
  profile: Profile,
  factors: Map<string, RiskFactor>,
): DomainResult {
  const contributions: RiskContribution[] = [];
  const skipped: string[] = [];
  const h = profile.habits;
  if (!h) return { contributions, skipped };

  const { age, sex } = profile;

  const add = (id: string, exposure: number, modifier = 1, note?: string) => {
    if (exposure <= 0) return;
    const factor = factors.get(id);
    if (!factor) {
      skipped.push(id);
      return;
    }
    contributions.push(contribute(factor, exposure, age, sex, { modifier, note }));
  };

  if (h.cigarettesPerDay !== undefined && h.cigarettesPerDay > 0) {
    add(CHRONIC_FACTOR_IDS.cigarette, DAYS_PER_YEAR, h.cigarettesPerDay);
  }

  if (h.alcoholDrinksPerWeek !== undefined && h.alcoholDrinksPerWeek > 0) {
    // Drinks are reported weekly and the published thresholds are weekly, so the
    // week is spread across seven days rather than assumed to be one binge.
    //
    // One drink a day is about 98 g of alcohol a week, which lands almost
    // exactly on the 100 g/week threshold Wood et al. identified as the point of
    // lowest all-cause mortality. That is why the split below is at one a day.
    const perDay = h.alcoholDrinksPerWeek / DAYS_PER_WEEK;
    const firstDrinkShare = Math.min(perDay, 1);
    const additionalPerDay = Math.max(perDay - 1, 0);

    add(
      CHRONIC_FACTOR_IDS.alcoholFirstDrink,
      DAYS_PER_YEAR,
      firstDrinkShare,
      'The first daily drink is scored separately from subsequent drinks; published curves are not linear at the low end.',
    );
    add(CHRONIC_FACTOR_IDS.alcoholAdditionalDrink, DAYS_PER_YEAR, additionalPerDay);
  }

  const excessBmi = excessBmiUnits(h);
  if (excessBmi !== undefined && excessBmi > 0) {
    add(
      CHRONIC_FACTOR_IDS.bmiExcessPerUnit,
      DAYS_PER_YEAR,
      excessBmi,
      `A BMI of ${(bmi(h) as number).toFixed(1)}, which is ${excessBmi.toFixed(1)} above the healthy ceiling of ${HEALTHY_BMI_CEILING}.`,
    );
  }

  if (h.exerciseMinutesPerWeek !== undefined && h.exerciseMinutesPerWeek > 0) {
    const perDay = Math.min(
      h.exerciseMinutesPerWeek / DAYS_PER_WEEK,
      EXERCISE_CREDITED_CEILING_MIN,
    );
    const firstBlock = Math.min(perDay, EXERCISE_FIRST_BLOCK_MIN) / EXERCISE_FIRST_BLOCK_MIN;
    const additionalBlocks = Math.max(perDay - EXERCISE_FIRST_BLOCK_MIN, 0) / EXERCISE_BLOCK_MIN;

    add(CHRONIC_FACTOR_IDS.exerciseFirst15Min, DAYS_PER_YEAR, firstBlock);
    add(
      CHRONIC_FACTOR_IDS.exerciseAdditional15Min,
      DAYS_PER_YEAR,
      additionalBlocks,
      `Credited to ${EXERCISE_CREDITED_CEILING_MIN} minutes a day, beyond which no cohort has measured the marginal gain.`,
    );
  }

  if (h.sleepHoursPerNight !== undefined) {
    if (h.sleepHoursPerNight < SLEEP_SHORT_BELOW_HOURS) {
      add(CHRONIC_FACTOR_IDS.sleepShort, DAYS_PER_YEAR);
    } else if (h.sleepHoursPerNight > SLEEP_LONG_ABOVE_HOURS) {
      add(
        CHRONIC_FACTOR_IDS.sleepLong,
        DAYS_PER_YEAR,
        1,
        'Long sleep is associated with higher mortality, but the association is substantially confounded by existing illness. Treat this as a flag, not a cause.',
      );
    }
  }

  return { contributions, skipped };
}

/** BMI units above the healthy ceiling. Undefined when height or weight is missing. */
export function excessBmiUnits(h: HabitsInput): number | undefined {
  const value = bmi(h);
  if (value === undefined) return undefined;
  return Math.max(value - HEALTHY_BMI_CEILING, 0);
}

export function bmi(h: HabitsInput): number | undefined {
  if (h.heightCm === undefined || h.weightKg === undefined) return undefined;
  const heightM = h.heightCm / 100;
  return h.weightKg / (heightM * heightM);
}
