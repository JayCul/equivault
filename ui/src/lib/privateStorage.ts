/**
 * Encryption key management for private state at rest.
 *
 * EquiVault stores each participant's secret key and commitment openings in
 * IndexedDB, encrypted by the Midnight level private-state provider. That
 * provider requires a password satisfying a strength policy.
 *
 * ---------------------------------------------------------------------------
 * BE PRECISE ABOUT WHAT THIS PROTECTS
 * ---------------------------------------------------------------------------
 * By default EquiVault generates a strong random passphrase and keeps it in
 * `localStorage`, scoped to the connected wallet account.
 *
 *   It DOES protect against: another application or a person inspecting the
 *   IndexedDB contents directly, and against private state leaking in a raw
 *   database export.
 *
 *   It does NOT protect against: anything with script access to this origin.
 *   Code that can read IndexedDB can also read `localStorage`, so an XSS
 *   vulnerability defeats it entirely. It is encryption at rest on a trusted
 *   device, not a passphrase-protected vault.
 *
 * A user-supplied passphrase is strictly stronger, because the key never
 * touches storage. `setUserPassphrase` enables that path; when set, it takes
 * precedence and the generated key is not used.
 * ---------------------------------------------------------------------------
 *
 * @module
 */

import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';

const GENERATED_KEY_PREFIX = 'equivault.private-state-key';

/** Deliberately excludes runs like `abcd` and `1234` to avoid sequential patterns. */
const ALPHABET = 'ACEGJKMNPRTVWXYZacegjkmnprtvwxyz2468!@#$%^&*-_=+';

const randomPassphrase = (length = 32): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
};

/**
 * Generates a passphrase that satisfies the SDK's policy.
 *
 * The policy is validated by the SDK itself rather than reimplemented here, so
 * this cannot drift if the policy changes.
 */
const generateValidPassphrase = (): string => {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = randomPassphrase();
    try {
      validatePassword(candidate);
      return candidate;
    } catch {
      // Regenerate: a random draw happened to violate the policy.
    }
  }
  throw new Error('EquiVault: could not generate a compliant storage passphrase');
};

let userPassphrase: string | undefined;

/**
 * Switches to a user-held passphrase. The value is kept in memory only, so it
 * is gone on reload and must be re-entered - which is the point.
 */
export const setUserPassphrase = (passphrase: string): void => {
  validatePassword(passphrase);
  userPassphrase = passphrase;
};

export const clearUserPassphrase = (): void => {
  userPassphrase = undefined;
};

export const usingUserPassphrase = (): boolean => userPassphrase !== undefined;

const storageKeyFor = (accountId: string): string => `${GENERATED_KEY_PREFIX}:${accountId}`;

/**
 * Returns the password provider for a given account.
 *
 * `accountId` scopes the stored private state so two wallet accounts in the
 * same browser never read each other's openings.
 */
export const passwordProviderFor = (accountId: string) => (): string => {
  if (userPassphrase !== undefined) {
    return userPassphrase;
  }

  const key = storageKeyFor(accountId);

  try {
    const existing = window.localStorage.getItem(key);
    if (existing) {
      return existing;
    }
    const generated = generateValidPassphrase();
    window.localStorage.setItem(key, generated);
    return generated;
  } catch {
    // Private browsing, or storage blocked. Fall back to an ephemeral key: the
    // session works, but private state will not survive a reload. The Portfolio
    // screen already warns that losing openings forfeits a claim.
    return generateValidPassphrase();
  }
};

/**
 * Forgets the generated key for an account. The encrypted private state becomes
 * permanently unreadable, so this is only for an explicit user-initiated wipe.
 */
export const forgetGeneratedKey = (accountId: string): void => {
  try {
    window.localStorage.removeItem(storageKeyFor(accountId));
  } catch {
    // Nothing to forget if storage is unavailable.
  }
};
