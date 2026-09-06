'use client';

/**
 * The ranked fixes.
 *
 * Everything the user could actually change, largest first, each with what it
 * costs, what it would cost instead, and the table the number came from.
 *
 * This is the one screen where the product either works or does not. A list of
 * problems with no second column is a list of problems; the counterfactual is
 * what turns it into something to act on. And the citation being one click away
 * on every row is what stops the whole thing reading as an oracle.
 *
 * The magnitude bars are hand-drawn rather than charted. A chart library would
 * give rounded caps and animated growth, and a row that grows on load is a row
 * that is performing rather than reporting.
 */

import { useState } from 'react';
import { Citation, Panel, PanelHead } from '@/components/ui/primitives';
import { DOMAIN_LABELS, formatDuration } from '@/lib/format';
import { counterfactualFor } from '@/lib/counterfactuals';
import type { RiskContribution } from '@/lib/risk/types';

export function RankedFixes({ contributions }: { contributions: RiskContribution[] }) {
  if (contributions.length === 0) {
    return (
      <Panel>
        <PanelHead legend="What you could change" />
        <p className="px-5 py-6 text-[14px] leading-relaxed text-ink-secondary">
          Nothing scored. Either every step that feeds a controllable factor was
          skipped, or the factors behind them are not sourced yet. This is not a
          finding about you.
        </p>
      </Panel>
    );
  }

  // Bars are scaled to the largest magnitude in the list, so the top row is
  // full width and everything else reads against it. Gains are magnitudes too.
  const largest = Math.max(...contributions.map((c) => Math.abs(c.daysLostPerYear)));

  return (
    <Panel>
      <PanelHead
        legend="What you could change"
        aside={`${contributions.length} ${contributions.length === 1 ? 'item' : 'items'}, largest first`}
      />
      <ul className="flex flex-col divide-y divide-rule">
        {contributions.map((c) => (
          <FixRow key={c.factorId} contribution={c} largest={largest} />
        ))}
      </ul>
      <p className="border-t border-rule px-5 py-3 text-[13px] leading-snug text-ink-secondary">
        Your job is not on this list. Occupation is real and often large, but
        changing career is not a suggestion a dashboard gets to make, so it sits
        with the things worth seeing instead.
      </p>
    </Panel>
  );
}

function FixRow({
  contribution,
  largest,
}: {
  contribution: RiskContribution;
  largest: number;
}) {
  const [open, setOpen] = useState(false);
  const counterfactual = counterfactualFor(contribution);
  const isGain = contribution.daysLostPerYear < 0;
  const duration = formatDuration(contribution.daysLostPerYear);
  const width = largest === 0 ? 0 : (Math.abs(contribution.daysLostPerYear) / largest) * 100;

  return (
    <li>
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[15px] font-medium text-ink">{contribution.label}</h3>
            <p className="legend">{DOMAIN_LABELS[contribution.domain]}</p>
          </div>
          <div className="shrink-0 text-right">
            <span
              className={`figure text-[19px] font-medium ${isGain ? 'text-gain' : 'text-ink'}`}
            >
              {isGain ? '+' : ''}
              {duration.value.replace('-', '')}
            </span>{' '}
            <span className="text-[13px] text-ink-secondary">{duration.unit}</span>
          </div>
        </div>

        <div className="h-[3px] w-full bg-rule" aria-hidden>
          <div
            className="h-full"
            style={{
              width: `${width}%`,
              background: isGain
                ? 'var(--gain)'
                : contribution.kind === 'acute'
                  ? 'var(--acute)'
                  : 'var(--chronic)',
            }}
          />
        </div>

        {counterfactual ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[14px]">
            <span className="text-ink-secondary">{counterfactual.scenario}:</span>
            <span className="figure text-ink">
              {counterfactual.isGain ? '+' : ''}
              {formatDuration(counterfactual.daysLostPerYear).value.replace('-', '')}{' '}
              {formatDuration(counterfactual.daysLostPerYear).unit}
            </span>
            <span className="text-gain">
              {/* A row that already gives life back gains MORE of it; a row
                  that costs life SAVES some. Same arithmetic, opposite words,
                  and "saves 13 days more" is neither. */}
              {counterfactual.isGain
                ? `gains ${formatDuration(counterfactual.daysGained).value} ${formatDuration(counterfactual.daysGained).unit} more`
                : `saves ${formatDuration(counterfactual.daysGained).value} ${formatDuration(counterfactual.daysGained).unit}`}
            </span>
          </div>
        ) : null}

        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-[13px] text-ink-secondary underline decoration-rule-strong underline-offset-2 hover:text-ink"
          >
            {open ? 'Hide the source' : 'Where this number comes from'}
          </button>
        </div>

        {open ? (
          <div className="flex flex-col gap-3 border-l-2 border-rule pl-3">
            <Citation {...contribution.source} />
            {contribution.notes ? (
              <p className="text-[13px] leading-relaxed text-ink-secondary">
                {contribution.notes}
              </p>
            ) : null}
            <p className="font-mono text-[12px] text-ink-tertiary">{contribution.factorId}</p>
          </div>
        ) : null}
      </div>
    </li>
  );
}
