import { describe, expect, it } from 'vitest';
import { failureCatalogue, toFriendlyFailure } from './errors.js';

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
