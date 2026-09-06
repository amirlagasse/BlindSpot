/**
 * The environment adapter.
 *
 * The behavior worth testing here is not "does the lookup work" but "does it
 * refuse to guess". A provider that returns a plausible number for a ZIP it has
 * never seen is worse than one that returns nothing.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  LiveEnvironmentProvider,
  NATIONAL_ROAD_FATALITY_RATE,
  NotImplementedError,
  SeededEnvironmentProvider,
  getEnvironmentProvider,
  resetEnvironmentProvider,
  seededStates,
} from '@/lib/providers/environment';

afterEach(() => {
  delete process.env.ENVIRONMENT_PROVIDER;
  resetEnvironmentProvider();
});

describe('the seeded provider', () => {
  const provider = new SeededEnvironmentProvider();

  it('knows a road fatality rate for all 50 states and DC', async () => {
    expect(seededStates()).toHaveLength(51);
    for (const { code } of seededStates()) {
      const reading = await provider.getStateRoadFatalityRate(code);
      expect(reading, code).not.toBeNull();
      expect(reading!.value, code).toBeGreaterThan(0);
    }
  });

  it('cites a source and states the resolution on every reading', async () => {
    const reading = await provider.getStateRoadFatalityRate('MS');
    expect(reading!.source.url).toContain('iihs.org');
    expect(reading!.source.year).toBe(2024);
    expect(reading!.resolution).toBe('state');
  });

  it('reproduces the published spread across states', async () => {
    const worst = await provider.getStateRoadFatalityRate('MS');
    const best = await provider.getStateRoadFatalityRate('MA');
    expect(worst!.value).toBeCloseTo(1.81, 2);
    expect(best!.value).toBeCloseTo(0.59, 2);
    // About a threefold spread, which is what makes location worth asking for.
    expect(worst!.value / best!.value).toBeGreaterThan(2.5);
  });

  it('brackets the national rate, so the relative multiplier is meaningful', async () => {
    const worst = await provider.getStateRoadFatalityRate('MS');
    const best = await provider.getStateRoadFatalityRate('MA');
    expect(best!.value).toBeLessThan(NATIONAL_ROAD_FATALITY_RATE);
    expect(worst!.value).toBeGreaterThan(NATIONAL_ROAD_FATALITY_RATE);
  });

  it('returns null for a state it does not know, rather than a national average', async () => {
    expect(await provider.getStateRoadFatalityRate('ZZ')).toBeNull();
    expect(await provider.getStateRoadFatalityRate('')).toBeNull();
  });

  it('is case insensitive, because a form will send either', async () => {
    const upper = await provider.getStateRoadFatalityRate('CA');
    const lower = await provider.getStateRoadFatalityRate('ca');
    expect(lower).toEqual(upper);
  });

  it('returns null for everything it has no data for, rather than a placeholder', async () => {
    expect(await provider.getPM25('94103')).toBeNull();
    expect(await provider.getRadonZone('94103')).toBeNull();
    expect(await provider.getFloodZone('94103')).toBeNull();
    expect(await provider.getTraumaCenterMinutes('94103')).toBeNull();
  });
});

describe('the live provider', () => {
  const provider = new LiveEnvironmentProvider();

  it('throws on every method rather than degrading to seeded data', async () => {
    const calls = [
      provider.getPM25('94103'),
      provider.getRadonZone('94103'),
      provider.getFloodZone('94103'),
      provider.getTraumaCenterMinutes('94103'),
      provider.getStateRoadFatalityRate('CA'),
    ];
    for (const call of calls) {
      await expect(call).rejects.toBeInstanceOf(NotImplementedError);
    }
  });

  it('names the API each method will call, so the stub is a specification', async () => {
    await expect(provider.getPM25('94103')).rejects.toThrow(/EPA Air Quality System/);
    await expect(provider.getFloodZone('94103')).rejects.toThrow(/FEMA National Flood Hazard/);
    await expect(provider.getTraumaCenterMinutes('94103')).rejects.toThrow(
      /American Trauma Society/,
    );
  });

  it('says explicitly that seeded is not a fallback', async () => {
    await expect(provider.getPM25('94103')).rejects.toThrow(/not a fallback/);
  });
});

describe('provider selection', () => {
  it('defaults to seeded', () => {
    expect(getEnvironmentProvider().name).toBe('seeded');
  });

  it('selects live only on an exact match', () => {
    process.env.ENVIRONMENT_PROVIDER = 'live';
    resetEnvironmentProvider();
    expect(getEnvironmentProvider().name).toBe('live');

    process.env.ENVIRONMENT_PROVIDER = 'LIVE';
    resetEnvironmentProvider();
    expect(getEnvironmentProvider().name).toBe('seeded');
  });
});
