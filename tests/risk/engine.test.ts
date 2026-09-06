/**
 * Engine behavior end to end, against fixture factors.
 *
 * The suite is organized around the four things the spec says must be right:
 * unit separation, age scaling, baseline handling, and never implying coverage
 * the inputs do not support.
 */

import { describe, expect, it } from 'vitest';
import { computeRisk } from '@/lib/risk/engine';
import { baselineDaysLostPerYear } from '@/lib/risk/lifetables';
import { microlivesToDaysLost, micromortsToDaysLost } from '@/lib/risk/units';
import type { Profile } from '@/lib/risk/types';
import { FIXTURE_FACTORS, FIXTURE_SOURCE } from './fixtures';

const opts = { factors: FIXTURE_FACTORS };

function profile(overrides: Partial<Profile> = {}): Profile {
  return { age: 35, sex: 'male', ...overrides };
}

describe('the acute and chronic registers stay separate', () => {
  const p = profile({
    mobility: { carMilesPerYear: 10_000 },
    habits: { cigarettesPerDay: 10 },
  });

  it('never adds micromorts to microlives', () => {
    const r = computeRisk(p, opts);
    // 10,000 miles at 1 micromort per 100 miles.
    expect(r.acute.totalMicromorts).toBeCloseTo(100, 9);
    // 0.5 microlives per cigarette, 10 a day, 365.25 days.
    expect(r.chronic.totalMicrolives).toBeCloseTo(0.5 * 10 * 365.25, 6);

    // The headline is the sum of the two DAY figures, not of the two raw counts.
    const rawSum = r.acute.totalMicromorts + r.chronic.totalMicrolives;
    expect(r.headline.totalDaysLostPerYear).not.toBeCloseTo(rawSum, 3);
    expect(r.headline.totalDaysLostPerYear).toBeCloseTo(
      r.acute.daysLost + r.chronic.daysLost,
      12,
    );
  });

  it('leaves the other unit at zero on every contribution', () => {
    const r = computeRisk(p, opts);
    for (const c of r.acute.contributions) {
      expect(c.kind).toBe('acute');
      expect(c.microlives).toBe(0);
    }
    for (const c of r.chronic.contributions) {
      expect(c.kind).toBe('chronic');
      expect(c.micromorts).toBe(0);
    }
  });

  it('converts each register with its own formula', () => {
    const r = computeRisk(p, opts);
    expect(r.acute.daysLost).toBeCloseTo(
      micromortsToDaysLost(r.acute.totalMicromorts, p.age, p.sex),
      12,
    );
    expect(r.chronic.daysLost).toBeCloseTo(
      microlivesToDaysLost(r.chronic.totalMicrolives),
      12,
    );
  });
});

describe('age scaling', () => {
  const mobility = { carMilesPerYear: 12_000, motorcycleMilesPerYear: 2_000 };

  it('makes the same acute exposure cost a 25 year old more than a 75 year old', () => {
    const young = computeRisk(profile({ age: 25, mobility }), opts);
    const old = computeRisk(profile({ age: 75, mobility }), opts);

    expect(young.acute.totalMicromorts).toBeCloseTo(old.acute.totalMicromorts, 9);
    expect(young.acute.daysLost).toBeGreaterThan(old.acute.daysLost);
  });

  it('leaves the same chronic exposure costing both of them the same', () => {
    const habits = { cigarettesPerDay: 20 };
    const young = computeRisk(profile({ age: 25, habits }), opts);
    const old = computeRisk(profile({ age: 75, habits }), opts);
    expect(young.chronic.daysLost).toBeCloseTo(old.chronic.daysLost, 12);
  });
});

describe('baseline', () => {
  it('reports the life table floor regardless of what the user told us', () => {
    const bare = computeRisk(profile(), opts);
    expect(bare.headline.baselineDaysLostPerYear).toBeCloseTo(
      baselineDaysLostPerYear(35, 'male'),
      12,
    );
  });

  it('is not subtracted from the total, because the total is not all-cause mortality', () => {
    const r = computeRisk(profile({ mobility: { carMilesPerYear: 10_000 } }), opts);
    expect(r.headline.totalDaysLostPerYear).toBeLessThan(
      r.headline.baselineDaysLostPerYear,
    );
    expect(r.headline.totalDaysLostPerYear).toBeGreaterThan(0);
  });
});

describe('marginal and cohort', () => {
  it('reports both as unavailable rather than zero when no population reference exists', () => {
    const r = computeRisk(profile({ mobility: { carMilesPerYear: 10_000 } }), opts);
    // Population averages land in build phase 2. Until then, null.
    expect(r.headline.marginalDaysLostPerYear).toBeNull();
    expect(r.cohort.percentile).toBeNull();
    expect(r.coverage.populationReferenceAvailable).toBe(false);
  });

  it('states the comparison basis is published averages, not other users', () => {
    const r = computeRisk(profile(), opts);
    expect(r.cohort.comparisonBasis.toLowerCase()).toContain('not a comparison against other users');
  });
});

describe('ranked fixes', () => {
  it('contains only controllable contributions, largest first', () => {
    const r = computeRisk(
      profile({
        mobility: { carMilesPerYear: 12_000, motorcycleMilesPerYear: 3_000 },
        occupation: { socCode: '45-4021' },
        habits: { cigarettesPerDay: 15 },
      }),
      opts,
    );

    expect(r.ranked.length).toBeGreaterThan(0);
    expect(r.ranked.every((c) => c.controllable)).toBe(true);
    // Logging is the largest contribution in the fixture set but is not a fix.
    expect(r.ranked.map((c) => c.factorId)).not.toContain('occupation.soc.45-4021');

    for (let i = 1; i < r.ranked.length; i += 1) {
      expect(r.ranked[i - 1].daysLostPerYear).toBeGreaterThanOrEqual(
        r.ranked[i].daysLostPerYear,
      );
    }
  });

  it('ranks by days lost, so acute and chronic items compete on the same axis', () => {
    const r = computeRisk(
      profile({
        mobility: { carMilesPerYear: 12_000 },
        habits: { cigarettesPerDay: 20 },
      }),
      opts,
    );
    const kinds = new Set(r.ranked.map((c) => c.kind));
    expect(kinds.size).toBe(2);
  });
});

describe('coverage', () => {
  it('is honest about a profile with nothing but age and sex', () => {
    const r = computeRisk(profile(), opts);
    expect(r.coverage.factorsEvaluated).toBe(0);
    expect(r.coverage.domainsCovered).toEqual([]);
    expect(r.coverage.domainsMissing).toHaveLength(5);
    expect(r.headline.totalDaysLostPerYear).toBe(0);
  });

  it('names the domains a partly filled profile is missing', () => {
    const r = computeRisk(profile({ mobility: { carMilesPerYear: 8_000 } }), opts);
    expect(r.coverage.domainsCovered).toEqual(['mobility']);
    expect(r.coverage.domainsMissing).toContain('occupation');
    expect(r.coverage.domainsMissing).toContain('chronic');
  });

  it('records a factor the tables could not supply instead of silently dropping it', () => {
    const r = computeRisk(
      profile({ occupation: { socCode: '99-9999' } }),
      opts,
    );
    expect(r.coverage.factorsSkippedForMissingInput).toContain('occupation.soc.99-9999');
    expect(r.coverage.factorsEvaluated).toBe(0);
  });

  it('never throws on a skipped step', () => {
    expect(() => computeRisk(profile({ activities: [] }), opts)).not.toThrow();
    expect(() => computeRisk(profile({ habits: {} }), opts)).not.toThrow();
    expect(() => computeRisk(profile({ location: {} }), opts)).not.toThrow();
  });
});

describe('mobility specifics', () => {
  it('splits car miles between the day and night factors', () => {
    const r = computeRisk(
      profile({ mobility: { carMilesPerYear: 10_000, nightDrivingShare: 0.25 } }),
      opts,
    );
    const ids = r.acute.contributions.map((c) => c.factorId);
    expect(ids).toContain('mobility.car_day');
    expect(ids).toContain('mobility.car_night');

    // Night is 3x the day rate in the fixtures: 2,500 night miles at 3, plus
    // 7,500 day miles at 1, is 75 + 75.
    expect(r.acute.totalMicromorts).toBeCloseTo(150, 9);
  });

  it('treats a missing night share as zero night miles rather than guessing', () => {
    const r = computeRisk(profile({ mobility: { carMilesPerYear: 10_000 } }), opts);
    expect(r.acute.contributions.map((c) => c.factorId)).not.toContain('mobility.car_night');
    expect(r.acute.totalMicromorts).toBeCloseTo(100, 9);
  });

  it('scales car miles by the state road fatality rate when one is resolved', () => {
    const p = profile({
      mobility: { carMilesPerYear: 10_000 },
      location: {
        state: 'MS',
        environment: {
          roadFatalityRate: { perHundredMillionVMT: 2.4, source: FIXTURE_SOURCE },
        },
      },
    });
    const r = computeRisk(p, { ...opts, nationalRoadFatalityRate: 1.2 });
    expect(r.acute.totalMicromorts).toBeCloseTo(200, 9);
  });

  it('leaves car miles unscaled when the national rate is unknown', () => {
    const p = profile({
      mobility: { carMilesPerYear: 10_000 },
      location: {
        environment: {
          roadFatalityRate: { perHundredMillionVMT: 2.4, source: FIXTURE_SOURCE },
        },
      },
    });
    expect(computeRisk(p, opts).acute.totalMicromorts).toBeCloseTo(100, 9);
  });
});

describe('activity mitigations', () => {
  it('multiplies the factor down and says which mitigations applied', () => {
    const r = computeRisk(
      profile({
        activities: [
          { factorId: 'activity.skydive', timesPerYear: 50, mitigations: ['certified_instruction'] },
        ],
      }),
      opts,
    );
    expect(r.acute.totalMicromorts).toBeCloseTo(50 * 8 * 0.5, 9);
    expect(r.acute.contributions[0].notes).toContain('certified_instruction');
  });

  it('will not let a stack of mitigations remove more than 80% of the risk', () => {
    const r = computeRisk(
      profile({
        activities: [
          {
            factorId: 'activity.skydive',
            timesPerYear: 50,
            mitigations: ['certified_instruction', 'buddy_system'],
          },
        ],
      }),
      opts,
    );
    // 0.5 * 0.5 is 0.25, above the 0.2 floor, so the floor does not bite here.
    expect(r.acute.totalMicromorts).toBeCloseTo(50 * 8 * 0.25, 9);
  });

  it('says out loud when a ticked mitigation has no published effect size', () => {
    const r = computeRisk(
      profile({
        activities: [
          { factorId: 'activity.skydive', timesPerYear: 10, mitigations: ['lucky_socks'] },
        ],
      }),
      opts,
    );
    expect(r.acute.contributions[0].notes).toContain('lucky_socks');
    expect(r.acute.totalMicromorts).toBeCloseTo(80, 9);
  });
});

describe('chronic specifics', () => {
  it('credits exercise as days gained, so a contribution can be negative', () => {
    const r = computeRisk(profile({ habits: { exerciseMinutesPerWeek: 140 } }), opts);
    expect(r.chronic.totalMicrolives).toBeLessThan(0);
    expect(r.chronic.daysLost).toBeLessThan(0);
  });

  it('nets a good habit against a bad one in the headline', () => {
    const both = computeRisk(
      profile({ habits: { cigarettesPerDay: 1, exerciseMinutesPerWeek: 140 } }),
      opts,
    );
    const smokeOnly = computeRisk(profile({ habits: { cigarettesPerDay: 1 } }), opts);
    expect(both.headline.totalDaysLostPerYear).toBeLessThan(
      smokeOnly.headline.totalDaysLostPerYear,
    );
  });

  it('computes excess weight from BMI rather than asking for it', () => {
    const r = computeRisk(
      profile({ habits: { heightCm: 180, weightKg: 100 } }),
      { factors: [...FIXTURE_FACTORS, {
        id: 'chronic.bmi_excess_per_5kg',
        label: 'Excess weight',
        domain: 'chronic' as const,
        kind: 'chronic' as const,
        unit: 'per_day' as const,
        value: 1,
        controllable: true,
        source: FIXTURE_SOURCE,
      }] },
    );
    // A BMI of 25 at 180cm is 81kg, so 19kg excess, or 3.8 steps of 5kg.
    expect(r.chronic.totalMicrolives).toBeCloseTo(3.8 * 365.25, 4);
  });
});

describe('reproducibility', () => {
  it('stamps the engine version and every factor table version on the result', () => {
    const r = computeRisk(profile(), opts);
    expect(r.engineVersion).toContain('engine@0.1.0');
    expect(r.engineVersion).toContain('mobility@');
    expect(r.engineVersion).toContain('chronic@');
  });

  it('is deterministic', () => {
    const p = profile({
      mobility: { carMilesPerYear: 9_000, nightDrivingShare: 0.3 },
      habits: { cigarettesPerDay: 4, exerciseMinutesPerWeek: 90 },
    });
    expect(computeRisk(p, opts)).toEqual(computeRisk(p, opts));
  });
});
