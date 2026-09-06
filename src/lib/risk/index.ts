/**
 * Public surface of the risk engine.
 *
 * Everything outside `src/lib/risk/` imports from here and from nowhere deeper,
 * so the engine's internals stay free to move.
 */

export { computeRisk, ENGINE_VERSION } from './engine';
export type { EngineOptions } from './engine';
export { allFactors, factorsByDomain, factorTableVersions } from './factors';
export {
  LIFE_TABLE_SOURCE,
  annualDeathProbability,
  baselineDaysLostPerYear,
  baselineMicromorts,
  remainingLifeExpectancyDays,
  remainingLifeExpectancyYears,
} from './lifetables';
export { POPULATION_BASIS, averageProfile, percentileFor } from './population';
export { profileSchema, riskFactorSchema, factorTableSchema } from './schema';
export {
  daysLostPerMicromort,
  micromortsToDaysLost,
  microlivesToDaysLost,
} from './units';
export type * from './types';
