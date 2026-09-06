/**
 * Provider selection.
 *
 * Chosen by the ENVIRONMENT_PROVIDER env var, which is read once here. There is
 * no code path anywhere that falls back from live to seeded: an unset or
 * unrecognized value selects seeded, but an explicit `live` that fails will
 * throw all the way up.
 */

import { LiveEnvironmentProvider } from './live';
import { SeededEnvironmentProvider } from './seeded';
import type { EnvironmentProvider } from './types';

export type { EnvironmentProvider, Reading } from './types';
export { NotImplementedError } from './types';
export { SeededEnvironmentProvider, NATIONAL_ROAD_FATALITY_RATE, seededStates } from './seeded';
export { LiveEnvironmentProvider } from './live';

let cached: EnvironmentProvider | undefined;

export function getEnvironmentProvider(): EnvironmentProvider {
  if (!cached) {
    cached =
      process.env.ENVIRONMENT_PROVIDER === 'live'
        ? new LiveEnvironmentProvider()
        : new SeededEnvironmentProvider();
  }
  return cached;
}

/** Test seam. Resets the memoized provider so a test can switch the env var. */
export function resetEnvironmentProvider(): void {
  cached = undefined;
}
