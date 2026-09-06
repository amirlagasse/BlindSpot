/**
 * The risk engine.
 *
 * Pure. No React, no network, no filesystem beyond the JSON it imports at build
 * time. Give it a Profile, get an EngineResult. Everything the dashboard shows
 * comes from here.
 *
 * The invariant this file exists to protect: micromorts and microlives are
 * accumulated in separate registers and converted separately. `totalMicromorts`
 * and `totalMicrolives` are never added to each other anywhere in this module,
 * and `tests/risk/engine.test.ts` asserts it.
 */

import { evaluateActivities } from './factors/activities';
import { evaluateChronic } from './factors/chronic';
import { evaluateEnvironment, roadRateRelativeToNational } from './factors/environment';
import { allFactors, factorTableVersions, indexFactors } from './factors';
import { evaluateMobility } from './factors/mobility';
import { evaluateOccupation } from './factors/occupation';
import { baselineDaysLostPerYear } from './lifetables';
import { POPULATION_BASIS, averageProfile, percentileFor } from './population';
import { micromortsToDaysLost, microlivesToDaysLost } from './units';
import type {
  Domain,
  EngineResult,
  Profile,
  RiskContribution,
  RiskFactor,
} from './types';

/** Bump on any change to how a number is computed. Stored with every result. */
export const ENGINE_VERSION = '0.1.0';

/**
 * Below this, a contribution is left out of the ranked fixes.
 *
 * Fifteen minutes a year. A factor can legitimately evaluate to zero (the first
 * daily drink does, because the largest study found no measured excess in that
 * band) and it stays in `chronic.contributions` where that is a finding. In a
 * list headed "what you could change" it is a row that means nothing, and a
 * list padded with rows that mean nothing reads as generated.
 */
const RANKED_THRESHOLD_DAYS = 0.01;

const ALL_DOMAINS: Domain[] = [
  'mobility',
  'occupation',
  'environment',
  'activity',
  'chronic',
];

export interface EngineOptions {
  /** Overrides the loaded factor tables. Tests inject fixtures through this. */
  factors?: RiskFactor[];
  /**
   * National road fatality rate per 100 million VMT, used to express a state's
   * rate as a multiple of it. Undefined leaves car miles unscaled.
   */
  nationalRoadFatalityRate?: number;
  /**
   * Set false to skip the population comparison. The engine calls itself once
   * on an average profile to compute the marginal, and this is how that
   * recursion terminates.
   */
  comparePopulation?: boolean;
}

export function computeRisk(profile: Profile, options: EngineOptions = {}): EngineResult {
  const factorList = options.factors ?? allFactors();
  const factors = indexFactors(factorList);
  const skipped: string[] = [];

  const roadMultiplier = roadRateRelativeToNational(
    profile,
    options.nationalRoadFatalityRate,
  );

  const domainResults = [
    evaluateMobility(profile, factors, roadMultiplier),
    evaluateOccupation(profile, factors),
    evaluateEnvironment(profile, factors),
    evaluateActivities(profile, factors),
    evaluateChronic(profile, factors),
  ];

  const contributions: RiskContribution[] = [];
  for (const result of domainResults) {
    contributions.push(...result.contributions);
    skipped.push(...result.skipped);
  }

  // Two registers, filled independently. Nothing below reads across them until
  // both have been converted into days.
  const acuteContributions = contributions.filter((c) => c.kind === 'acute');
  const chronicContributions = contributions.filter((c) => c.kind === 'chronic');

  const totalMicromorts = sum(acuteContributions, (c) => c.micromorts);
  const totalMicrolives = sum(chronicContributions, (c) => c.microlives);

  const acuteDaysLost = micromortsToDaysLost(totalMicromorts, profile.age, profile.sex);
  const chronicDaysLost = microlivesToDaysLost(totalMicrolives);

  // The only legitimate addition in this file. Both operands are days.
  const totalDaysLostPerYear = acuteDaysLost + chronicDaysLost;

  const baseline = baselineDaysLostPerYear(profile.age, profile.sex);

  const populationTotal =
    options.comparePopulation === false
      ? null
      : populationTotalDaysLost(profile, { ...options, factors: factorList });

  const ranked = contributions
    .filter((c) => c.controllable && Math.abs(c.daysLostPerYear) >= RANKED_THRESHOLD_DAYS)
    .sort((a, b) => b.daysLostPerYear - a.daysLostPerYear);

  const domainsCovered = ALL_DOMAINS.filter((d) =>
    contributions.some((c) => c.domain === d),
  );

  return {
    engineVersion: versionStamp(),
    headline: {
      totalDaysLostPerYear,
      marginalDaysLostPerYear:
        populationTotal === null ? null : totalDaysLostPerYear - populationTotal,
      baselineDaysLostPerYear: baseline,
    },
    acute: {
      totalMicromorts,
      daysLost: acuteDaysLost,
      contributions: acuteContributions,
    },
    chronic: {
      totalMicrolives,
      daysLost: chronicDaysLost,
      contributions: chronicContributions,
    },
    ranked,
    cohort: {
      percentile: percentileFor(profile.age, profile.sex, totalDaysLostPerYear),
      comparisonBasis: POPULATION_BASIS,
    },
    coverage: {
      factorsEvaluated: contributions.length,
      factorsSkippedForMissingInput: dedupe(skipped),
      domainsCovered,
      domainsMissing: ALL_DOMAINS.filter((d) => !domainsCovered.includes(d)),
      populationReferenceAvailable: populationTotal !== null,
    },
  };
}

/**
 * Run the engine over the average person of this age and sex.
 *
 * `comparePopulation: false` on the inner call is what stops this recursing:
 * the average profile does not need a marginal of its own.
 */
function populationTotalDaysLost(profile: Profile, options: EngineOptions): number | null {
  const average = averageProfile(profile.age, profile.sex);
  if (!average) return null;
  return computeRisk(average, { ...options, comparePopulation: false }).headline
    .totalDaysLostPerYear;
}

/** Engine semver plus every factor table version, so a stored result is reproducible. */
function versionStamp(): string {
  const tables = Object.entries(factorTableVersions())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, version]) => `${domain}@${version}`)
    .join(',');
  return `engine@${ENGINE_VERSION};${tables}`;
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)].sort();
}
