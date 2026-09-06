/**
 * The factor registry.
 *
 * Every published coefficient the engine can apply lives in one of the domain
 * JSON files under `../data/` and is validated by Zod at module load. A factor
 * whose `source` is missing or incomplete fails validation, which means an
 * unsourced number cannot reach production even by accident.
 *
 * The tables are empty at engine version 0.x and are filled in build phase 2.
 * An empty table is not a failure state: the engine reports what it could not
 * evaluate through `EngineResult.coverage` and the dashboard says so.
 */

import { factorTableSchema } from '../schema';
import type { Domain, RiskFactor } from '../types';

import activity from '../data/activity.json';
import chronic from '../data/chronic.json';
import environment from '../data/environment.json';
import mobility from '../data/mobility.json';
import occupation from '../data/occupation.json';

const RAW_TABLES = [mobility, occupation, environment, activity, chronic];

function loadTables(): { factors: RiskFactor[]; versions: Record<string, string> } {
  const factors: RiskFactor[] = [];
  const versions: Record<string, string> = {};
  const seen = new Set<string>();

  for (const raw of RAW_TABLES) {
    const table = factorTableSchema.parse(raw);
    versions[table.domain] = table.version;

    for (const factor of table.factors) {
      if (factor.domain !== table.domain) {
        throw new Error(
          `Factor "${factor.id}" declares domain "${factor.domain}" but sits in the ${table.domain} table.`,
        );
      }
      if (seen.has(factor.id)) {
        throw new Error(`Duplicate factor id "${factor.id}".`);
      }
      seen.add(factor.id);
      factors.push(factor);
    }
  }

  return { factors, versions };
}

const { factors: FACTORS, versions: VERSIONS } = loadTables();

/** Every loaded factor, in table order. */
export function allFactors(): RiskFactor[] {
  return FACTORS;
}

export function factorsByDomain(domain: Domain): RiskFactor[] {
  return FACTORS.filter((f) => f.domain === domain);
}

/** Per-domain data versions, stamped onto every stored result for reproducibility. */
export function factorTableVersions(): Record<string, string> {
  return { ...VERSIONS };
}

/** Index a factor list by id. Engine callers may inject their own list for testing. */
export function indexFactors(factors: RiskFactor[] = FACTORS): Map<string, RiskFactor> {
  return new Map(factors.map((f) => [f.id, f]));
}
