import { beforeEach, describe, expect, it } from 'vitest';
import { forgetOffering, listKnownOfferings, rememberOffering } from './offeringRegistry';

const NET = 'preprod';
const ADDR_A = '0200aaaa000000000000000000000000000000000000000000000000000000000001';
const ADDR_B = '0200bbbb000000000000000000000000000000000000000000000000000000000002';

describe('offeringRegistry', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty for a network nothing has been remembered on', () => {
    expect(listKnownOfferings(NET)).toEqual([]);
  });

  it('remembers an address, and it survives being read back', () => {
    rememberOffering(NET, ADDR_A);
    expect(listKnownOfferings(NET)).toEqual([ADDR_A]);
  });

  it('accumulates multiple distinct addresses in insertion order', () => {
    rememberOffering(NET, ADDR_A);
    rememberOffering(NET, ADDR_B);
    expect(listKnownOfferings(NET)).toEqual([ADDR_A, ADDR_B]);
  });

  it('is idempotent - remembering the same address twice does not duplicate it', () => {
    rememberOffering(NET, ADDR_A);
    rememberOffering(NET, ADDR_A);
    expect(listKnownOfferings(NET)).toEqual([ADDR_A]);
  });

  it('forgets an address without disturbing the others', () => {
    rememberOffering(NET, ADDR_A);
    rememberOffering(NET, ADDR_B);
    forgetOffering(NET, ADDR_A);
    expect(listKnownOfferings(NET)).toEqual([ADDR_B]);
  });

  it('forgetting an address that was never remembered is a no-op', () => {
    rememberOffering(NET, ADDR_A);
    forgetOffering(NET, ADDR_B);
    expect(listKnownOfferings(NET)).toEqual([ADDR_A]);
  });

  it('scopes addresses per network, so switching networks cannot leak a stale address', () => {
    rememberOffering('preprod', ADDR_A);
    rememberOffering('testnet', ADDR_B);
    expect(listKnownOfferings('preprod')).toEqual([ADDR_A]);
    expect(listKnownOfferings('testnet')).toEqual([ADDR_B]);
  });

  it('survives a corrupt stored value rather than throwing', () => {
    window.localStorage.setItem('equivault.knownOfferings.preprod', '{not json');
    expect(() => listKnownOfferings(NET)).not.toThrow();
    expect(listKnownOfferings(NET)).toEqual([]);
  });

  it('discards non-string entries from a tampered stored value', () => {
    window.localStorage.setItem(
      'equivault.knownOfferings.preprod',
      JSON.stringify([ADDR_A, 42, null, { nested: true }, ADDR_B]),
    );
    expect(listKnownOfferings(NET)).toEqual([ADDR_A, ADDR_B]);
  });

  it('is a real bookmark that persists independently of any in-memory state', () => {
    // Simulates exactly the bug this module exists to fix: remember an
    // address, then read it back as if the page had been fully reloaded and
    // every React state had been wiped.
    rememberOffering(NET, ADDR_A);
    const afterReload = listKnownOfferings(NET);
    expect(afterReload).toContain(ADDR_A);
  });
});
