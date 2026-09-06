/**
 * Mobility: getting around. For most users this domain ranks first, which is
 * the product's whole point. People fear the flight and ignore the drive to the
 * airport.
 *
 * Day and night driving are separate factors rather than one factor with an
 * uplift, because NHTSA publishes them as separate rates and a derived
 * multiplier would be a number without a source.
 */

import { contribute } from './shared';
import type { DomainResult } from './shared';
import type { Profile, RiskContribution, RiskFactor } from '../types';

/** Factor ids this evaluator looks for. Phase 2 fills the mobility table with these. */
export const MOBILITY_FACTOR_IDS = {
  carDay: 'mobility.car_day',
  carNight: 'mobility.car_night',
  motorcycle: 'mobility.motorcycle',
  bicycle: 'mobility.bicycle',
  walking: 'mobility.walking',
  transit: 'mobility.transit',
  commercialFlight: 'mobility.commercial_flight',
} as const;

export function evaluateMobility(
  profile: Profile,
  factors: Map<string, RiskFactor>,
  /**
   * State road fatality rate relative to the national average, from the
   * environment provider. Applied to car miles only. 1 when unknown, and the
   * absence is recorded rather than guessed at.
   */
  roadRateRelativeToNational = 1,
): DomainResult {
  const contributions: RiskContribution[] = [];
  const skipped: string[] = [];
  const m = profile.mobility;
  if (!m) return { contributions, skipped };

  const { age, sex } = profile;

  const add = (id: string, exposure: number | undefined, modifier = 1, note?: string) => {
    if (exposure === undefined || exposure <= 0) return;
    const factor = factors.get(id);
    if (!factor) {
      skipped.push(id);
      return;
    }
    contributions.push(contribute(factor, exposure, age, sex, { modifier, note }));
  };

  const carMiles = m.carMilesPerYear ?? 0;
  if (carMiles > 0) {
    // A missing night share is treated as zero night miles rather than an
    // assumed national average, so the number can only understate this factor
    // and the intake step is what fixes it.
    const nightShare = m.nightDrivingShare ?? 0;
    const note =
      roadRateRelativeToNational === 1
        ? undefined
        : `Scaled to the state road fatality rate, ${roadRateRelativeToNational.toFixed(2)}x the national average.`;
    add(MOBILITY_FACTOR_IDS.carNight, carMiles * nightShare, roadRateRelativeToNational, note);
    add(MOBILITY_FACTOR_IDS.carDay, carMiles * (1 - nightShare), roadRateRelativeToNational, note);
  }

  add(MOBILITY_FACTOR_IDS.motorcycle, m.motorcycleMilesPerYear);
  add(MOBILITY_FACTOR_IDS.bicycle, m.bicycleMilesPerYear);
  add(MOBILITY_FACTOR_IDS.walking, m.walkingMilesPerYear);
  add(MOBILITY_FACTOR_IDS.transit, m.transitMilesPerYear);
  add(MOBILITY_FACTOR_IDS.commercialFlight, m.commercialFlightsPerYear);

  return { contributions, skipped };
}
