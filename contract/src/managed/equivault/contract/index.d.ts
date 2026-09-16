import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Phase { OPEN = 0, CLOSED = 1, FINALIZED = 2 }

export enum AllocationRule { PRO_RATA = 0 }

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  subscriptionRequest(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { amount: bigint,
                                                                                    nonce: Uint8Array
                                                                                  }];
  allocationQuotient(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  requestPath(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { leaf: Uint8Array,
                                                                            path: { sibling: { field: bigint
                                                                                             },
                                                                                    goes_left: boolean
                                                                                  }[]
                                                                          }];
}

export type ImpureCircuits<PS> = {
  submitRequest(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeSubscriptionAsIssuer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeSubscriptionAfterDeadline(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  finalizeAllocation(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimAllocation(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type ProvableCircuits<PS> = {
  submitRequest(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeSubscriptionAsIssuer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeSubscriptionAfterDeadline(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  finalizeAllocation(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimAllocation(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type PureCircuits = {
  identityTag(id_0: Uint8Array, sk_0: Uint8Array, domain_0: Uint8Array): Uint8Array;
  requestCommitment(amount_0: bigint, nonce_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  identityTag(context: __compactRuntime.CircuitContext<PS>,
              id_0: Uint8Array,
              sk_0: Uint8Array,
              domain_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  requestCommitment(context: __compactRuntime.CircuitContext<PS>,
                    amount_0: bigint,
                    nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  submitRequest(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeSubscriptionAsIssuer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeSubscriptionAfterDeadline(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  finalizeAllocation(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimAllocation(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type Ledger = {
  requestTree: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  readonly offeringId: Uint8Array;
  readonly resourceName: string;
  readonly resourceDescription: string;
  readonly resourceUnit: string;
  readonly totalSupply: bigint;
  readonly unitPriceCents: bigint;
  readonly minRequest: bigint;
  readonly maxRequest: bigint;
  readonly subscriptionDeadline: bigint;
  readonly allocationRule: AllocationRule;
  readonly phase: Phase;
  readonly issuerCommitment: Uint8Array;
  readonly participantCount: bigint;
  readonly claimCount: bigint;
  readonly totalDemand: bigint;
  readonly allocatedTotal: bigint;
  submissionNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  claimNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  allocationReceipts: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               id_0: Uint8Array,
               name_0: string,
               description_0: string,
               unit_0: string,
               supply_0: bigint,
               priceCents_0: bigint,
               minReq_0: bigint,
               maxReq_0: bigint,
               deadline_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
