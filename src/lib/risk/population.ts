/**
 * Population reference data: the average profile for an age and sex, and the
 * distribution their totals fall in.
 *
 * Two separate jobs, and neither can be faked:
 *
 *  - MARGINAL exposure is the user's total minus what an average person of the
 *    same age and sex accrues from the same factor set. It is computed by
 *    running the engine over an average profile, not by subtracting the life
 *    table baseline. The life table is all-cause mortality and already contains
 *    the disease burden this app does not model; subtracting it would produce a
 *    large negative number that means nothing.
 *
 *  - COHORT PERCENTILE needs a distribution, not an average. Without published
 *    percentiles of expected days lost we cannot place a user in one, and the
 *    engine returns null rather than inventing a curve.
 *
 * Both tables are filled in build phase 2. Until then the engine reports them
 * as unavailable and the dashboard hides the lines rather than showing a zero.
 */

import { profileSchema } from './schema';
import type { Profile, Sex, SourceRef } from './types';
import data from './data/population-averages.json';

interface PopulationRow {
  /** Inclusive lower bound of the age band. */
  ageFrom: number;
  /** Inclusive upper bound. */
  ageTo: number;
  sex: Sex;
  /** The average person's inputs, in the same shape the engine takes. */
  profile: Omit<Profile, 'age' | 'sex'>;
  /**
   * Percentile breakpoints of total expected days lost per year for this band,
   * as [percentile, daysLost] pairs sorted ascending. Empty when unpublished.
   */
  percentiles: Array<[number, number]>;
}

interface PopulationData {
  version: string;
  basis: string;
  sources: SourceRef[];
  rows: PopulationRow[];
}

const POPULATION = data as unknown as PopulationData;

export const POPULATION_BASIS = POPULATION.basis;
export const POPULATION_VERSION = POPULATION.version;

function rowFor(age: number, sex: Sex): PopulationRow | undefined {
  return POPULATION.rows.find((r) => r.sex === sex && age >= r.ageFrom && age <= r.ageTo);
}

/**
 * The average person of this age and sex, as a Profile the engine can evaluate.
 * Null when no band covers them, which is the honest answer at engine 0.x.
 */
export function averageProfile(age: number, sex: Sex): Profile | null {
  const row = rowFor(age, sex);
  if (!row) return null;
  // Validated on the way out: population data is config and gets the same
  // treatment as user input.
  return profileSchema.parse({ ...row.profile, age, sex }) as Profile;
}

/**
 * Where a total sits in the published distribution, 0 to 100.
 * Null when no distribution is published for this band.
 */
export function percentileFor(age: number, sex: Sex, daysLost: number): number | null {
  const row = rowFor(age, sex);
  if (!row || row.percentiles.length === 0) return null;

  const points = [...row.percentiles].sort((a, b) => a[0] - b[0]);

  if (daysLost <= points[0][1]) return points[0][0];
  const last = points[points.length - 1];
  if (daysLost >= last[1]) return last[0];

  for (let i = 1; i < points.length; i += 1) {
    const [pLow, dLow] = points[i - 1];
    const [pHigh, dHigh] = points[i];
    if (daysLost <= dHigh) {
      const span = dHigh - dLow;
      const t = span === 0 ? 0 : (daysLost - dLow) / span;
      return pLow + t * (pHigh - pLow);
    }
  }

  return last[0];
}
