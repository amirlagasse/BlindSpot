/**
 * The environment provider interface.
 *
 * Environment data is address-derived and the eventual source is live
 * government APIs. This interface exists now so that swapping them in is a
 * one-file change, and so that the risk engine never learns what a network is.
 *
 * Two rules govern every implementation:
 *
 *  1. **Every reading carries its own source.** A PM2.5 value with no citation
 *     cannot be shown to a user, so it cannot be returned.
 *  2. **Never silently fall back from live to seeded.** If the live provider is
 *     configured and fails, the failure surfaces. A user looking at a number
 *     they believe came from the EPA must not be looking at a state average.
 */

import type { SourceRef } from '@/lib/risk/types';

export interface Reading<T> {
  value: T;
  source: SourceRef;
  /**
   * How specific the lookup actually was. A ZIP-level reading and a state
   * average are not the same claim, and the UI says which one it is showing.
   */
  resolution: 'zip' | 'county' | 'state' | 'national';
}

export interface EnvironmentProvider {
  readonly name: string;

  /** Annual mean fine particulate matter, ug/m3. */
  getPM25(zip: string): Promise<Reading<number> | null>;

  /** EPA radon zone. 1 is the highest predicted indoor level. */
  getRadonZone(zip: string): Promise<Reading<1 | 2 | 3> | null>;

  /** FEMA flood zone designation, e.g. 'AE', 'X'. */
  getFloodZone(zip: string): Promise<Reading<string> | null>;

  /** Drive time to the nearest trauma center, and its level. */
  getTraumaCenterMinutes(
    zip: string,
  ): Promise<Reading<{ minutes: number; level: 1 | 2 | 3 }> | null>;

  /** State road deaths per 100 million vehicle miles traveled. */
  getStateRoadFatalityRate(state: string): Promise<Reading<number> | null>;
}

/**
 * Thrown by the live provider for anything not yet wired up.
 *
 * Deliberately loud. The alternative, returning null, would be indistinguishable
 * from "this ZIP has no data" and would let an unimplemented method ship
 * looking like a working one.
 */
export class NotImplementedError extends Error {
  constructor(method: string, plannedSource: string) {
    super(
      `${method} is not implemented. It will call ${plannedSource}. ` +
        'The seeded provider is not a fallback: set ENVIRONMENT_PROVIDER=seeded explicitly if that is what you want.',
    );
    this.name = 'NotImplementedError';
  }
}
