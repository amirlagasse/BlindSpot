/**
 * The primitives every screen is built from.
 *
 * The design brief is an instrument panel. In practice that means: hairline
 * rules instead of borders and shadows, tight padding instead of generous
 * padding, labels that sit above their field rather than floating inside it,
 * and figures set in tabular numerals so a column of them aligns.
 *
 * Nothing here is rounded beyond 2px. Chunky rounded corners are the single
 * clearest tell of a default template, and this product cannot afford to look
 * like one: if the interface looks generated, the numbers read as generated too.
 */

import type { InputHTMLAttributes, ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-rule bg-panel ${className}`}
      style={{ borderRadius: 2 }}
    >
      {children}
    </section>
  );
}

/**
 * A panel's header strip. The legend sits on a hairline, the way a labeled
 * section of a real panel does.
 */
export function PanelHead({
  legend,
  aside,
}: {
  legend: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2.5">
      <h2 className="legend">{legend}</h2>
      {aside ? <div className="text-xs text-ink-secondary">{aside}</div> : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Figures                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A measured number with its unit.
 *
 * The unit is set smaller and dimmer but never small enough to squint at: 13px
 * at secondary contrast, not 10px grey. A number whose unit cannot be read is a
 * number that cannot be checked.
 */
export function Figure({
  value,
  unit,
  size = 'md',
  tone = 'ink',
}: {
  value: string;
  unit?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'ink' | 'acute' | 'chronic' | 'baseline' | 'gain';
}) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-[clamp(3.25rem,11vw,5.5rem)] leading-[0.9]',
  } as const;

  const tones = {
    ink: 'text-ink',
    acute: 'text-acute',
    chronic: 'text-chronic',
    baseline: 'text-baseline',
    gain: 'text-gain',
  } as const;

  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`figure font-medium ${sizes[size]} ${tones[tone]}`}>{value}</span>
      {unit ? (
        <span className="text-[13px] leading-none text-ink-secondary">{unit}</span>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[13px] leading-snug text-ink-secondary">{hint}</p> : null}
    </div>
  );
}

const INPUT_CLASS =
  'w-full border border-rule bg-ground px-3 py-2 text-[15px] text-ink ' +
  'placeholder:text-ink-tertiary hover:border-rule-strong ' +
  'focus:border-rule-strong focus:outline-none';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={INPUT_CLASS} style={{ borderRadius: 2 }} />;
}

/**
 * A numeric input with a suffix rendered inside the field.
 *
 * `inputMode="numeric"` matters more than it looks: this form is filled out on
 * a phone as often as a laptop, and a text keyboard for a mileage field is the
 * kind of friction that makes someone skip the step.
 */
export function NumberInput({
  suffix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suffix?: string }) {
  return (
    <div className="relative">
      <input
        {...props}
        type="number"
        inputMode="numeric"
        className={`${INPUT_CLASS} ${suffix ? 'pr-16' : ''} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        style={{ borderRadius: 2 }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-secondary">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A segmented choice. Used wherever the options are few and naming them is
 * faster than opening a select: sex at birth, a yes or no.
 */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="flex divide-x divide-rule border border-rule"
      style={{ borderRadius: 2 }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex-1 px-3 py-2 text-[14px] transition-colors ${
              selected
                ? 'bg-panel-raised font-medium text-ink'
                : 'bg-ground text-ink-secondary hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Select({
  children,
  ...props
}: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
      className={INPUT_CLASS}
      style={{ borderRadius: 2 }}
    >
      {children}
    </select>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'ghost';
}) {
  const variants = {
    primary: 'bg-ink text-ground hover:opacity-90 font-medium',
    quiet: 'border border-rule text-ink hover:border-rule-strong',
    ghost: 'text-ink-secondary hover:text-ink',
  } as const;

  return (
    <button
      {...props}
      className={`px-4 py-2 text-[14px] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]}`}
      style={{ borderRadius: 2 }}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A citation, shown inline.
 *
 * Spec rule: every user-facing number is traceable to a citation within two
 * clicks. This is the second click, and it is a real link to the real table.
 */
export function Citation({
  citation,
  url,
  year,
  confidence,
}: {
  citation: string;
  url: string;
  year: number;
  confidence: 'high' | 'medium' | 'low';
}) {
  return (
    <div className="flex flex-col gap-1 text-[13px] leading-snug text-ink-secondary">
      <p>{citation}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
        >
          {new URL(url).hostname}
        </a>
        <span className="font-mono">{year}</span>
        <ConfidenceMark confidence={confidence} />
      </div>
    </div>
  );
}

/**
 * Confidence, shown as three ticks rather than a word.
 *
 * A word ("low") reads as a judgment on the user. Three ticks read as an
 * instrument's precision, which is what it actually is.
 */
export function ConfidenceMark({
  confidence,
}: {
  confidence: 'high' | 'medium' | 'low';
}) {
  const filled = { high: 3, medium: 2, low: 1 }[confidence];
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`Source confidence: ${confidence}`}
    >
      <span className="flex gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`block h-2.5 w-[3px] ${i < filled ? 'bg-ink-secondary' : 'bg-rule'}`}
          />
        ))}
      </span>
      <span className="sr-only">Source confidence: {confidence}</span>
    </span>
  );
}
