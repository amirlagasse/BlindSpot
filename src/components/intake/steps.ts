/**
 * The seven intake steps, in order.
 *
 * `insight` is the sentence shown under each step's heading. It exists because
 * a long form loses people, and the fix is not a progress bar: it is telling
 * someone what a field buys them before they fill it in.
 *
 * Location's insight is the one that matters most. One ZIP code unlocks the
 * whole environment domain, which makes it the highest insight-per-keystroke
 * field in the app, and the UI says so outright.
 */

import type { IntakeStep } from '@/lib/store';

export interface StepMeta {
  /** Store key. Mirrors the `inputs.step` column in the database. */
  step: IntakeStep;
  /** URL segment. Differs from the store key where the URL reads better. */
  slug: string;
  title: string;
  insight: string;
  /** Baseline is the only step the engine cannot run without. */
  required: boolean;
}

export const STEP_META: StepMeta[] = [
  {
    step: 'baseline',
    slug: 'baseline',
    title: 'You',
    insight:
      'Age and sex set your remaining life expectancy, which is what turns every acute risk into days. Nothing else works without them.',
    required: true,
  },
  {
    step: 'location',
    slug: 'location',
    title: 'Where you live',
    insight:
      'Your ZIP is the highest-value field here. Road fatality rates vary about threefold between states, and where you are decides your air, your radon and how far you are from a trauma center.',
    required: false,
  },
  {
    step: 'work',
    slug: 'work',
    title: 'Work',
    insight:
      'The largest single difference between two otherwise identical people. Farming, fishing and forestry run seven times the average across all occupations.',
    required: false,
  },
  {
    step: 'mobility',
    slug: 'getting-around',
    title: 'Getting around',
    insight:
      'For most people this is the biggest thing they do that they never think about. Driving after dark costs three times what the same mile costs in daylight.',
    required: false,
  },
  {
    step: 'activities',
    slug: 'activities',
    title: 'What you do',
    insight:
      'Sports and recreation. Usually far smaller than people expect, which is the point.',
    required: false,
  },
  {
    step: 'habits',
    slug: 'habits',
    title: 'Habits',
    insight:
      'The chronic side. These erode life expectancy rather than carrying a chance of dying today, and they are measured in different units for that reason.',
    required: false,
  },
  {
    step: 'health',
    slug: 'health',
    title: 'Health data',
    insight:
      'Optional. An import would fill in some of the above automatically.',
    required: false,
  },
];

export const STEP_SLUGS = STEP_META.map((m) => m.slug);

export const FIRST_SLUG = STEP_META[0].slug;

export function metaForSlug(slug: string): StepMeta | null {
  return STEP_META.find((m) => m.slug === slug) ?? null;
}

export function stepForSlug(slug: string): IntakeStep | null {
  return metaForSlug(slug)?.step ?? null;
}

export function slugIndex(slug: string): number {
  return STEP_META.findIndex((m) => m.slug === slug);
}

export function nextSlug(slug: string): string | null {
  const i = slugIndex(slug);
  return i >= 0 && i < STEP_META.length - 1 ? STEP_META[i + 1].slug : null;
}

export function previousSlug(slug: string): string | null {
  const i = slugIndex(slug);
  return i > 0 ? STEP_META[i - 1].slug : null;
}
