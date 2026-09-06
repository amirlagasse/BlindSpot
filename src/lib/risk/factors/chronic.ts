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
  /** Per 5 kg over a healthy BMI, per day. */
  bmiExcessPer5kg: 'chronic.bmi_excess_per_5kg',
  /** The first 20 minutes of daily exercise, which carries most of the benefit. */
  exerciseFirst20Min: 'chronic.exercise_first_20_min',
  exerciseAdditional20Min: 'chronic.exercise_additional_20_min',
  sleepShort: 'chronic.sleep_short',
  sleepLong: 'chronic.sleep_long',
} as const;

const DAYS_PER_YEAR = 365.25;
const DAYS_PER_WEEK = 7;

/** Upper end of the healthy BMI band. Excess weight is measured from here. */
const HEALTHY_BMI_CEILING = 25;

/** The published overweight factor is denominated per 5 kg. */
const KG_PER_EXCESS_STEP = 5;

/** The exercise curve's first block, where the return is largest. */
const EXERCISE_FIRST_BLOCK_MIN = 20;
const EXERCISE_BLOCK_MIN = 20;

/** Beyond this, published curves flatten and we stop crediting additional minutes. */
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
    // Drinks are reported weekly and the published curve is per drinking day, so
    // the week is spread across seven days rather than assumed to be one binge.
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

  const excessKg = excessWeightKg(h);
  if (excessKg !== undefined && excessKg > 0) {
    add(
      CHRONIC_FACTOR_IDS.bmiExcessPer5kg,
      DAYS_PER_YEAR,
      excessKg / KG_PER_EXCESS_STEP,
      `About ${excessKg.toFixed(1)} kg above a BMI of ${HEALTHY_BMI_CEILING} at this height.`,
    );
  }

  if (h.exerciseMinutesPerWeek !== undefined && h.exerciseMinutesPerWeek > 0) {
    const perDay = Math.min(
      h.exerciseMinutesPerWeek / DAYS_PER_WEEK,
      EXERCISE_CREDITED_CEILING_MIN,
    );
    const firstBlock = Math.min(perDay, EXERCISE_FIRST_BLOCK_MIN) / EXERCISE_FIRST_BLOCK_MIN;
    const additionalBlocks = Math.max(perDay - EXERCISE_FIRST_BLOCK_MIN, 0) / EXERCISE_BLOCK_MIN;

    add(CHRONIC_FACTOR_IDS.exerciseFirst20Min, DAYS_PER_YEAR, firstBlock);
    add(
      CHRONIC_FACTOR_IDS.exerciseAdditional20Min,
      DAYS_PER_YEAR,
      additionalBlocks,
      `Credited to ${EXERCISE_CREDITED_CEILING_MIN} minutes a day, beyond which published curves flatten.`,
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

/** Kilograms above the top of the healthy BMI band. Undefined when height or weight is missing. */
export function excessWeightKg(h: HabitsInput): number | undefined {
  if (h.heightCm === undefined || h.weightKg === undefined) return undefined;
  const heightM = h.heightCm / 100;
  const healthyCeilingKg = HEALTHY_BMI_CEILING * heightM * heightM;
  return Math.max(h.weightKg - healthyCeilingKg, 0);
}

export function bmi(h: HabitsInput): number | undefined {
  if (h.heightCm === undefined || h.weightKg === undefined) return undefined;
  const heightM = h.heightCm / 100;
  return h.weightKg / (heightM * heightM);
}
