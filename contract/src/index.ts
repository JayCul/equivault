/**
 * EquiVault contract package.
 *
 * Re-exports the compiler-generated contract bindings, the private-state and
 * witness layer, and the pure allocation rule.
 *
 * @packageDocumentation
 */

import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

export * from './managed/equivault/contract/index.js';
export * from './witnesses.js';
export * from './allocation.js';
export * from './simulator.js';

import * as CompiledEquiVault from './managed/equivault/contract/index.js';
import * as Witnesses from './witnesses.js';

/**
 * Domain separators for the offering-scoped identity tags. These MUST match the
 * `pad(32, ...)` literals used in `equivault.compact`.
 */
export const DOMAIN = {
  issuer: 'issuer',
  submit: 'submit',
  claim: 'claim',
} as const;

/** Pads a domain separator to the 32-byte form the circuit uses. */
export const domainTag = (domain: string): Uint8Array => {
  const bytes = new TextEncoder().encode(domain);
  if (bytes.length > 32) {
    throw new Error(`EquiVault: domain separator "${domain}" exceeds 32 bytes`);
  }
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
};

/**
 * The compiled EquiVault contract, bound to its witnesses and ZK assets.
 */
export const EquiVaultContract = CompiledContract.make<
  CompiledEquiVault.Contract<Witnesses.EquiVaultPrivateState>
>('EquiVault', CompiledEquiVault.Contract<Witnesses.EquiVaultPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets('./managed/equivault'),
);
