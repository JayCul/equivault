import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failureCatalogue, toFriendlyFailure } from './errors.js';

// toFriendlyFailure logs every classification (see errors.ts) - silence it
// here so test output isn't a wall of diagnostic noise; the dedicated
// 'diagnostic logging' block below asserts on it directly.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errors :: classification', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['failed assert: EquiVault: offering is not open', 'offering-not-open'],
    ['failed assert: EquiVault: offering is not closed', 'offering-not-closed'],
    ['failed assert: EquiVault: allocation is not finalized', 'offering-not-finalized'],
    ['failed assert: EquiVault: subscription deadline has passed', 'deadline-passed'],
    ['failed assert: EquiVault: subscription deadline has not passed', 'deadline-not-passed'],
    ['failed assert: EquiVault: already subscribed to this offering', 'already-subscribed'],
    ['failed assert: EquiVault: allocation already claimed', 'already-claimed'],
    ['failed assert: EquiVault: caller is not the issuer', 'not-issuer'],
    ['failed assert: EquiVault: request below offering minimum', 'request-out-of-range'],
    ['failed assert: EquiVault: request above offering maximum', 'request-out-of-range'],
    ['EquiVault: this request is not in the on-chain request set', 'not-a-participant'],
    ['failed assert: EquiVault: allocation would exceed supply', 'supply-exhausted'],
    ['The user rejected the request', 'wallet-rejected'],
    ['connect ECONNREFUSED 127.0.0.1:6300', 'proof-server-unreachable'],
    ['insufficient funds for transaction', 'insufficient-funds'],
    ['fetch failed', 'network-unavailable'],
    // The literal message Chrome's fetch() throws on any network-level failure
    // (refused connection, DNS failure, CORS block, mixed content) - this is
    // the one that actually reached users, so it gets its own case.
    ['TypeError: Failed to fetch', 'network-unavailable'],
    // Safari's equivalent.
    ['TypeError: Load failed', 'network-unavailable'],
    // Firefox's equivalent.
    ['NetworkError when attempting to fetch resource.', 'network-unavailable'],
  ];

  it.each(cases)('maps %j to %s', (raw, expected) => {
    expect(toFriendlyFailure(new Error(raw)).kind).toEqual(expected);
  });

  it('falls back to a generic failure for an unrecognised error', () => {
    expect(toFriendlyFailure(new Error('kaboom')).kind).toEqual('unknown');
  });

  it('handles non-Error values without throwing', () => {
    expect(toFriendlyFailure(undefined).kind).toEqual('unknown');
    expect(toFriendlyFailure(null).kind).toEqual('unknown');
    expect(toFriendlyFailure({ weird: true }).kind).toEqual('unknown');
  });

  it('reads through to a nested cause', () => {
    const error = new Error('call failed', { cause: new Error('failed assert: EquiVault: caller is not the issuer') });
    expect(toFriendlyFailure(error).kind).toEqual('not-issuer');
  });

  // Regression: this was the actual bug behind the "no console entry, just
  // Something went wrong" report. Not every rejection in this app's
  // dependency chain is a genuine `Error` instance - a WASM boundary, a
  // browser-extension message-passing API, or a plain thrown object can all
  // reject with something that fails `instanceof Error`. Previously that
  // meant zero signal reached the classifier at all.
  it('classifies a plain object carrying a message property', () => {
    expect(toFriendlyFailure({ message: 'TypeError: Failed to fetch' }).kind).toEqual(
      'network-unavailable',
    );
  });

  it('classifies a plain object carrying a reason property', () => {
    expect(toFriendlyFailure({ reason: 'insufficient funds for transaction' }).kind).toEqual(
      'insufficient-funds',
    );
  });

  // Regression: the exact shape Lace's connector threw in production - a
  // DAppConnectorAPIError (not an Error instance) with both message and
  // reason set to its own wording, which does not say "disconnected" but
  // means exactly that.
  it('classifies Lace’s "no account is connected" error as wallet-disconnected', () => {
    const laceError = {
      code: 'InternalError',
      message: 'No account is connected for this dApp. Please reconnect.',
      name: 'APIError',
      reason: 'No account is connected for this dApp. Please reconnect.',
      type: 'DAppConnectorAPIError',
    };
    expect(toFriendlyFailure(laceError).kind).toEqual('wallet-disconnected');
  });

  it('falls back to JSON for an object with neither message nor reason', () => {
    // Still unknown - there is genuinely nothing to classify - but must not throw,
    // including for a value with a circular reference that defeats JSON.stringify.
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => toFriendlyFailure(circular)).not.toThrow();
    expect(toFriendlyFailure(circular).kind).toEqual('unknown');
  });
});

describe('errors :: diagnostic logging', () => {
  it('logs the original error, not just the friendly copy', () => {
    const original = new Error('failed assert: EquiVault: caller is not the issuer');
    toFriendlyFailure(original);

    expect(console.error).toHaveBeenCalledTimes(1);
    const [, payload] = vi.mocked(console.error).mock.calls[0]!;
    expect(payload).toMatchObject({ kind: 'not-issuer', error: original });
  });

  it('logs even a value that fails every classification pattern', () => {
    const original = { some: 'unrecognised shape' };
    toFriendlyFailure(original);

    expect(console.error).toHaveBeenCalledTimes(1);
    const [, payload] = vi.mocked(console.error).mock.calls[0]!;
    expect(payload).toMatchObject({ kind: 'unknown', error: original });
  });
});

describe('errors :: user-facing copy', () => {
  it('never leaks a raw assertion string to the user', () => {
    const failure = toFriendlyFailure(new Error('failed assert: EquiVault: already subscribed'));
    expect(failure.title).not.toMatch(/failed assert/i);
    expect(failure.detail).not.toMatch(/failed assert|EquiVault:/);
  });

  it('never echoes a numeric value from the underlying error', () => {
    // A raw error could contain a private quantity; the friendly copy must not.
    const failure = toFriendlyFailure(new Error('failed assert: request 40000 above offering maximum'));
    expect(failure.detail).not.toContain('40000');
  });

  it('gives every failure kind a title, a detail and a retry hint', () => {
    for (const [kind, entry] of Object.entries(failureCatalogue)) {
      expect(entry.title, kind).toBeTruthy();
      expect(entry.detail.length, kind).toBeGreaterThan(20);
      expect(typeof entry.retryable, kind).toEqual('boolean');
    }
  });

  it('marks transient problems as retryable and permanent ones as not', () => {
    expect(toFriendlyFailure(new Error('fetch failed')).retryable).toBe(true);
    expect(toFriendlyFailure(new Error('ECONNREFUSED 127.0.0.1:6300')).retryable).toBe(true);
    expect(toFriendlyFailure(new Error('already subscribed')).retryable).toBe(false);
    expect(toFriendlyFailure(new Error('caller is not the issuer')).retryable).toBe(false);
  });
});
