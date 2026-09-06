/**
 * Core types for the Blind Spot risk engine.
 *
 * This module is pure. Nothing here imports React, touches the network, or
 * reads the filesystem. See CLAUDE.md, "Where things live".
 *
 * The one rule that governs every type in this file: micromorts and microlives
 * are different units and are never added to each other. They are converted
 * separately into expected days of life lost per year, and only then combined.
 */

/** Sex at birth. Life tables and most published risk data are stratified on this axis only. */
export type Sex = 'male' | 'female';

/**
 * Which conversion a factor's value goes through.
 *
 * - `acute`   value is in MICROMORTS: a one-in-a-million chance of sudden death.
 *             Age-scaled on conversion, because a micromort costs a 20 year old
 *             more remaining life than it costs an 80 year old.
 * - `chronic` value is in MICROLIVES: 30 minutes of change in life expectancy.
 *             Not age-scaled; the definition already assumes a 57-year reference adult.
 */
export type FactorKind = 'acute' | 'chronic';

export type Domain =
  | 'mobility'
  | 'occupation'
  | 'environment'
  | 'activity'
  | 'chronic';

/** How the factor's `value` is denominated. Determines what the user's exposure is multiplied by. */
export type Unit =
  | 'per_event'
  | 'per_hour'
  | 'per_100_miles'
  | 'per_year'
  | 'per_day';

export type Confidence = 'high' | 'medium' | 'low';

/**
 * Provenance for a number. MANDATORY and not nullable, on every factor.
 *
 * If a real source cannot be found, the factor is omitted and recorded in
 * MISSING_DATA.md at the repo root. We ship fewer sourced factors rather than
 * more guessed ones.
 */
export interface SourceRef {
  /** Human-readable citation, specific enough to find the exact table or figure. */
  citation: string;
  url: string;
  /** Year the underlying data describes, not the year it was published. */
  year: number;
  confidence: Confidence;
}

/** A published risk coefficient. One row of the factor tables. */
export interface RiskFactor {
  id: string;
  label: string;
  domain: Domain;
  kind: FactorKind;
  unit: Unit;
  /** Micromorts when `kind` is 'acute', microlives when `kind` is 'chronic'. */
  value: number;
  /**
   * Whether the user can realistically change this.
   *
   * Drives the whole product: splitting exposure into unavoidable baseline,
   * structural (job, location, a commute that cannot be skipped) and
   * discretionary is what makes the dashboard actionable instead of fatalistic.
   */
  controllable: boolean;
  source: SourceRef;
  /**
   * Multipliers for mitigations the user reports, keyed by mitigation id
   * ('helmet', 'certified_instruction', 'buddy_system'). A value of 0.7 means
   * the mitigation removes 30% of the risk. Each carries its own source,
   * because a mitigation effect size is a published number like any other.
   */
  mitigations?: Record<string, { multiplier: number; source: SourceRef }>;
  notes?: string;
}

/** One factor evaluated against one user's exposure. */
export interface RiskContribution {
  factorId: string;
  label: string;
  domain: Domain;
  kind: FactorKind;
  controllable: boolean;
  /** The user's annual exposure in the factor's own unit (miles, events, hours, days). */
  exposure: number;
  /**
   * The multiplier applied on top of exposure.
   *
   * For a chronic factor this is where the INTENSITY lives: exposure is 365.25
   * days and the modifier is cigarettes a day, or BMI points above the ceiling.
   * For an acute factor it is usually 1, or a mitigation, or a state road-rate
   * scaling. Anything asking "what if this were half as much" has to know which
   * of the two quantities to halve, which is why this is recorded rather than
   * folded into the amount and lost.
   */
  modifier: number;
  /** Micromorts per year. Zero for chronic factors. Never added to `microlives`. */
  micromorts: number;
  /** Microlives lost per year. Zero for acute factors. Never added to `micromorts`. */
  microlives: number;
  /** The common currency. Both kinds convert into this and only this is summed. */
  daysLostPerYear: number;
  source: SourceRef;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Profile: what the user tells us                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every field except age and sex is optional. A skipped intake step degrades
 * coverage; it never breaks the result. See EngineResult.coverage.
 */
export interface Profile {
  age: number;
  sex: Sex;

  location?: LocationInput;
  occupation?: OccupationInput;
  mobility?: MobilityInput;
  activities?: ActivityInput[];
  habits?: HabitsInput;
}

export interface LocationInput {
  zip?: string;
  state?: string;
  /** Resolved by an EnvironmentProvider, not entered by the user. */
  environment?: ResolvedEnvironment;
}

/** Environment readings for a location, each carrying its own provenance. */
export interface ResolvedEnvironment {
  pm25?: { value: number; source: SourceRef };
  radonZone?: { zone: 1 | 2 | 3; source: SourceRef };
  floodZone?: { zone: string; source: SourceRef };
  traumaCenter?: { minutes: number; level: 1 | 2 | 3; source: SourceRef };
  roadFatalityRate?: { perHundredMillionVMT: number; source: SourceRef };
}

export interface OccupationInput {
  /** BLS Standard Occupational Classification code. */
  socCode: string;
  label?: string;
  hoursPerWeek?: number;
}

export interface MobilityInput {
  carMilesPerYear?: number;
  motorcycleMilesPerYear?: number;
  bicycleMilesPerYear?: number;
  walkingMilesPerYear?: number;
  transitMilesPerYear?: number;
  /** 0 to 1. Night driving carries a materially higher fatality rate per mile. */
  nightDrivingShare?: number;
  commercialFlightsPerYear?: number;
  vehicleYear?: number;
  vehicleType?: string;
}

export interface ActivityInput {
  /** Matches a RiskFactor id in the activity domain. */
  factorId: string;
  /** Events or hours per year, matching that factor's unit. */
  timesPerYear: number;
  /** Mitigation ids that apply, e.g. 'helmet', 'certified_instruction'. */
  mitigations?: string[];
}

export interface HabitsInput {
  cigarettesPerDay?: number;
  alcoholDrinksPerWeek?: number;
  exerciseMinutesPerWeek?: number;
  sleepHoursPerNight?: number;
  heightCm?: number;
  weightKg?: number;
}

/* -------------------------------------------------------------------------- */
/* Engine output                                                              */
/* -------------------------------------------------------------------------- */

export interface EngineResult {
  engineVersion: string;
  headline: {
    totalDaysLostPerYear: number;
    /**
     * Total minus the age-and-sex-matched population average. Answers "am I
     * unusual". Null when no population reference exists for this band:
     * showing a zero would read as "exactly average", which is a claim we would
     * not be able to defend. Deviation from spec section 4, recorded in
     * CLAUDE.md.
     */
    marginalDaysLostPerYear: number | null;
    /** The life-table floor. Nothing the user does removes it. */
    baselineDaysLostPerYear: number;
  };
  acute: {
    totalMicromorts: number;
    daysLost: number;
    contributions: RiskContribution[];
  };
  chronic: {
    totalMicrolives: number;
    daysLost: number;
    contributions: RiskContribution[];
  };
  /** Controllable contributions only, sorted by daysLostPerYear descending. */
  ranked: RiskContribution[];
  cohort: {
    /** Null when no published distribution covers this age band and sex. */
    percentile: number | null;
    /** Must state that this is against published averages, not other app users. */
    comparisonBasis: string;
  };
  /** The app must never imply completeness it does not have. */
  coverage: {
    factorsEvaluated: number;
    factorsSkippedForMissingInput: string[];
    domainsCovered: Domain[];
    domainsMissing: Domain[];
    /** Set when the population reference could not supply a marginal or a percentile. */
    populationReferenceAvailable: boolean;
  };
}
