'use client';

/**
 * The headline.
 *
 * One number, set large. Under it, the marginal figure against the population,
 * and one sentence naming the largest thing the person could change.
 *
 * The thing this component is most careful about is what it does NOT say. It
 * does not say "you will lose N days"; it says exposure. It does not colour the
 * number by size. And when the population reference is missing it says the
 * comparison is unavailable rather than showing a zero, because a zero would
 * read as "exactly average", which is a claim we cannot defend.
 */

import { Figure, Panel, PanelHead } from '@/components/ui/primitives';
import { DOMAIN_LABELS, formatDuration, formatSigned } from '@/lib/format';
import type { EngineResult } from '@/lib/risk/types';

export function Headline({ result }: { result: EngineResult }) {
  const total = formatDuration(result.headline.totalDaysLostPerYear);
  const top = result.ranked[0];
  const marginal = result.headline.marginalDaysLostPerYear;

  return (
    <Panel>
      <PanelHead legend="Annual exposure" aside="Expected life lost per year" />

      <div className="flex flex-col gap-6 px-5 py-7">
        <div className="flex flex-col gap-2">
          <Figure value={total.value} unit={total.unit} size="xl" />
          <p className="max-w-lg text-[14px] leading-relaxed text-ink-secondary">
            The expected cost of a year lived the way you described it. Both
            sudden risks and slow ones, converted into the same unit and added
            only once they were comparable.
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-5 border-t border-rule pt-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <p className="legend">Against the population</p>
            {marginal === null ? (
              <>
                <p className="text-[15px] text-ink">Not available</p>
                <p className="text-[13px] leading-snug text-ink-secondary">
                  There is no sourced average for your age and sex yet, so there
                  is nothing to compare against. Showing zero here would read as
                  average, which would be a guess.
                </p>
              </>
            ) : (
              <>
                <Figure value={formatSigned(marginal)} unit="days" size="md" />
                <p className="text-[13px] leading-snug text-ink-secondary">
                  {marginal > 0
                    ? 'Above the average for your age and sex.'
                    : 'Below the average for your age and sex.'}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="legend">Unavoidable baseline</p>
            <Figure
              value={formatDuration(result.headline.baselineDaysLostPerYear).value}
              unit={formatDuration(result.headline.baselineDaysLostPerYear).unit}
              size="md"
              tone="baseline"
            />
            <p className="text-[13px] leading-snug text-ink-secondary">
              All-cause mortality for someone your age and sex, from the life
              table. Nothing you do removes it, and it is not part of the figure
              above.
            </p>
          </div>
        </div>

        {top ? (
          <div className="border-t border-rule pt-5">
            <p className="text-[15px] leading-relaxed text-ink">
              The largest single thing you could change is{' '}
              <span className="font-medium">{top.label.toLowerCase()}</span>, at{' '}
              <span className="figure font-medium">
                {formatDuration(top.daysLostPerYear).value}
              </span>{' '}
              {formatDuration(top.daysLostPerYear).unit} a year. That is{' '}
              {Math.round(
                (top.daysLostPerYear / result.headline.totalDaysLostPerYear) * 100,
              )}
              % of your total, and it sits under{' '}
              {DOMAIN_LABELS[top.domain].toLowerCase()}.
            </p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
