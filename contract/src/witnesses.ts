/**
 * EquiVault private state and witness implementations.
 *
 * Everything in this file stays on the participant's own machine. None of it is
 * ever sent to the network: the witnesses feed the zero-knowledge prover, which
 * emits a proof about these values without emitting the values themselves.
 *
 * @module
 */

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import { type Ledger, pureCircuits } from './managed/equivault/contract/index.js';
import { allocationFor } from './allocation.js';

/**
 * A participant's sealed request: the quantity they want, plus the random
 * opening that makes the on-chain commitment hiding.
 */
export type SealedRequest = {
  /** The requested quantity. PRIVATE - never leaves this machine. */
  readonly amount: bigint;
  /** Commitment opening (blinding factor). PRIVATE - losing it forfeits the claim. */
  readonly nonce: Uint8Array;
};

/**
 * The complete private state for one EquiVault participant.
 *
 * `secretKey` identifies the participant to themselves only. The chain sees
 * nothing but domain-separated one-way hashes of it.
 */
export type EquiVaultPrivateState = {
  readonly secretKey: Uint8Array;
  /** Set once the participant has sealed a request for this offering. */
  readonly request?: SealedRequest;
};

export const createEquiVaultPrivateState = (
  secretKey: Uint8Array,
  request?: SealedRequest,
): EquiVaultPrivateState => ({ secretKey, request });

export const withSealedRequest = (
  state: EquiVaultPrivateState,
  request: SealedRequest,
): EquiVaultPrivateState => ({ ...state, request });

/** Cryptographically strong random bytes. */
export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

const requireRequest = (state: EquiVaultPrivateState, circuit: string): SealedRequest => {
  if (state.request === undefined) {
    throw new Error(
      `EquiVault: ${circuit} needs a sealed request in private state. ` +
        'Seal a request before subscribing, and keep the same private state to claim.',
    );
  }
  return state.request;
};

export const witnesses = {
  /**
   * The participant's secret key. Used only inside circuits, to derive
   * domain-separated nullifiers. Never disclosed.
   */
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, EquiVaultPrivateState>): [EquiVaultPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  /**
   * The sealed request. `submitRequest` proves it is within the published
   * bounds; `claimAllocation` proves it opens a leaf of the request tree.
   * In neither case does the amount reach the ledger.
   */
  subscriptionRequest: ({
    privateState,
  }: WitnessContext<Ledger, EquiVaultPrivateState>): [
    EquiVaultPrivateState,
    { amount: bigint; nonce: Uint8Array },
  ] => {
    const request = requireRequest(privateState, 'subscriptionRequest');
    return [privateState, { amount: request.amount, nonce: request.nonce }];
  },

  /**
   * The pro-rata quotient.
   *
   * Compact has no division operator, so the quotient is computed here, off
   * chain, and then CONSTRAINED inside the circuit by Euclidean bounds that
   * admit exactly one integer. Supplying a wrong value here does not let a
   * participant over-allocate - it makes proof generation fail.
   */
  allocationQuotient: ({
    ledger,
    privateState,
  }: WitnessContext<Ledger, EquiVaultPrivateState>): [EquiVaultPrivateState, bigint] => {
    const request = requireRequest(privateState, 'allocationQuotient');
    return [privateState, allocationFor(request.amount, ledger.totalSupply, ledger.totalDemand)];
  },

  /**
   * A Merkle path proving the participant's commitment is one of the leaves of
   * the request tree - without revealing WHICH leaf. This is what keeps a
   * claim transaction unlinkable from the original submission transaction.
   */
  requestPath: ({
    ledger,
    privateState,
  }: WitnessContext<Ledger, EquiVaultPrivateState>): [
    EquiVaultPrivateState,
    ReturnType<Ledger['requestTree']['pathForLeaf']>,
  ] => {
    const request = requireRequest(privateState, 'requestPath');
    const commitment = pureCircuits.requestCommitment(request.amount, request.nonce);
    const path = ledger.requestTree.findPathForLeaf(commitment);
    if (path === undefined) {
      throw new Error(
        'EquiVault: this request is not in the on-chain request set. ' +
          'Either the subscription transaction has not settled yet, or this private state ' +
          'belongs to a different offering.',
      );
    }
    return [privateState, path];
  },
};

export type EquiVaultWitnesses = typeof witnesses;
