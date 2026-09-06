/**
 * Formatting for figures the user reads.
 *
 * One rule underneath all of it: show the precision the number actually has.
 * The underlying rates are good to two significant figures at best, so a
 * dashboard reading 12.4718 days would be claiming an accuracy that does not
 * exist. It would also look, correctly, like a machine wrote it.
 */

/** Days, at the precision the number deserves. */
export function formatDays(days: number): string {
  const magnitude = Math.abs(days);
  if (magnitude === 0) return '0';
  if (magnitude < 0.1) return days.toFixed(2);
  if (magnitude < 10) return days.toFixed(1);
  return Math.round(days).toLocaleString('en-US');
}

/**
 * Days rendered as the largest unit that keeps the number legible.
 *
 * Under a day, hours read better: "eleven hours a year" lands where "0.46 days"
 * does not. Above a year, years read better than three digits of days.
 */
export function formatDuration(days: number): { value: string; unit: string } {
  const magnitude = Math.abs(days);
  if (magnitude < 1) {
    const hours = days * 24;
    if (Math.abs(hours) < 1) {
      const minutes = hours * 60;
      return { value: Math.round(minutes).toString(), unit: 'minutes' };
    }
    return { value: hours.toFixed(1), unit: Math.abs(hours) === 1 ? 'hour' : 'hours' };
  }
  if (magnitude >= 365.25) {
    return { value: (days / 365.25).toFixed(1), unit: 'years' };
  }
  return { value: formatDays(days), unit: Math.abs(days) === 1 ? 'day' : 'days' };
}

export function formatCount(n: number): string {
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
  if (Math.abs(n) >= 10) return n.toFixed(0);
  if (Math.abs(n) >= 1) return n.toFixed(1);
  return n.toFixed(2);
}

/** A signed figure, for anything shown against a reference. */
export function formatSigned(days: number): string {
  const formatted = formatDays(Math.abs(days));
  if (days > 0) return `+${formatted}`;
  if (days < 0) return `-${formatted}`;
  return formatted;
}

export function formatMiles(miles: number): string {
  return Math.round(miles).toLocaleString('en-US');
}

export const DOMAIN_LABELS: Record<string, string> = {
  mobility: 'Getting around',
  occupation: 'Work',
  environment: 'Where you live',
  activity: 'What you do',
  chronic: 'Habits',
};
