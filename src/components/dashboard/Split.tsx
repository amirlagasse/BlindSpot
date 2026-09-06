'use client';

/**
 * Acute and chronic, side by side.
 *
 * These are the two incompatible units, and the layout is the explanation: two
 * columns that never touch, each with its own total, its own colour and its own
 * raw count in its own unit. A single combined chart would imply they are
 * commensurable before the conversion, which is precisely the error the whole
 * engine is built to avoid.
 *
 * Each column carries a domain breakdown as a stacked bar. The bar is
 * proportional within its own column only. Comparing a segment in one column to
 * a segment in the other is meaningless, so the two bars are deliberately not
 * scaled to a shared axis.
 */

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Figure, Panel, PanelHead } from '@/components/ui/primitives';
import { DOMAIN_LABELS, formatCount, formatDuration } from '@/lib/format';
import type { EngineResult, RiskContribution } from '@/lib/risk/types';

/**
 * Shades within one column's hue.
 *
 * Domains are separated by lightness rather than by different colours, because
 * the colour itself is already carrying the acute-or-chronic distinction. Two
 * meanings on one channel is how a chart becomes unreadable.
 */
const SHADES = [1, 0.78, 0.58, 0.42, 0.3];

export function Split({ result }: { result: EngineResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Column
        legend="Acute"
        tone="acute"
        oneLiner="A chance of dying suddenly. Measured in micromorts: one in a million, per trip, per jump, per year of the job."
        daysLost={result.acute.daysLost}
        rawValue={formatCount(result.acute.totalMicromorts)}
        rawUnit="micromorts a year"
        contributions={result.acute.contributions}
      />
      <Column
        legend="Chronic"
        tone="chronic"
        oneLiner="Life expectancy eroded rather than ended. Measured in microlives: thirty minutes each, gained or lost every day you keep the habit."
        daysLost={result.chronic.daysLost}
        rawValue={formatCount(result.chronic.totalMicrolives)}
        rawUnit="microlives a year"
        contributions={result.chronic.contributions}
      />
    </div>
  );
}

function Column({
  legend,
  tone,
  oneLiner,
  daysLost,
  rawValue,
  rawUnit,
  contributions,
}: {
  legend: string;
  tone: 'acute' | 'chronic';
  oneLiner: string;
  daysLost: number;
  rawValue: string;
  rawUnit: string;
  contributions: RiskContribution[];
}) {
  const duration = formatDuration(daysLost);
  const byDomain = groupByDomain(contributions);

  return (
    <Panel className="flex flex-col">
      <PanelHead legend={legend} aside={`${rawValue} ${rawUnit}`} />

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <div className="flex flex-col gap-2">
          <Figure value={duration.value} unit={duration.unit} size="lg" tone={tone} />
          <p className="text-[13px] leading-relaxed text-ink-secondary">{oneLiner}</p>
        </div>

        {byDomain.length === 0 ? (
          <p className="border-t border-rule pt-4 text-[13px] leading-relaxed text-ink-secondary">
            Nothing scored on this side. Either you skipped the steps that feed
            it, or the factors are not sourced yet.
          </p>
        ) : (
          <DomainBreakdown rows={byDomain} tone={tone} />
        )}
      </div>
    </Panel>
  );
}

interface DomainRow {
  domain: string;
  label: string;
  days: number;
}

function groupByDomain(contributions: RiskContribution[]): DomainRow[] {
  const totals = new Map<string, number>();
  for (const c of contributions) {
    totals.set(c.domain, (totals.get(c.domain) ?? 0) + c.daysLostPerYear);
  }
  return [...totals.entries()]
    .map(([domain, days]) => ({ domain, label: DOMAIN_LABELS[domain] ?? domain, days }))
    .sort((a, b) => b.days - a.days);
}

function DomainBreakdown({ rows, tone }: { rows: DomainRow[]; tone: 'acute' | 'chronic' }) {
  // A single stacked row. Recharts wants one datum with a series per domain, so
  // the row is folded into one object keyed by domain.
  const datum = Object.fromEntries(rows.map((r) => [r.domain, r.days]));
  const hasNegative = rows.some((r) => r.days < 0);

  // Recharts picks a padded, rounded domain by default, which leaves a stacked
  // bar ending short of its container and reading as "there is more to come".
  // The domain is the stack's own total, so the bar fills the width exactly.
  const stackTotal = rows.reduce((sum, r) => sum + Math.max(r.days, 0), 0);

  return (
    <div className="flex flex-col gap-3 border-t border-rule pt-4">
      <p className="legend">By domain</p>

      <div className="h-9 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[datum]}
            layout="vertical"
            barCategoryGap={0}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis type="number" domain={[0, stackTotal]} hide />
            <YAxis type="category" hide />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: 'var(--panel-raised)',
                border: '1px solid var(--rule-strong)',
                borderRadius: 2,
                fontSize: 13,
                padding: '6px 10px',
              }}
              labelFormatter={() => ''}
              formatter={(value, name) => {
                const days = typeof value === 'number' ? value : 0;
                const d = formatDuration(days);
                const key = String(name);
                return [`${d.value} ${d.unit}`, DOMAIN_LABELS[key] ?? key];
              }}
            />
            {rows.map((row, i) => (
              <Bar
                key={row.domain}
                dataKey={row.domain}
                stackId="one"
                isAnimationActive={false}
                fill={`var(--${tone})`}
                fillOpacity={SHADES[i % SHADES.length]}
              >
                <Cell key={row.domain} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="flex flex-col divide-y divide-rule">
        {rows.map((row, i) => {
          const d = formatDuration(row.days);
          return (
            <div key={row.domain} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="flex items-center gap-2 text-[14px] text-ink">
                <span
                  aria-hidden
                  className="block h-2.5 w-2.5 shrink-0"
                  style={{
                    background: `var(--${tone})`,
                    opacity: SHADES[i % SHADES.length],
                  }}
                />
                {row.label}
              </dt>
              <dd className="figure text-[14px] text-ink-secondary">
                {row.days < 0 ? '-' : ''}
                {d.value.replace('-', '')} {d.unit}
              </dd>
            </div>
          );
        })}
      </dl>

      {hasNegative ? (
        <p className="text-[13px] leading-snug text-ink-secondary">
          A negative figure is life gained. The bar cannot show it, so read the
          list rather than the bar where one appears.
        </p>
      ) : null}
    </div>
  );
}
