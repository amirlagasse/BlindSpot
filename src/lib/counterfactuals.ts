/**
 * "What would this become if I changed it."
 *
 * The ranked-fixes list is the screen people screenshot, and a list of problems
 * with no second column is just a list of problems. Each row needs a concrete
 * alternative: not "drive less" but "10,000 miles instead of 16,000, and here
 * is what that is worth."
 *
 * THE SUBTLETY THAT BIT ONCE. A contribution carries two numbers, and which one
 * a scenario should change depends on the factor. For an acute factor the
 * quantity is the EXPOSURE: miles, events, hours. For a chronic factor the
 * exposure is always 365.25 days and the quantity that matters is the MODIFIER:
 * cigarettes a day, BMI points above the ceiling, drinks past the first. Halving
 * the wrong one produced "halving it, to 183 a day" for a smoker on eight.
 *
 * Three rules keep these honest:
 *
 *  1. **The target has to be reachable.** Zero cigarettes is arithmetically the
 *     biggest saving and is useless as a suggestion to someone on twenty a day.
 *     Halving is a thing a person can picture doing.
 *  2. **Every saving is linear, because every factor is.** These are rates per
 *     mile, per cigarette, per drink. Nothing here models a threshold or a
 *     recovery curve, and pretending otherwise would be inventing a number.
 *  3. **A factor that gives life back is framed as more, not less.** Exercise is
 *     the only one, and telling someone to cut their gain would be absurd.
 */

import type { RiskContribution } from '@/lib/risk/types';

export interface Counterfactual {
  /** What the user would be doing instead, in plain words. */
  scenario: string;
  /** Days lost per year under that scenario. Negative is life gained. */
  daysLostPerYear: number;
  /** Days of improvement against what they do now. Always positive when shown. */
  daysGained: number;
  /** True when the row is already a gain, which changes the framing entirely. */
  isGain: boolean;
}

interface Rule {
  /**
   * Which of the contribution's two quantities the scenario changes.
   * 'exposure' for acute factors, 'modifier' for chronic ones.
   */
  scales: 'exposure' | 'modifier';
  /** The quantity under the scenario, given the current one. */
  target: (current: number) => number;
  /** The sentence, given the target quantity and the current one. */
  describe: (target: number, current: number) => string;
}

/** Round to a number a person would actually say out loud. */
const round = (value: number, to: number) => Math.round(value / to) * to;
const miles = (n: number) => Math.round(n).toLocaleString('en-US');

const RULES: Record<string, Rule> = {
  'mobility.car_day': {
    scales: 'exposure',
    target: (current) => round(current * 0.75, 500),
    describe: (target) => `Driving ${miles(target)} daylight miles instead`,
  },
  'mobility.car_night': {
    scales: 'exposure',
    target: (current) => round(current * 0.5, 250),
    describe: (target) => `Halving your night driving, to ${miles(target)} miles`,
  },
  'mobility.motorcycle': {
    scales: 'exposure',
    target: (current) => round(current * 0.5, 100),
    describe: (target) => `Halving your motorcycle miles, to ${miles(target)}`,
  },
  'chronic.cigarette': {
    scales: 'modifier',
    target: (current) => Math.max(Math.round(current / 2), 0),
    describe: (target) =>
      target === 0
        ? 'Stopping altogether'
        : `Halving it, to ${target} a day`,
  },
  'chronic.alcohol_additional_drink': {
    scales: 'modifier',
    target: () => 0,
    describe: () => 'Staying at one drink a day or under',
  },
  'chronic.bmi_excess_per_unit': {
    scales: 'modifier',
    target: (current) => current / 2,
    describe: (target, current) =>
      `Losing half of it, ${(current - target).toFixed(1)} BMI points`,
  },
  'chronic.exercise_additional_15_min': {
    scales: 'modifier',
    // One more quarter of an hour a day. A concrete, small, addable amount,
    // rather than a percentage of a number nobody thinks in.
    target: (current) => current + 1,
    describe: () => 'Fifteen more minutes a day',
  },
  'chronic.exercise_first_15_min': {
    scales: 'modifier',
    target: (current) => Math.min(current + (1 - current), 1),
    describe: (_, current) =>
      current >= 1
        ? 'Already at the dose that carries most of the benefit'
        : 'Getting to a full fifteen minutes a day',
  },
};

/**
 * The counterfactual for one contribution, or null when there is no sensible
 * one. Null is better than a filler row: a suggestion nobody can act on makes
 * the whole list look automated.
 */
export function counterfactualFor(contribution: RiskContribution): Counterfactual | null {
  const rule = RULES[contribution.factorId];
  if (!rule) return null;

  const current = rule.scales === 'exposure' ? contribution.exposure : contribution.modifier;
  if (current === 0) return null;

  const target = rule.target(current);
  if (target === current) return null;

  // Contributions are linear in both quantities, so the ratio scales the days.
  const daysLost = contribution.daysLostPerYear * (target / current);
  const daysGained = contribution.daysLostPerYear - daysLost;

  // Worth less than about fifteen minutes a year is noise, and showing it would
  // pad the list with rows that mean nothing.
  if (Math.abs(daysGained) < 0.01) return null;

  return {
    scenario: rule.describe(target, current),
    daysLostPerYear: daysLost,
    daysGained: Math.abs(daysGained),
    isGain: contribution.daysLostPerYear < 0,
  };
}
