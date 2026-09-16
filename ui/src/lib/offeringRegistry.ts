/**
 * Remembers which live offering addresses this browser has created or joined,
 * so they reappear automatically the next time the wallet connects.
 *
 * This is deliberately NOT a source of truth about what exists on Midnight -
 * it is a client-side bookmark list, exactly like browser history. The
 * offerings it names still come from the real chain via `LiveOfferingSession`;
 * this module only remembers WHICH addresses to ask for.
 *
 * Without this, `AppContext`'s `liveSessions` lives only in React state, which
 * is wiped by every page reload. An offering deployed five minutes ago becomes
 * permanently unreachable through the UI the moment the tab refreshes, unless
 * the exact contract address is still known and re-entered by hand.
 *
 * Scoped per network id, since a preprod address is meaningless once the app
 * points at a different network.
 *
 * @module
 */

const STORAGE_KEY_PREFIX = 'equivault.knownOfferings';

const storageKey = (networkId: string): string => `${STORAGE_KEY_PREFIX}.${networkId}`;

/** Reads storage defensively: private browsing, cleared storage, or a corrupt value must not throw. */
const readList = (networkId: string): string[] => {
  try {
    const raw = window.localStorage.getItem(storageKey(networkId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

const writeList = (networkId: string, addresses: readonly string[]): void => {
  try {
    window.localStorage.setItem(storageKey(networkId), JSON.stringify(addresses));
  } catch {
    // Storage unavailable (private browsing, quota, disabled) - the address
    // still works for this session via React state, it just will not survive
    // a reload. Nothing else to do about it here.
  }
};

/** Every address this browser knows about for the given network, oldest first. */
export const listKnownOfferings = (networkId: string): readonly string[] => readList(networkId);

/** Records an address so it is offered again on the next connection. Idempotent. */
export const rememberOffering = (networkId: string, address: string): void => {
  const current = readList(networkId);
  if (current.includes(address)) return;
  writeList(networkId, [...current, address]);
};

/** Removes an address - e.g. one that no longer resolves to a live contract. */
export const forgetOffering = (networkId: string, address: string): void => {
  writeList(networkId, readList(networkId).filter((entry) => entry !== address));
};
