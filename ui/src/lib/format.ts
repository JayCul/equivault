/**
 * Formatting helpers.
 *
 * One rule runs through this file: never format a value the user was told is
 * private into a string that could end up in a URL, a log line or an analytics
 * payload. These helpers are for rendering to the screen only.
 */

const NUMBER = new Intl.NumberFormat('en-US');

export const formatQuantity = (value: bigint | number): string =>
  NUMBER.format(typeof value === 'bigint' ? value : Math.round(value));

/** Renders simulated cents as simulated dollars. */
export const formatSimulatedPrice = (cents: bigint): string => {
  const whole = cents / 100n;
  const fraction = cents % 100n;
  return `$${NUMBER.format(whole)}.${fraction.toString().padStart(2, '0')}`;
};

/** `25_000` basis points reads as `2.5x`, `10_000` as `1x`. */
export const formatMultiple = (bps: bigint): string => {
  const scaled = Number(bps) / 10_000;
  const text =
    scaled >= 10
      ? scaled.toFixed(0)
      : scaled.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${text}x`;
};

export const formatPercent = (numerator: bigint, denominator: bigint): string => {
  if (denominator === 0n) return '0%';
  const pct = (Number(numerator) / Number(denominator)) * 100;
  return `${pct.toFixed(pct < 10 && pct > 0 ? 1 : 0)}%`;
};

/** Shortens a hex identifier for display. Never used as a lookup key. */
export const truncateHex = (hex: string, lead = 6, tail = 4): string =>
  hex.length <= lead + tail + 2 ? hex : `${hex.slice(0, lead)}…${hex.slice(-tail)}`;

export type Countdown = {
  readonly expired: boolean;
  readonly label: string;
  readonly totalSeconds: number;
};

export const countdownTo = (deadlineSeconds: bigint, now = Date.now()): Countdown => {
  const remaining = Number(deadlineSeconds) - Math.floor(now / 1000);
  if (remaining <= 0) {
    return { expired: true, label: 'Closed', totalSeconds: 0 };
  }

  const days = Math.floor(remaining / 86_400);
  const hours = Math.floor((remaining % 86_400) / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  const seconds = remaining % 60;

  const pad = (n: number): string => n.toString().padStart(2, '0');
  const label =
    days > 0 ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return { expired: false, label, totalSeconds: remaining };
};

export const formatDeadline = (deadlineSeconds: bigint): string =>
  new Date(Number(deadlineSeconds) * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
