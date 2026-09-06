/**
 * Validation. These tests are the enforcement mechanism for the repo's hardest
 * rule: no unsourced numbers, ever.
 *
 * A factor without a complete `source` must fail to parse, which means it
 * cannot enter the registry, which means it cannot reach a user. The rule is
 * not a convention anyone has to remember; it is a schema error.
 */

import { describe, expect, it } from 'vitest';
import {
  factorTableSchema,
  profileSchema,
  riskFactorSchema,
} from '@/lib/risk/schema';
import { acuteFactor, FIXTURE_SOURCE } from './fixtures';

describe('a factor cannot ship without a source', () => {
  it('rejects a factor with no source at all', () => {
    const { source, ...withoutSource } = acuteFactor();
    expect(source).toBeDefined();
    expect(riskFactorSchema.safeParse(withoutSource).success).toBe(false);
  });

  it('rejects a source missing any one of its fields', () => {
    for (const field of ['citation', 'url', 'year', 'confidence'] as const) {
      const partial = { ...FIXTURE_SOURCE } as Record<string, unknown>;
      delete partial[field];
      const result = riskFactorSchema.safeParse(acuteFactor({ source: partial as never }));
      expect(result.success, `a factor parsed with no source.${field}`).toBe(false);
    }
  });

  it('rejects a citation too vague to find the table again', () => {
    expect(
      riskFactorSchema.safeParse(
        acuteFactor({ source: { ...FIXTURE_SOURCE, citation: 'NHTSA' } }),
      ).success,
    ).toBe(false);
  });

  it('rejects a url that is not a url', () => {
    expect(
      riskFactorSchema.safeParse(
        acuteFactor({ source: { ...FIXTURE_SOURCE, url: 'see the pdf' } }),
      ).success,
    ).toBe(false);
  });

  it('accepts a complete one', () => {
    expect(riskFactorSchema.safeParse(acuteFactor()).success).toBe(true);
  });
});

describe('mitigations carry their own sources', () => {
  it('rejects a mitigation multiplier with no citation behind it', () => {
    expect(
      riskFactorSchema.safeParse(
        acuteFactor({ mitigations: { helmet: { multiplier: 0.5 } } as never }),
      ).success,
    ).toBe(false);
  });

  it('rejects a multiplier above 1, which would be a mitigation that harms', () => {
    expect(
      riskFactorSchema.safeParse(
        acuteFactor({ mitigations: { helmet: { multiplier: 1.4, source: FIXTURE_SOURCE } } }),
      ).success,
    ).toBe(false);
  });
});

describe('factor tables', () => {
  it('requires a version, so a stored result can be reproduced', () => {
    expect(
      factorTableSchema.safeParse({ domain: 'mobility', factors: [] }).success,
    ).toBe(false);
    expect(
      factorTableSchema.safeParse({ version: '1.0.0', domain: 'mobility', factors: [] })
        .success,
    ).toBe(true);
  });
});

describe('the registry as loaded', () => {
  it('parses every committed domain table', async () => {
    const { allFactors, factorTableVersions } = await import('@/lib/risk/factors');
    expect(() => allFactors()).not.toThrow();
    expect(Object.keys(factorTableVersions()).sort()).toEqual([
      'activity',
      'chronic',
      'environment',
      'mobility',
      'occupation',
    ]);
  });

  it('holds every loaded factor to the source rule', async () => {
    const { allFactors } = await import('@/lib/risk/factors');
    for (const factor of allFactors()) {
      expect(riskFactorSchema.safeParse(factor).success, factor.id).toBe(true);
    }
  });
});

describe('profile input', () => {
  it('requires age and sex and nothing else', () => {
    expect(profileSchema.safeParse({ age: 34, sex: 'male' }).success).toBe(true);
    expect(profileSchema.safeParse({ sex: 'male' }).success).toBe(false);
    expect(profileSchema.safeParse({ age: 34 }).success).toBe(false);
  });

  it('rejects a malformed ZIP rather than passing it to a provider', () => {
    expect(profileSchema.safeParse({ age: 34, sex: 'male', location: { zip: '9410' } }).success).toBe(false);
    expect(profileSchema.safeParse({ age: 34, sex: 'male', location: { zip: '94103' } }).success).toBe(true);
  });

  it('bounds a night driving share to a fraction', () => {
    const p = (share: number) => profileSchema.safeParse({
      age: 34, sex: 'male', mobility: { nightDrivingShare: share },
    }).success;
    expect(p(0.3)).toBe(true);
    expect(p(30)).toBe(false);
    expect(p(-0.1)).toBe(false);
  });

  it('rejects negative exposures', () => {
    expect(
      profileSchema.safeParse({ age: 34, sex: 'male', mobility: { carMilesPerYear: -100 } })
        .success,
    ).toBe(false);
  });
});
