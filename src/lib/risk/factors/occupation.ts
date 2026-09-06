/**
 * Occupation. The largest discrete factor available: logging and commercial
 * fishing run one to two orders of magnitude above a desk job.
 *
 * Factor ids are `occupation.soc.<SOC code>` and carry BLS Census of Fatal
 * Occupational Injuries rates converted to micromorts per full-time year.
 *
 * Marked NOT controllable. Changing career is not a dashboard suggestion, and
 * presenting it as one would make the ranked-fixes list absurd. It belongs to
 * the structural band: worth seeing, not worth being told to fix.
 */

import { contribute } from './shared';
import type { DomainResult } from './shared';
import type { Profile, RiskContribution, RiskFactor } from '../types';

export function occupationFactorId(socCode: string): string {
  return `occupation.soc.${socCode}`;
}

/** BLS fatal injury rates are per full-time-equivalent worker, i.e. a 40 hour week. */
const FULL_TIME_HOURS_PER_WEEK = 40;

export function evaluateOccupation(
  profile: Profile,
  factors: Map<string, RiskFactor>,
): DomainResult {
  const contributions: RiskContribution[] = [];
  const skipped: string[] = [];
  const occ = profile.occupation;
  if (!occ) return { contributions, skipped };

  const id = occupationFactorId(occ.socCode);
  const factor = factors.get(id);
  if (!factor) {
    skipped.push(id);
    return { contributions, skipped };
  }

  // Hours scale the exposure linearly against a full-time year. Someone working
  // 60 hours in a hazardous trade is exposed 1.5x, which is the assumption BLS
  // rates already make when they normalize to FTE.
  const fteFraction = occ.hoursPerWeek ? occ.hoursPerWeek / FULL_TIME_HOURS_PER_WEEK : 1;

  return {
    contributions: [
      contribute(factor, fteFraction, profile.age, profile.sex, {
        note: occ.hoursPerWeek
          ? `Scaled to ${occ.hoursPerWeek} hours per week against a 40 hour full-time year.`
          : 'Assumes a full-time year; hours per week was not provided.',
      }),
    ],
    skipped,
  };
}
