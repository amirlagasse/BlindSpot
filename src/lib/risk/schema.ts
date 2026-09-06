/**
 * Zod schemas for everything that crosses into the engine: the seed factor
 * tables (config) and the user's profile (input).
 *
 * The factor schema is the enforcement point for the repo's hardest rule:
 * `source` is required and every field on it is required. A factor without a
 * real citation cannot be loaded, which means it cannot be shipped. It goes in
 * MISSING_DATA.md instead.
 */

import { z } from 'zod';

export const sexSchema = z.enum(['male', 'female']);
export const domainSchema = z.enum([
  'mobility',
  'occupation',
  'environment',
  'activity',
  'chronic',
]);
export const factorKindSchema = z.enum(['acute', 'chronic']);
export const unitSchema = z.enum([
  'per_event',
  'per_hour',
  'per_100_miles',
  'per_year',
  'per_day',
]);
export const confidenceSchema = z.enum(['high', 'medium', 'low']);

export const sourceRefSchema = z.object({
  citation: z.string().min(10, 'a citation must be specific enough to find the table'),
  url: z.string().url(),
  year: z.number().int().min(1900).max(2100),
  confidence: confidenceSchema,
});

export const riskFactorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  domain: domainSchema,
  kind: factorKindSchema,
  unit: unitSchema,
  value: z.number().finite(),
  controllable: z.boolean(),
  source: sourceRefSchema,
  mitigations: z
    .record(
      z.string(),
      z.object({
        // A mitigation reduces risk. Above 1 would mean it makes things worse,
        // which is a data error rather than a finding we are prepared to show.
        multiplier: z.number().min(0).max(1),
        source: sourceRefSchema,
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export const factorTableSchema = z.object({
  /** Bumped whenever a value changes, so stored results stay reproducible. */
  version: z.string().min(1),
  domain: domainSchema,
  factors: z.array(riskFactorSchema),
});

/* -------------------------------------------------------------------------- */
/* Profile input                                                              */
/* -------------------------------------------------------------------------- */

const nonNegative = z.number().finite().min(0);

export const locationInputSchema = z.object({
  zip: z
    .string()
    .regex(/^\d{5}$/, 'ZIP code must be five digits')
    .optional(),
  state: z
    .string()
    .regex(/^[A-Z]{2}$/, 'state must be a two-letter postal abbreviation')
    .optional(),
});

export const occupationInputSchema = z.object({
  socCode: z.string().min(2),
  label: z.string().optional(),
  hoursPerWeek: z.number().min(0).max(168).optional(),
});

export const mobilityInputSchema = z.object({
  carMilesPerYear: nonNegative.optional(),
  motorcycleMilesPerYear: nonNegative.optional(),
  bicycleMilesPerYear: nonNegative.optional(),
  walkingMilesPerYear: nonNegative.optional(),
  transitMilesPerYear: nonNegative.optional(),
  nightDrivingShare: z.number().min(0).max(1).optional(),
  commercialFlightsPerYear: nonNegative.optional(),
  vehicleYear: z.number().int().min(1900).max(2100).optional(),
  vehicleType: z.string().optional(),
});

export const activityInputSchema = z.object({
  factorId: z.string().min(1),
  timesPerYear: nonNegative,
  mitigations: z.array(z.string()).optional(),
});

export const habitsInputSchema = z.object({
  cigarettesPerDay: nonNegative.max(200).optional(),
  alcoholDrinksPerWeek: nonNegative.max(200).optional(),
  exerciseMinutesPerWeek: nonNegative.max(10_080).optional(),
  sleepHoursPerNight: z.number().min(0).max(24).optional(),
  heightCm: z.number().min(50).max(280).optional(),
  weightKg: z.number().min(20).max(500).optional(),
});

export const profileSchema = z.object({
  // The life table covers 0 to 119. Below 18 the product has no meaning, but the
  // engine clamps rather than throwing, so this bound is a UI-level guard.
  age: z.number().int().min(18).max(110),
  sex: sexSchema,
  location: locationInputSchema.optional(),
  occupation: occupationInputSchema.optional(),
  mobility: mobilityInputSchema.optional(),
  activities: z.array(activityInputSchema).optional(),
  habits: habitsInputSchema.optional(),
});

export type ParsedProfile = z.infer<typeof profileSchema>;
export type ParsedFactorTable = z.infer<typeof factorTableSchema>;
