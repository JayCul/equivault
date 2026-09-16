import { describe, expect, it } from 'vitest';
import {
  countdownTo,
  formatMultiple,
  formatPercent,
  formatQuantity,
  formatSimulatedPrice,
  truncateHex,
} from './format';

describe('format', () => {
  it('formats quantities with separators', () => {
    expect(formatQuantity(100_000n)).toEqual('100,000');
    expect(formatQuantity(0n)).toEqual('0');
  });

  it('formats simulated prices from cents', () => {
    expect(formatSimulatedPrice(2_500n)).toEqual('$25.00');
    expect(formatSimulatedPrice(4_205n)).toEqual('$42.05');
    expect(formatSimulatedPrice(0n)).toEqual('$0.00');
  });

  it('formats oversubscription multiples', () => {
    expect(formatMultiple(25_000n)).toEqual('2.5x');
    expect(formatMultiple(10_000n)).toEqual('1x');
    expect(formatMultiple(13_400n)).toEqual('1.34x');
  });

  it('formats fill rates', () => {
    expect(formatPercent(3_100n, 8_000n)).toEqual('39%');
    expect(formatPercent(0n, 0n)).toEqual('0%');
  });

  it('truncates hex without losing both ends', () => {
    const hex = 'a'.repeat(64);
    const short = truncateHex(hex);
    expect(short.startsWith('aaaaaa')).toBe(true);
    expect(short).toContain('…');
    expect(short.length).toBeLessThan(hex.length);
  });

  it('counts down and reports expiry', () => {
    const now = 1_800_000_000_000;
    const future = countdownTo(BigInt(now / 1000 + 3_725), now);
    expect(future.expired).toBe(false);
    expect(future.label).toEqual('01:02:05');

    const past = countdownTo(BigInt(now / 1000 - 10), now);
    expect(past.expired).toBe(true);
    expect(past.label).toEqual('Closed');
  });
});
