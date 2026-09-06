/**
 * Fixture factors for engine tests.
 *
 * Deliberately NOT real published values. Round numbers make the arithmetic
 * checkable by hand, and using fixtures here means the engine suite keeps
 * passing while phase 2 replaces the real seed data underneath it.
 */

import type { RiskFactor, SourceRef } from '@/lib/risk/types';

export const FIXTURE_SOURCE: SourceRef = {
  citation: 'Test fixture. Not a real published value and never shipped.',
  url: 'https://example.org/fixture',
  year: 2024,
  confidence: 'low',
};

export function acuteFactor(overrides: Partial<RiskFactor> = {}): RiskFactor {
  return {
    id: 'mobility.car_day',
    label: 'Driving, daytime',
    domain: 'mobility',
    kind: 'acute',
    unit: 'per_100_miles',
    value: 1,
    controllable: true,
    source: FIXTURE_SOURCE,
    ...overrides,
  };
}

export function chronicFactor(overrides: Partial<RiskFactor> = {}): RiskFactor {
  return {
    id: 'chronic.cigarette',
    label: 'Cigarettes',
    domain: 'chronic',
    kind: 'chronic',
    unit: 'per_day',
    value: 0.5,
    controllable: true,
    source: FIXTURE_SOURCE,
    ...overrides,
  };
}

/** A small table covering one factor in each domain the engine evaluates. */
export const FIXTURE_FACTORS: RiskFactor[] = [
  acuteFactor(),
  acuteFactor({ id: 'mobility.car_night', label: 'Driving, night', value: 3 }),
  acuteFactor({
    id: 'mobility.motorcycle',
    label: 'Motorcycle',
    value: 30,
  }),
  acuteFactor({
    id: 'occupation.soc.45-4021',
    label: 'Logging workers',
    domain: 'occupation',
    unit: 'per_year',
    value: 1000,
    controllable: false,
  }),
  acuteFactor({
    id: 'activity.skydive',
    label: 'Skydiving',
    domain: 'activity',
    unit: 'per_event',
    value: 8,
    mitigations: {
      certified_instruction: { multiplier: 0.5, source: FIXTURE_SOURCE },
      buddy_system: { multiplier: 0.5, source: FIXTURE_SOURCE },
    },
  }),
  chronicFactor(),
  chronicFactor({
    id: 'chronic.exercise_first_20_min',
    label: 'First 20 minutes of daily exercise',
    value: -1,
  }),
  chronicFactor({
    id: 'environment.pm25_per_ugm3',
    label: 'Fine particulate matter',
    domain: 'environment',
    controllable: false,
    value: 0.01,
  }),
];
