/**
 * Counterfactuals.
 *
 * These tests exist because of a specific bug. A contribution carries two
 * numbers: exposure and modifier. For a chronic factor the exposure is always
 * 365.25 days and the intensity lives in the modifier, so halving the exposure
 * told a smoker on eight a day to cut down to "183 a day".
 *
 * Every test below that names a unit is guarding that boundary.
 */

import { describe, expect, it } from 'vitest';
import { computeRisk } from '@/lib/risk/engine';
import { counterfactualFor } from '@/lib/counterfactuals';
import type { Profile, RiskContribution } from '@/lib/risk/types';

function contributions(profile: Profile): Map<string, RiskContribution> {
  const r = computeRisk(profile);
  return new Map([...r.acute.contributions, ...r.chronic.contributions].map((c) => [c.factorId, c]));
}

const SMOKER: Profile = {
  age: 35,
  sex: 'male',
  mobility: { carMilesPerYear: 16_000, nightDrivingShare: 0.3, motorcycleMilesPerYear: 1_200 },
  habits: {
    cigarettesPerDay: 8,
    alcoholDrinksPerWeek: 14,
    exerciseMinutesPerWeek: 120,
    heightCm: 180,
    weightKg: 95,
  },
};

describe('the exposure and modifier boundary', () => {
  const found = contributions(SMOKER);

  it('halves cigarettes a day, not days in the year', () => {
    const cf = counterfactualFor(found.get('chronic.cigarette')!);
    expect(cf).not.toBeNull();
    // Eight a day halves to four. The bug produced 183, which is 365.25 / 2.
    expect(cf!.scenario).toBe('Halving it, to 4 a day');
    expect(cf!.scenario).not.toMatch(/18[0-9]/);
  });

  it('halves BMI points, not days in the year', () => {
    const cf = counterfactualFor(found.get('chronic.bmi_excess_per_unit')!);
    // 95 kg at 1.80 m is a BMI of 29.3, so 4.3 points above the ceiling.
    expect(cf!.scenario).toBe('Losing half of it, 2.2 BMI points');
  });

  it('scales miles for an acute factor, where exposure IS the quantity', () => {
    const cf = counterfactualFor(found.get('mobility.motorcycle')!);
    expect(cf!.scenario).toBe('Halving your motorcycle miles, to 600');
  });

  it('halves the right quantity for night driving', () => {
    // 16,000 miles at a 30% night share is 4,800 night miles.
    const cf = counterfactualFor(found.get('mobility.car_night')!);
    expect(cf!.scenario).toBe('Halving your night driving, to 2,500 miles');
  });
});

describe('savings are linear and signed correctly', () => {
  const found = contributions(SMOKER);

  it('halving a cost halves the days', () => {
    const c = found.get('chronic.cigarette')!;
    const cf = counterfactualFor(c)!;
    expect(cf.daysLostPerYear).toBeCloseTo(c.daysLostPerYear / 2, 6);
    expect(cf.daysGained).toBeCloseTo(c.daysLostPerYear / 2, 6);
    expect(cf.isGain).toBe(false);
  });

  it('takes alcohol to zero when the scenario is staying under the threshold', () => {
    const cf = counterfactualFor(found.get('chronic.alcohol_additional_drink')!)!;
    expect(cf.scenario).toMatch(/one drink a day/);
    expect(cf.daysLostPerYear).toBe(0);
  });

  it('frames exercise as a gain rather than a saving', () => {
    const cf = counterfactualFor(found.get('chronic.exercise_additional_15_min')!)!;
    expect(cf.isGain).toBe(true);
    expect(cf.scenario).toBe('Fifteen more minutes a day');
    // More exercise means MORE life back, so the figure moves further negative.
    expect(cf.daysLostPerYear).toBeLessThan(
      found.get('chronic.exercise_additional_15_min')!.daysLostPerYear,
    );
    expect(cf.daysGained).toBeGreaterThan(0);
  });

  it('reports a positive gain figure whichever direction the row runs', () => {
    for (const c of found.values()) {
      const cf = counterfactualFor(c);
      if (cf) expect(cf.daysGained, c.factorId).toBeGreaterThan(0);
    }
  });
});

describe('rows with nothing to suggest', () => {
  it('returns null rather than a filler row when the exposure is zero', () => {
    const found = contributions({
      age: 35,
      sex: 'male',
      habits: { cigarettesPerDay: 0, exerciseMinutesPerWeek: 90 },
    });
    expect(found.has('chronic.cigarette')).toBe(false);
  });

  it('returns null for a factor with no rule, rather than inventing one', () => {
    const found = contributions({
      age: 35,
      sex: 'male',
      occupation: { socCode: '47-0000' },
    });
    expect(counterfactualFor(found.get('occupation.soc.47-0000')!)).toBeNull();
  });
});

describe('the ranked list', () => {
  it('leaves out a factor that evaluates to zero', () => {
    // The first daily drink is zero by design: the largest study found no
    // measured excess in that band. It is a finding, not a fix.
    const result = computeRisk(SMOKER);
    expect(result.ranked.map((c) => c.factorId)).not.toContain(
      'chronic.alcohol_first_drink',
    );
    // But it is still evaluated and still visible on the chronic side.
    expect(result.chronic.contributions.map((c) => c.factorId)).toContain(
      'chronic.alcohol_first_drink',
    );
  });

  it('offers a scenario for every ranked row a person could act on', () => {
    const result = computeRisk(SMOKER);
    const withoutScenario = result.ranked.filter((c) => !counterfactualFor(c));
    // Only the first exercise block, which is already at its target.
    expect(withoutScenario.map((c) => c.factorId)).toEqual([
      'chronic.exercise_first_15_min',
    ]);
  });
});
