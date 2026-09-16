/**
 * A multi-participant test harness for the EquiVault contract.
 *
 * It runs the real compiled circuits against a real in-memory ledger, so every
 * assertion, nullifier check and Merkle proof in `equivault.compact` is
 * genuinely exercised. Only the network and the proof server are absent.
 *
 * Each participant has their OWN private state. The simulator swaps the active
 * private state in and out of a shared ledger context, which is exactly the
 * situation the contract is designed for: many mutually distrusting parties
 * writing to one public state.
 *
 * @module
 */

import {
  type CircuitContext,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
} from './managed/equivault/contract/index.js';
import {
  type EquiVaultPrivateState,
  type SealedRequest,
  createEquiVaultPrivateState,
  randomBytes,
  witnesses,
} from './witnesses.js';

export type OfferingParams = {
  offeringId?: Uint8Array;
  name?: string;
  description?: string;
  unit?: string;
  totalSupply: bigint;
  unitPriceCents?: bigint;
  minRequest?: bigint;
  maxRequest?: bigint;
  /** Unix seconds. Defaults to one hour after the simulator's start time. */
  deadline?: bigint;
};

const ONE_HOUR = 3_600n;

export class EquiVaultSimulator {
  readonly contract: Contract<EquiVaultPrivateState>;
  readonly contractAddress: string;
  circuitContext: CircuitContext<EquiVaultPrivateState>;

  /** Per-participant private state, keyed by a friendly test label. */
  private readonly participants = new Map<string, EquiVaultPrivateState>();
  private activeParticipant = 'issuer';

  private constructor(
    contract: Contract<EquiVaultPrivateState>,
    contractAddress: string,
    circuitContext: CircuitContext<EquiVaultPrivateState>,
    issuerState: EquiVaultPrivateState,
  ) {
    this.contract = contract;
    this.contractAddress = contractAddress;
    this.circuitContext = circuitContext;
    this.participants.set('issuer', issuerState);
  }

  /** Deploys a fresh offering, with the caller acting as the issuer. */
  static async create(params: OfferingParams, startTime = 1_800_000_000): Promise<EquiVaultSimulator> {
    const contract = new Contract<EquiVaultPrivateState>(witnesses);
    const issuerState = createEquiVaultPrivateState(randomBytes(32));
    const contractAddress = sampleContractAddress();

    const offeringId = params.offeringId ?? randomBytes(32);
    const deadline = params.deadline ?? BigInt(startTime) + ONE_HOUR;

    const { currentContractState, currentPrivateState, currentZswapLocalState } =
      contract.initialState(
        createConstructorContext(issuerState, '0'.repeat(64)),
        offeringId,
        params.name ?? 'Aurora Energy Systems',
        params.description ?? 'Clean energy infrastructure (simulated offering)',
        params.unit ?? 'shares',
        params.totalSupply,
        params.unitPriceCents ?? 2_500n,
        params.minRequest ?? 1n,
        params.maxRequest ?? params.totalSupply,
        deadline,
      );

    const circuitContext = createCircuitContext<EquiVaultPrivateState>(
      contractAddress,
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
      undefined,
      undefined,
      startTime,
    );

    return new EquiVaultSimulator(contract, contractAddress, circuitContext, currentPrivateState);
  }

  // --- participants --------------------------------------------------------

  /**
   * Switches the active participant, creating a brand-new secret key the first
   * time a label is seen. Mirrors a different person opening the dApp.
   */
  switchTo(label: string): this {
    this.participants.set(this.activeParticipant, this.circuitContext.currentPrivateState);
    const existing = this.participants.get(label) ?? createEquiVaultPrivateState(randomBytes(32));
    this.participants.set(label, existing);
    this.activeParticipant = label;
    this.circuitContext = { ...this.circuitContext, currentPrivateState: existing };
    return this;
  }

  /** Seals a request into the active participant's private state. */
  sealRequest(amount: bigint, nonce: Uint8Array = randomBytes(32)): SealedRequest {
    const request: SealedRequest = { amount, nonce };
    this.setPrivateState({ ...this.circuitContext.currentPrivateState, request });
    return request;
  }

  getPrivateState(): EquiVaultPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  private setPrivateState(state: EquiVaultPrivateState): void {
    this.circuitContext = { ...this.circuitContext, currentPrivateState: state };
    this.participants.set(this.activeParticipant, state);
  }

  // --- time ----------------------------------------------------------------

  /** Moves the simulated block clock, so deadline behaviour can be tested. */
  setBlockTime(secondsSinceEpoch: bigint): this {
    this.circuitContext.currentQueryContext.block = {
      ...this.circuitContext.currentQueryContext.block,
      secondsSinceEpoch,
    };
    return this;
  }

  // --- public state --------------------------------------------------------

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /**
   * Every byte of public state, as a plain object. The privacy tests walk this
   * to assert that no private quantity ever appears on the ledger.
   */
  publicStateSnapshot(): Record<string, unknown> {
    const l = this.getLedger();
    return {
      offeringId: Array.from(l.offeringId),
      resourceName: l.resourceName,
      resourceDescription: l.resourceDescription,
      resourceUnit: l.resourceUnit,
      totalSupply: l.totalSupply,
      unitPriceCents: l.unitPriceCents,
      minRequest: l.minRequest,
      maxRequest: l.maxRequest,
      subscriptionDeadline: l.subscriptionDeadline,
      allocationRule: l.allocationRule,
      phase: l.phase,
      issuerCommitment: Array.from(l.issuerCommitment),
      participantCount: l.participantCount,
      claimCount: l.claimCount,
      totalDemand: l.totalDemand,
      allocatedTotal: l.allocatedTotal,
      submissionNullifiers: [...l.submissionNullifiers].map((n) => Array.from(n)),
      claimNullifiers: [...l.claimNullifiers].map((n) => Array.from(n)),
      allocationReceipts: [...l.allocationReceipts].map(([k, v]) => [Array.from(k), v]),
      requestTreeRoot: l.requestTree.root().toString(),
      requestTreeFirstFree: l.requestTree.firstFree(),
    };
  }

  // --- circuits ------------------------------------------------------------

  async submitRequest(): Promise<Ledger> {
    const { context } = this.contract.impureCircuits.submitRequest(this.circuitContext);
    this.commit(context);
    return this.getLedger();
  }

  async closeSubscriptionAsIssuer(): Promise<Ledger> {
    const { context } = this.contract.impureCircuits.closeSubscriptionAsIssuer(this.circuitContext);
    this.commit(context);
    return this.getLedger();
  }

  async closeSubscriptionAfterDeadline(): Promise<Ledger> {
    const { context } = this.contract.impureCircuits.closeSubscriptionAfterDeadline(this.circuitContext);
    this.commit(context);
    return this.getLedger();
  }

  async finalizeAllocation(): Promise<Ledger> {
    const { context } = this.contract.impureCircuits.finalizeAllocation(this.circuitContext);
    this.commit(context);
    return this.getLedger();
  }

  async claimAllocation(): Promise<bigint> {
    const { context, result } = this.contract.impureCircuits.claimAllocation(this.circuitContext);
    this.commit(context);
    return result;
  }

  /**
   * Applies a circuit result. The ledger and private state move forward
   * together, and the updated private state is retained for this participant.
   */
  private commit(context: CircuitContext<EquiVaultPrivateState>): void {
    this.circuitContext = context;
    this.participants.set(this.activeParticipant, context.currentPrivateState);
  }

  // --- convenience ---------------------------------------------------------

  /** Seals and submits a request as a named participant, in one step. */
  async subscribeAs(label: string, amount: bigint): Promise<Ledger> {
    this.switchTo(label);
    this.sealRequest(amount);
    return this.submitRequest();
  }
}

