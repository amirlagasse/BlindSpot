/**
 * The seeded provider: committed JSON, no network.
 *
 * What it has is real and cited. What it does not have returns null rather than
 * a plausible-looking placeholder, and the dashboard reports the gap through
 * `EngineResult.coverage`. See MISSING_DATA.md for what each null needs.
 */

import type { EnvironmentProvider, Reading } from './types';
import type { SourceRef } from '@/lib/risk/types';
import roadRates from './data/state-road-fatality-rates.json';

interface StateRow {
  state: string;
  name: string;
  deaths: number;
  perHundredMillionVMT: number;
}

const ROAD_SOURCE = roadRates.source as SourceRef;
const ROAD_BY_STATE = new Map<string, StateRow>(
  (roadRates.states as StateRow[]).map((row) => [row.state, row]),
);

/** The national rate the state figures are expressed relative to. */
export const NATIONAL_ROAD_FATALITY_RATE = roadRates.nationalPerHundredMillionVMT;

export class SeededEnvironmentProvider implements EnvironmentProvider {
  readonly name = 'seeded';

  async getPM25(_zip: string): Promise<Reading<number> | null> {
    // EPA AQS annual summaries are not committed. See MISSING_DATA.md.
    return null;
  }

  async getRadonZone(_zip: string): Promise<Reading<1 | 2 | 3> | null> {
    // EPA Map of Radon Zones is county-level and not committed. See MISSING_DATA.md.
    return null;
  }

  async getFloodZone(_zip: string): Promise<Reading<string> | null> {
    // FEMA NFHL is not committed, and whether a flood zone carries measurable
    // individual mortality risk is itself unresolved. See MISSING_DATA.md.
    return null;
  }

  async getTraumaCenterMinutes(_zip: string): Promise<Reading<{
    minutes: number;
    level: 1 | 2 | 3;
  }> | null> {
    // Needs the American Trauma Society database plus a routing API. See MISSING_DATA.md.
    return null;
  }

  async getStateRoadFatalityRate(state: string): Promise<Reading<number> | null> {
    const row = ROAD_BY_STATE.get(state.toUpperCase());
    if (!row) return null;
    return {
      value: row.perHundredMillionVMT,
      source: ROAD_SOURCE,
      resolution: 'state',
    };
  }
}

/** Every state the seeded provider knows a road rate for. Drives the intake picker. */
export function seededStates(): Array<{ code: string; name: string }> {
  return (roadRates.states as StateRow[])
    .map((row) => ({ code: row.state, name: row.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
