import { beforeEach, describe, expect, it } from 'vitest';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';
import {
  clearUserPassphrase,
  forgetGeneratedKey,
  passwordProviderFor,
  setUserPassphrase,
  usingUserPassphrase,
} from './privateStorage';

describe('private state encryption key', () => {
  beforeEach(() => {
    clearUserPassphrase();
    window.localStorage.clear();
  });

  it('generates a passphrase the SDK accepts', () => {
    const password = passwordProviderFor('account-a')();
    expect(() => validatePassword(password)).not.toThrow();
  });

  it('is stable for the same account', () => {
    const provider = passwordProviderFor('account-a');
    expect(provider()).toEqual(provider());
  });

  it('is different across accounts, so two accounts cannot read each other', () => {
    expect(passwordProviderFor('account-a')()).not.toEqual(passwordProviderFor('account-b')());
  });

  it('prefers a user passphrase and keeps it out of storage', () => {
    const passphrase = 'Correct-Horse!Battery9Staple';
    setUserPassphrase(passphrase);
    expect(usingUserPassphrase()).toBe(true);
    expect(passwordProviderFor('account-a')()).toEqual(passphrase);
    expect(JSON.stringify(window.localStorage)).not.toContain(passphrase);
  });

  it('rejects a weak user passphrase', () => {
    expect(() => setUserPassphrase('short')).toThrow();
  });

  it('forgets a generated key on request', () => {
    const before = passwordProviderFor('account-a')();
    forgetGeneratedKey('account-a');
    expect(passwordProviderFor('account-a')()).not.toEqual(before);
  });
});
