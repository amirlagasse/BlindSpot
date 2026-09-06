'use client';

/**
 * The intake shell.
 *
 * Owns the draft, the save, and the navigation. The step forms own none of
 * those, which is what lets the Supabase store drop in later without any of
 * them changing.
 *
 * Saving is on navigation, not on every keystroke. A debounced write per
 * character would be invisible until it failed, and a form that saves when you
 * press Continue is a form whose behavior a person can predict.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Panel } from '@/components/ui/primitives';
import {
  ActivitiesForm,
  BaselineForm,
  HabitsForm,
  HealthForm,
  LocationForm,
  MobilityForm,
  WorkForm,
} from './StepForms';
import { STEP_META, metaForSlug, nextSlug, previousSlug, slugIndex } from './steps';
import { getProfileStore, isCompleted, stepPayload } from '@/lib/store';
import type { IntakeDraft } from '@/lib/store';

export function IntakeFlow({ slug }: { slug: string }) {
  const router = useRouter();
  const meta = metaForSlug(slug)!;
  const store = useMemo(() => getProfileStore(), []);

  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);

  // The draft lives in localStorage, so it cannot be read during render on the
  // server. Everything below waits for this to resolve rather than flashing an
  // empty form over a saved one.
  useEffect(() => {
    let cancelled = false;
    store.load().then((found) => {
      if (cancelled) return;
      setDraft(found);
      setPayload((stepPayload(found, meta.step) as Record<string, unknown>) ?? {});
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store, meta.step]);

  const save = useCallback(
    async (completed: boolean) => {
      const next = await store.saveStep(meta.step, payload, completed);
      setDraft(next);
      return next;
    },
    [store, meta.step, payload],
  );

  const canContinue =
    !meta.required ||
    (typeof payload.age === 'number' && typeof payload.sex === 'string');

  const goNext = async () => {
    await save(true);
    const next = nextSlug(slug);
    router.push(next ? `/intake/${next}` : '/dashboard');
  };

  const goSkip = async () => {
    // A skipped step is saved as opened but not completed, so returning to it
    // later shows an empty form rather than looking like it was answered.
    await save(false);
    const next = nextSlug(slug);
    router.push(next ? `/intake/${next}` : '/dashboard');
  };

  const back = previousSlug(slug);
  const index = slugIndex(slug);
  const isLast = index === STEP_META.length - 1;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-6">
      <StepRail current={slug} draft={draft} />

      <Panel>
        <div className="flex flex-col gap-2 border-b border-rule px-5 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-[22px] font-medium leading-tight text-ink">{meta.title}</h1>
            <span className="font-mono text-[13px] text-ink-tertiary">
              {index + 1}/{STEP_META.length}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed text-ink-secondary">{meta.insight}</p>
        </div>

        <div className="px-5 py-6">
          {!loaded ? (
            <p className="text-[14px] text-ink-secondary">Loading what you saved.</p>
          ) : (
            <StepBody slug={slug} payload={payload} onChange={setPayload} />
          )}
        </div>
      </Panel>

      <div className="flex items-center justify-between gap-4">
        <div>
          {back ? (
            <Link
              href={`/intake/${back}`}
              className="text-[14px] text-ink-secondary hover:text-ink"
            >
              Back
            </Link>
          ) : (
            <Link href="/" className="text-[14px] text-ink-secondary hover:text-ink">
              Back
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!meta.required ? (
            <Button variant="ghost" onClick={goSkip}>
              Skip
            </Button>
          ) : null}
          <Button onClick={goNext} disabled={!canContinue}>
            {isLast ? 'See your result' : 'Continue'}
          </Button>
        </div>
      </div>

      {meta.required && !canContinue && loaded ? (
        <p className="text-[13px] text-ink-secondary">
          Age and sex are the only two answers the engine cannot work without.
          Every other step can be skipped.
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StepBody({
  slug,
  payload,
  onChange,
}: {
  slug: string;
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  // Each form is typed against its own payload shape; the draft stores them
  // untyped because the `inputs` table stores jsonb. The cast is confined here.
  const as = <T,>() => payload as T;
  const set = (next: unknown) => onChange(next as Record<string, unknown>);

  switch (slug) {
    case 'baseline':
      return <BaselineForm value={as()} onChange={set} />;
    case 'location':
      return <LocationForm value={as()} onChange={set} />;
    case 'work':
      return <WorkForm value={as()} onChange={set} />;
    case 'getting-around':
      return <MobilityForm value={as()} onChange={set} />;
    case 'activities':
      return <ActivitiesForm />;
    case 'habits':
      return <HabitsForm value={as()} onChange={set} />;
    case 'health':
      return <HealthForm />;
    default:
      return null;
  }
}

/**
 * The step rail.
 *
 * A row of ticks rather than a percentage bar. A percentage implies the steps
 * are equal, and they are not: the first one is required and the last one does
 * nothing. Completed steps are filled, the current one is outlined, and every
 * one is a link, because a form you cannot jump around in is a form people
 * abandon.
 */
function StepRail({ current, draft }: { current: string; draft: IntakeDraft | null }) {
  return (
    <nav aria-label="Intake steps" className="flex items-center gap-1.5">
      {STEP_META.map((m) => {
        const done = isCompleted(draft, m.step);
        const active = m.slug === current;
        return (
          <Link
            key={m.slug}
            href={`/intake/${m.slug}`}
            aria-current={active ? 'step' : undefined}
            title={m.title}
            className="group flex-1"
          >
            <span className="sr-only">{m.title}</span>
            <span
              aria-hidden
              className={`block h-[3px] w-full transition-colors ${
                active
                  ? 'bg-ink'
                  : done
                    ? 'bg-ink-tertiary'
                    : 'bg-rule group-hover:bg-rule-strong'
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
