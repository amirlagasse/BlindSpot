/**
 * Sports and recreation. Per event or per hour.
 *
 * This is the domain people expect to dominate their number and it almost never
 * does. Showing a skydiver that their annual jumps cost less than their commute
 * is the single most useful thing this app does.
 *
 * Mitigations multiply the factor value down. Each multiplier carries its own
 * source on the factor, so an unmitigated claim like "a helmet halves it"
 * cannot be shipped without a citation.
 */

import { contribute } from './shared';
import type { DomainResult } from './shared';
import type { Profile, RiskContribution, RiskFactor } from '../types';

export function evaluateActivities(
  profile: Profile,
  factors: Map<string, RiskFactor>,
): DomainResult {
  const contributions: RiskContribution[] = [];
  const skipped: string[] = [];
  const activities = profile.activities;
  if (!activities || activities.length === 0) return { contributions, skipped };

  for (const input of activities) {
    if (input.timesPerYear <= 0) continue;

    const factor = factors.get(input.factorId);
    if (!factor) {
      skipped.push(input.factorId);
      continue;
    }

    const { multiplier, applied, ignored } = resolveMitigations(factor, input.mitigations);

    const noteParts: string[] = [];
    if (applied.length > 0) {
      noteParts.push(`Mitigations applied: ${applied.join(', ')}.`);
    }
    if (ignored.length > 0) {
      // Silently dropping a mitigation the user ticked would overstate their
      // risk without telling them why, so it is said out loud instead.
      noteParts.push(
        `No published effect size for ${ignored.join(', ')}, so it was not applied.`,
      );
    }

    contributions.push(
      contribute(factor, input.timesPerYear, profile.age, profile.sex, {
        modifier: multiplier,
        note: noteParts.join(' ') || undefined,
      }),
    );
  }

  return { contributions, skipped };
}

function resolveMitigations(
  factor: RiskFactor,
  requested: string[] | undefined,
): { multiplier: number; applied: string[]; ignored: string[] } {
  const applied: string[] = [];
  const ignored: string[] = [];
  let multiplier = 1;

  for (const id of requested ?? []) {
    const mitigation = factor.mitigations?.[id];
    if (!mitigation) {
      ignored.push(id);
      continue;
    }
    // Independence is assumed across mitigations. It is an approximation, and a
    // generous one when two mitigations address the same failure mode, so the
    // floor below stops a stack of them driving the risk to near zero.
    multiplier *= mitigation.multiplier;
    applied.push(id);
  }

  return { multiplier: Math.max(multiplier, MITIGATION_FLOOR), applied, ignored };
}

/**
 * No stack of mitigations may remove more than 80% of an activity's risk.
 *
 * Multiplying independent multipliers is optimistic when they overlap, and an
 * activity that reads as 95% safer than published is a number we cannot defend.
 */
export const MITIGATION_FLOOR = 0.2;
