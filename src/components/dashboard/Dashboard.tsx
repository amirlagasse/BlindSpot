'use client';

/**
 * The dashboard.
 *
 * Four sections on one page, no tabs. Tabs would let someone read the headline
 * and never see the coverage panel that qualifies it, and the qualification is
 * not optional here.
 *
 * The engine runs in the browser. It is pure, it has no network calls, and the
 * whole factor set is a few kilobytes of JSON, so there is nothing to gain from
 * a round trip and something to lose: the intake is stored locally, and sending
 * it to a server to be scored would mean transmitting a health profile that
 * currently never leaves the device.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Headline } from './Headline';
import { Split } from './Split';
import { RankedFixes } from './RankedFixes';
import { Cohort } from './Cohort';
import { Panel } from '@/components/ui/primitives';
import { computeRisk } from '@/lib/risk';
import { NATIONAL_ROAD_FATALITY_RATE } from '@/lib/providers/environment/seeded';
import { getProfileStore, toProfile } from '@/lib/store';
import { FIRST_SLUG } from '@/components/intake/steps';
import type { IntakeDraft } from '@/lib/store';

export function Dashboard() {
  const store = useMemo(() => getProfileStore(), []);
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    store.load().then((found) => {
      if (cancelled) return;
      setDraft(found);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const profile = toProfile(draft);

  const result = useMemo(() => {
    if (!profile) return null;
    return computeRisk(profile, {
      nationalRoadFatalityRate: NATIONAL_ROAD_FATALITY_RATE,
    });
  }, [profile]);

  if (!loaded) {
    return (
      <Shell>
        <p className="text-[14px] text-ink-secondary">Reading what you saved.</p>
      </Shell>
    );
  }

  if (!result) {
    return (
      <Shell>
        <Panel>
          <div className="flex flex-col items-start gap-4 px-5 py-8">
            <h1 className="text-[20px] font-medium text-ink">
              There is nothing to compute yet.
            </h1>
            <p className="max-w-md text-[14px] leading-relaxed text-ink-secondary">
              Age and sex set your remaining life expectancy, which is what turns
              every acute risk into days. Without them there is no conversion to
              make, and guessing them would change every number on this page.
            </p>
            <Link
              href={`/intake/${FIRST_SLUG}`}
              className="bg-ink px-4 py-2 text-[14px] font-medium text-ground hover:opacity-90"
              style={{ borderRadius: 2 }}
            >
              Answer those two
            </Link>
          </div>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell>
      <Headline result={result} />
      <Split result={result} />
      <RankedFixes contributions={result.ranked} />
      <Cohort result={result} />

      <footer className="flex flex-col gap-3 border-t border-rule pt-5">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-secondary">
          These are population averages applied to what you entered. They are not
          a prediction about you, they are not medical advice, and nothing here
          knows anything about your health beyond what you typed. Every figure on
          this page links to the table it came from.
        </p>
        <p className="font-mono text-[12px] text-ink-tertiary">{result.engineVersion}</p>
        <div className="flex flex-wrap gap-4 pt-1">
          <Link
            href={`/intake/${FIRST_SLUG}`}
            className="text-[13px] text-ink-secondary hover:text-ink"
          >
            Change your answers
          </Link>
          <StartOver />
        </div>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-5 py-8 sm:px-6">
      <div className="flex items-baseline justify-between gap-4 pb-2">
        <Link href="/" className="legend hover:text-ink">
          Blind Spot
        </Link>
      </div>
      {children}
    </main>
  );
}

/**
 * Clearing the draft is destructive and unrecoverable, so it confirms. The
 * confirmation says what is actually lost rather than asking "are you sure".
 */
function StartOver() {
  const store = useMemo(() => getProfileStore(), []);
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-[13px] text-ink-secondary hover:text-ink"
      onClick={async () => {
        const ok = window.confirm(
          'This deletes every answer you gave, on this device, permanently. There is no copy anywhere else.',
        );
        if (!ok) return;
        await store.clear();
        router.push('/');
        // The draft is gone but this component still holds the computed result
        // in state. Refresh so the page re-reads an empty store rather than
        // rendering a dashboard for answers that no longer exist.
        router.refresh();
      }}
    >
      Start over
    </button>
  );
}
