/**
 * Shared types for the EquiVault API layer.
 *
 * @module
 */

import type { FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type {
  AllocationRule,
  Contract,
  EquiVaultPrivateState,
  Phase,
  Witnesses,
} from '@equivault/contract';

export const equiVaultPrivateStateKey = 'equiVaultPrivateState';
export type PrivateStateId = typeof equiVaultPrivateStateKey;

export type PrivateStates = {
  readonly equiVaultPrivateState: EquiVaultPrivateState;
};

export type EquiVaultContractType = Contract<EquiVaultPrivateState, Witnesses<EquiVaultPrivateState>>;

export type EquiVaultCircuitKeys = Exclude<
  keyof EquiVaultContractType['impureCircuits'],
  number | symbol
>;

export type EquiVaultProviders = MidnightProviders<
  EquiVaultCircuitKeys,
  PrivateStateId,
  EquiVaultPrivateState
>;

export type DeployedEquiVaultContract = FoundContract<EquiVaultContractType>;

/**
 * The public, on-chain facts about an offering. Everything here is readable by
 * anyone, including someone who never participated.
 */
export type OfferingPublicState = {
  readonly offeringId: string;
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  readonly totalSupply: bigint;
  readonly unitPriceCents: bigint;
  readonly minRequest: bigint;
  readonly maxRequest: bigint;
  readonly subscriptionDeadline: bigint;
  readonly allocationRule: AllocationRule;
  readonly phase: Phase;
  readonly participantCount: bigint;
  readonly claimCount: bigint;
  readonly totalDemand: bigint;
  readonly allocatedTotal: bigint;
  readonly issuerCommitment: string;
  readonly requestTreeRoot: string;
};

/**
 * What the CURRENT user can additionally work out, using their own private
 * state. None of this is derivable by anyone else - it is computed locally by
 * hashing the user's secret key and checking set membership on the ledger.
 */
export type ViewerState = {
  /** True if this user is the issuer of this offering. */
  readonly isIssuer: boolean;
  /** True if this user has already submitted a private request. */
  readonly hasSubmitted: boolean;
  /** True if this user has already claimed their allocation. */
  readonly hasClaimed: boolean;
  /** The user's own requested quantity. Local only - never sent anywhere. */
  readonly myRequest?: bigint;
  /** The user's allocation, once claimed. */
  readonly myAllocation?: bigint;
  /** What the user would receive if they claimed right now. */
  readonly projectedAllocation?: bigint;
};

export type EquiVaultDerivedState = OfferingPublicState & {
  readonly viewer: ViewerState;
  /** Oversubscription, scaled by 10_000. 25_000 means 2.5x. */
  readonly oversubscriptionBps: bigint;
};
