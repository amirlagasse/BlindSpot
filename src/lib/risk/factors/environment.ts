/**
 * Environment: what your address exposes you to.
 *
 * ZIP code is the highest insight-per-keystroke input in the app. One field
 * unlocks air quality, radon, flood zone, trauma center access and the state
 * road fatality rate.
 *
 * Everything here is address-derived, so nothing in this module reads the
 * profile's raw ZIP. It reads `profile.location.environment`, which an
 * EnvironmentProvider has already resolved and attached a source to. The engine
 * stays pure; the network stays in the provider.
 *
 * These factors are structural, not discretionary. `controllable` on them means
 * "changeable by moving", which is true but is not a ranked fix, so phase 2
 * marks them false and the dashboard shows them in the structural band.
 */

import { contribute } from './shared';
import type { DomainResult } from './shared';
import type { Profile, RiskContribution, RiskFactor } from '../types';

export const ENVIRONMENT_FACTOR_IDS = {
  /** Chronic, per day, per 1 ug/m3 of annual mean PM2.5. Modifier is the concentration. */
  pm25PerUgm3: 'environment.pm25_per_ugm3',
  radonZone: (zone: 1 | 2 | 3) => `environment.radon_zone_${zone}`,
  floodZone: (zone: string) => `environment.flood_zone_${zone.toLowerCase()}`,
  /** Acute, per year. Excess mortality from delayed definitive care, banded by drive time. */
  traumaAccess: (band: TraumaBand) => `environment.trauma_access_${band}`,
} as const;

export type TraumaBand = 'under_20_min' | '20_to_45_min' | 'over_45_min';

/** The golden-hour bands the trauma access factors are keyed on. */
export function traumaBandFor(minutes: number): TraumaBand {
  if (minutes < 20) return 'under_20_min';
  if (minutes <= 45) return '20_to_45_min';
  return 'over_45_min';
}

const DAYS_PER_YEAR = 365.25;

export function evaluateEnvironment(
  profile: Profile,
  factors: Map<string, RiskFactor>,
): DomainResult {
  const contributions: RiskContribution[] = [];
  const skipped: string[] = [];
  const env = profile.location?.environment;

  if (!env) {
    skipped.push('environment.*');
    return { contributions, skipped };
  }

  const { age, sex } = profile;

  const add = (id: string, exposure: number, modifier = 1, note?: string) => {
    const factor = factors.get(id);
    if (!factor) {
      skipped.push(id);
      return;
    }
    contributions.push(contribute(factor, exposure, age, sex, { modifier, note }));
  };

  if (env.pm25) {
    add(
      ENVIRONMENT_FACTOR_IDS.pm25PerUgm3,
      DAYS_PER_YEAR,
      env.pm25.value,
      `Annual mean PM2.5 of ${env.pm25.value} ug/m3. ${env.pm25.source.citation}`,
    );
  }

  if (env.radonZone) {
    add(
      ENVIRONMENT_FACTOR_IDS.radonZone(env.radonZone.zone),
      DAYS_PER_YEAR,
      1,
      `EPA radon zone ${env.radonZone.zone}. ${env.radonZone.source.citation}`,
    );
  }

  if (env.floodZone) {
    add(
      ENVIRONMENT_FACTOR_IDS.floodZone(env.floodZone.zone),
      1,
      1,
      `FEMA flood zone ${env.floodZone.zone}. ${env.floodZone.source.citation}`,
    );
  }

  if (env.traumaCenter) {
    const band = traumaBandFor(env.traumaCenter.minutes);
    add(
      ENVIRONMENT_FACTOR_IDS.traumaAccess(band),
      1,
      1,
      `Nearest level ${env.traumaCenter.level} trauma center is about ${Math.round(env.traumaCenter.minutes)} minutes away.`,
    );
  }

  return { contributions, skipped };
}

/**
 * The state road fatality rate as a multiple of the national average.
 *
 * Lives here rather than in mobility because it is address-derived, but it is
 * applied to car miles by `evaluateMobility`. Returns 1 when unknown: an
 * unknown state must not silently scale the largest factor in the app.
 */
export function roadRateRelativeToNational(
  profile: Profile,
  nationalRatePerHundredMillionVMT: number | undefined,
): number {
  const state = profile.location?.environment?.roadFatalityRate;
  if (!state || !nationalRatePerHundredMillionVMT) return 1;
  return state.perHundredMillionVMT / nationalRatePerHundredMillionVMT;
}
