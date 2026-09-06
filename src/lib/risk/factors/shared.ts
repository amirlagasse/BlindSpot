/**
 * Shared helpers for turning a published RiskFactor plus a user's exposure into
 * a RiskContribution. Every domain evaluator goes through `contribute`, so the
 * unit conversion happens in exactly one place.
 */

import { micromortsToDaysLost, microlivesToDaysLost } from '../units';
import type { RiskContribution, RiskFactor, Sex, Unit } from '../types';

/**
 * How much of the factor's `value` the user accrues in a year.
 *
 * The exposure the caller passes is always denominated to match the factor's
 * unit: miles per year for `per_100_miles`, events per year for `per_event`,
 * hours per year for `per_hour`, days per year for `per_day`.
 */
export function annualMultiplier(unit: Unit, exposure: number): number {
  switch (unit) {
    case 'per_100_miles':
      return exposure / 100;
    case 'per_event':
    case 'per_hour':
    case 'per_day':
    case 'per_year':
      return exposure;
  }
}

export interface ContributionOptions {
  /** Multiplies the factor value. Used for mitigations and for night-driving uplift. */
  modifier?: number;
  /** Appended to the factor's own notes, for anything applied at evaluation time. */
  note?: string;
}

/**
 * Build one contribution.
 *
 * The `kind` switch below is the only place the two units diverge, and neither
 * branch ever reads the other's field: an acute factor leaves `microlives` at
 * zero and a chronic factor leaves `micromorts` at zero.
 */
export function contribute(
  factor: RiskFactor,
  exposure: number,
  age: number,
  sex: Sex,
  options: ContributionOptions = {},
): RiskContribution {
  const modifier = options.modifier ?? 1;
  const amount = factor.value * annualMultiplier(factor.unit, exposure) * modifier;

  const acute = factor.kind === 'acute';
  const micromorts = acute ? amount : 0;
  const microlives = acute ? 0 : amount;

  const notes = [factor.notes, options.note].filter(Boolean).join(' ') || undefined;

  return {
    factorId: factor.id,
    label: factor.label,
    domain: factor.domain,
    kind: factor.kind,
    controllable: factor.controllable,
    exposure,
    micromorts,
    microlives,
    daysLostPerYear: acute
      ? micromortsToDaysLost(micromorts, age, sex)
      : microlivesToDaysLost(microlives),
    source: factor.source,
    notes,
  };
}

/** What every domain evaluator returns. */
export interface DomainResult {
  contributions: RiskContribution[];
  /**
   * Factor ids the user had an input for but the tables could not supply, or
   * inputs the user skipped entirely. Surfaced through EngineResult.coverage so
   * the dashboard never implies completeness it does not have.
   */
  skipped: string[];
}
