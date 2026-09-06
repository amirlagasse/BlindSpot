/**
 * Where the intake saves progress.
 *
 * The seven steps are resumable, which means every step writes somewhere the
 * moment it is completed. Supabase is the eventual home, but it is not
 * provisioned, so this interface exists to keep that a one-file swap rather
 * than a rewrite of the form.
 *
 * The shape mirrors the `inputs` table in supabase/migrations/0001: one row per
 * step, keyed on (profile, step), upserted in place. A localStorage
 * implementation that stores a different shape would make the migration a
 * data-conversion problem, so it stores this one.
 */

import type { Profile, Sex } from '@/lib/risk/types';

export const INTAKE_STEPS = [
  'baseline',
  'location',
  'work',
  'mobility',
  'activities',
  'habits',
  'health',
] as const;

export type IntakeStep = (typeof INTAKE_STEPS)[number];

/** One saved step. `completedAt` is null for a step opened but not finished. */
export interface StepRecord<T = unknown> {
  step: IntakeStep;
  payload: T;
  completedAt: string | null;
  updatedAt: string;
}

/**
 * The intake in progress.
 *
 * Deliberately NOT a `Profile`. A Profile is what the engine takes and requires
 * age and sex; a draft is whatever the user has entered so far, including
 * nothing. `toProfile` below is the one place the two meet, and it returns null
 * rather than filling in a default age, because a guessed age would silently
 * change every acute number on the dashboard.
 */
export interface IntakeDraft {
  profileId: string;
  steps: Partial<Record<IntakeStep, StepRecord>>;
  createdAt: string;
  updatedAt: string;
}

export interface BaselinePayload {
  age?: number;
  sex?: Sex;
}

export interface ProfileStore {
  readonly name: string;

  /** The draft in progress, or null if there is not one yet. */
  load(): Promise<IntakeDraft | null>;

  /** Write one step. Upserts on the step key, the way the `inputs` table does. */
  saveStep<T>(step: IntakeStep, payload: T, completed: boolean): Promise<IntakeDraft>;

  /** Discard everything. Used by the "start over" control, which confirms first. */
  clear(): Promise<void>;
}

/* -------------------------------------------------------------------------- */

/** A step the user has finished, as opposed to one they have merely opened. */
export function isCompleted(draft: IntakeDraft | null, step: IntakeStep): boolean {
  return Boolean(draft?.steps[step]?.completedAt);
}

export function stepPayload<T>(draft: IntakeDraft | null, step: IntakeStep): T | undefined {
  return draft?.steps[step]?.payload as T | undefined;
}

/**
 * Assemble a draft into something the engine can evaluate.
 *
 * Returns null when age or sex is missing. Everything else is optional: a
 * skipped step degrades coverage rather than breaking the result, and the
 * engine reports the gap through `EngineResult.coverage`.
 */
export function toProfile(draft: IntakeDraft | null): Profile | null {
  if (!draft) return null;

  const baseline = stepPayload<BaselinePayload>(draft, 'baseline');
  if (baseline?.age === undefined || baseline.sex === undefined) return null;

  const profile: Profile = { age: baseline.age, sex: baseline.sex };

  const location = stepPayload<Profile['location']>(draft, 'location');
  if (location && (location.zip || location.state)) profile.location = location;

  const occupation = stepPayload<Profile['occupation']>(draft, 'work');
  if (occupation?.socCode) profile.occupation = occupation;

  const mobility = stepPayload<Profile['mobility']>(draft, 'mobility');
  if (mobility && Object.keys(mobility).length > 0) profile.mobility = mobility;

  const activities = stepPayload<Profile['activities']>(draft, 'activities');
  if (activities && activities.length > 0) profile.activities = activities;

  const habits = stepPayload<Profile['habits']>(draft, 'habits');
  if (habits && Object.keys(habits).length > 0) profile.habits = habits;

  return profile;
}
