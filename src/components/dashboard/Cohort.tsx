'use client';

/**
 * Percentile against the population, and what the app could not evaluate.
 *
 * Both halves of this panel exist to stop the dashboard overclaiming.
 *
 * The percentile is null today because no published distribution of "expected
 * days of life lost per year" exists: the composite is our own construction. It
 * says so rather than showing a plausible number, and it says explicitly that
 * the comparison is against published averages and not against other users of
 * this app, which is a thing every product like this quietly implies.
 *
 * The coverage half is the honest accounting: which domains were evaluated,
 * which were not, and what was skipped. A dashboard that looks complete when
 * three of five domains are empty is lying by omission.
 */

import { Panel, PanelHead } from '@/components/ui/primitives';
import { DOMAIN_LABELS } from '@/lib/format';
import type { EngineResult } from '@/lib/risk/types';

export function Cohort({ result }: { result: EngineResult }) {
  const { cohort, coverage } = result;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHead legend="Against other people" />
        <div className="flex flex-col gap-3 px-5 py-5">
          {cohort.percentile === null ? (
            <>
              <p className="text-[15px] text-ink">No percentile yet.</p>
              <p className="text-[13px] leading-relaxed text-ink-secondary">
                Placing you in a distribution needs a distribution, and nobody
                publishes one for this figure because the figure is ours. Closing
                it means deriving the spread from the same national surveys and
                labelling it derived, which has not been done.
              </p>
            </>
          ) : (
            <>
              <p className="figure text-3xl font-medium text-ink">
                {Math.round(cohort.percentile)}
                <span className="text-base text-ink-secondary">th percentile</span>
              </p>
              <p className="text-[13px] leading-relaxed text-ink-secondary">
                {cohort.comparisonBasis}
              </p>
            </>
          )}
          <p className="border-t border-rule pt-3 text-[13px] leading-relaxed text-ink-secondary">
            When this arrives it will compare you against published national
            averages. It will not compare you against other people who used this
            app, and it will say so on the screen.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHead
          legend="What this covers"
          aside={`${coverage.factorsEvaluated} ${coverage.factorsEvaluated === 1 ? 'factor' : 'factors'}`}
        />
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex flex-col gap-2">
            <p className="legend">Evaluated</p>
            {coverage.domainsCovered.length === 0 ? (
              <p className="text-[14px] text-ink-secondary">Nothing.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {coverage.domainsCovered.map((d) => (
                  <li
                    key={d}
                    className="border border-rule px-2 py-1 text-[13px] text-ink"
                    style={{ borderRadius: 2 }}
                  >
                    {DOMAIN_LABELS[d]}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {coverage.domainsMissing.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="legend">Not evaluated</p>
              <ul className="flex flex-wrap gap-1.5">
                {coverage.domainsMissing.map((d) => (
                  <li
                    key={d}
                    className="border border-dashed border-rule px-2 py-1 text-[13px] text-ink-secondary"
                    style={{ borderRadius: 2 }}
                  >
                    {DOMAIN_LABELS[d]}
                  </li>
                ))}
              </ul>
              <p className="text-[13px] leading-relaxed text-ink-secondary">
                Your number is missing whatever these would have added. Some of
                that is steps you skipped; some is data this app does not have
                yet. Either way the total below is a floor, not a full account.
              </p>
            </div>
          ) : null}

          {coverage.factorsSkippedForMissingInput.length > 0 ? (
            <details className="border-t border-rule pt-3">
              <summary className="cursor-pointer text-[13px] text-ink-secondary hover:text-ink">
                {coverage.factorsSkippedForMissingInput.length} factors were
                looked for and not found
              </summary>
              <ul className="mt-2 flex flex-col gap-1 font-mono text-[12px] text-ink-tertiary">
                {coverage.factorsSkippedForMissingInput.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
