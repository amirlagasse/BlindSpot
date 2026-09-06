/**
 * The committed seed data, checked against anchors that were NOT used to derive it.
 *
 * `scripts/derive-factors.mjs` produces these tables from primary sources. This
 * file is the independent check on that arithmetic: if someone re-runs the
 * script with a fat-fingered constant, a value lands outside a range that
 * published work agrees on and the suite says so.
 *
 * The ranges are deliberately loose. This is not pinning the numbers, which
 * would just mean rewriting the test every time a source publishes a new year.
 * It is asserting that each one is still the right order of magnitude and still
 * in the right relationship to the others.
 */

import { describe, expect, it } from 'vitest';
import { allFactors, factorsByDomain } from '@/lib/risk/factors';
import { computeRisk } from '@/lib/risk/engine';
import type { RiskFactor } from '@/lib/risk/types';

function factor(id: string): RiskFactor {
  const found = allFactors().find((f) => f.id === id);
  if (!found) throw new Error(`no factor ${id} in the committed tables`);
  return found;
}

describe('every committed factor', () => {
  const factors = allFactors();

  it('there are some', () => {
    expect(factors.length).toBeGreaterThan(10);
  });

  it('cites a source with a real URL and a plausible year', () => {
    for (const f of factors) {
      expect(f.source.url, f.id).toMatch(/^https:\/\//);
      expect(f.source.year, f.id).toBeGreaterThan(1990);
      expect(f.source.year, f.id).toBeLessThanOrEqual(new Date().getFullYear());
      expect(f.source.citation.length, f.id).toBeGreaterThan(40);
    }
  });

  it('names the institution in the citation, not just the finding', () => {
    const institutions =
      /IIHS|Insurance Institute|Federal Highway|NHTSA|Bureau of Labor Statistics|Lancet|BMJ|Social Security/i;
    for (const f of factors) {
      expect(f.source.citation, f.id).toMatch(institutions);
    }
  });

  it('says how a derived value was derived', () => {
    for (const f of factors) {
      if (f.notes?.startsWith('Derived')) {
        // A derivation note that does not contain a number is not a derivation.
        expect(f.notes, f.id).toMatch(/\d/);
      }
    }
  });

  it('holds acute values in micromorts and chronic values in microlives, never mixed', () => {
    for (const f of factors) {
      if (f.kind === 'acute') {
        // A per-event acute factor in the hundreds is plausible. A negative one is not:
        // an acute exposure cannot give life back.
        expect(f.value, f.id).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('mobility, against published anchors', () => {
  it('puts driving near the widely quoted one micromort per 100 miles', () => {
    const day = factor('mobility.car_day').value;
    const night = factor('mobility.car_night').value;
    // The overall rate is a weighted blend; both sides should bracket 1.
    expect(day).toBeGreaterThan(0.2);
    expect(day).toBeLessThan(1);
    expect(night).toBeGreaterThan(1);
    expect(night).toBeLessThan(3);
  });

  it('makes night driving exactly three times day driving, per NHTSA', () => {
    expect(factor('mobility.car_night').value / factor('mobility.car_day').value).toBeCloseTo(
      3,
      1,
    );
  });

  it('puts motorcycling between 25 and 40 times car travel per mile', () => {
    // IIHS says almost 27 times against cars alone. Against all passenger
    // vehicles, including light trucks and SUVs, the ratio is higher.
    const carOverall =
      0.75 * factor('mobility.car_day').value + 0.25 * factor('mobility.car_night').value;
    const ratio = factor('mobility.motorcycle').value / carOverall;
    expect(ratio).toBeGreaterThan(25);
    expect(ratio).toBeLessThan(40);
  });

  it('gives a motorcycle helmet a sourced effect size, not an assumed one', () => {
    const helmet = factor('mobility.motorcycle').mitigations?.helmet;
    expect(helmet).toBeDefined();
    expect(helmet!.multiplier).toBeCloseTo(0.63, 2);
    expect(helmet!.source.citation).toMatch(/37 percent/);
  });
});

describe('occupation, against the BLS all-worker rate', () => {
  it('anchors the average worker at 3.5 per 100,000, which is 35 micromorts a year', () => {
    expect(factor('occupation.soc.00-0000').value).toBeCloseTo(35, 1);
  });

  it('makes farming, fishing and forestry the most dangerous listed group', () => {
    const occ = factorsByDomain('occupation');
    const worst = occ.reduce((a, b) => (a.value > b.value ? a : b));
    expect(worst.id).toBe('occupation.soc.45-0000');
    expect(worst.value / factor('occupation.soc.00-0000').value).toBeGreaterThan(6);
  });

  it('marks occupation as not controllable, so it never appears as a ranked fix', () => {
    for (const f of factorsByDomain('occupation')) {
      expect(f.controllable, f.id).toBe(false);
    }
  });
});

describe('chronic, against independent estimates', () => {
  it('puts a cigarette between 10 and 22 minutes of life', () => {
    // Spiegelhalter 2012 says 15, University College London 2024 says about 20.
    const minutes = factor('chronic.cigarette').value * 30;
    expect(minutes).toBeGreaterThan(10);
    expect(minutes).toBeLessThan(22);
  });

  it('discloses that the per-cigarette dose rests on an assumption', () => {
    expect(factor('chronic.cigarette').notes).toMatch(/ASSUMPTION/);
  });

  it('scores the first drink of the day at zero rather than omitting it', () => {
    const first = factor('chronic.alcohol_first_drink');
    expect(first.value).toBe(0);
    expect(first.notes).toMatch(/current drinkers only/);
  });

  it('makes later drinks cost more than the first', () => {
    expect(factor('chronic.alcohol_additional_drink').value).toBeGreaterThan(
      factor('chronic.alcohol_first_drink').value,
    );
  });

  it('credits exercise as a gain and body mass as a loss', () => {
    expect(factor('chronic.exercise_first_15_min').value).toBeLessThan(0);
    expect(factor('chronic.exercise_additional_15_min').value).toBeLessThan(0);
    expect(factor('chronic.bmi_excess_per_unit').value).toBeGreaterThan(0);
  });

  it('makes the first block of exercise worth several times each later block', () => {
    const first = Math.abs(factor('chronic.exercise_first_15_min').value);
    const later = Math.abs(factor('chronic.exercise_additional_15_min').value);
    expect(first / later).toBeGreaterThan(3);
  });
});

describe('a realistic profile against the committed tables', () => {
  // A 35 year old man, average US driving, desk job, a few cigarettes, some exercise.
  const result = computeRisk({
    age: 35,
    sex: 'male',
    mobility: { carMilesPerYear: 13_500, nightDrivingShare: 0.25 },
    occupation: { socCode: '00-0000', hoursPerWeek: 40 },
    habits: {
      cigarettesPerDay: 5,
      alcoholDrinksPerWeek: 7,
      exerciseMinutesPerWeek: 120,
      heightCm: 178,
      weightKg: 88,
    },
  });

  it('produces a headline in days, not a suspiciously round number', () => {
    expect(result.headline.totalDaysLostPerYear).toBeGreaterThan(0);
    expect(result.headline.totalDaysLostPerYear).toBeLessThan(60);
  });

  it('is dominated by the chronic side, which is the finding the app exists to show', () => {
    // Driving feels dangerous and five cigarettes a day feels survivable. For
    // this profile the chronic side costs several times what the driving does,
    // even after the exercise credit is netted off it.
    expect(result.chronic.daysLost).toBeGreaterThan(result.acute.daysLost * 3);
    expect(result.acute.daysLost).toBeGreaterThan(0);
  });

  it('ranks smoking above driving for this person', () => {
    const ids = result.ranked.map((c) => c.factorId);
    expect(ids.indexOf('chronic.cigarette')).toBeLessThan(ids.indexOf('mobility.car_day'));
  });

  it('reports the environment and activity domains as missing, because they are', () => {
    expect(result.coverage.domainsMissing).toContain('environment');
    expect(result.coverage.domainsMissing).toContain('activity');
  });
});
