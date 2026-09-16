/**
 * Demo Mode.
 *
 * What this is: the real compiled EquiVault circuits, executed locally against
 * an in-memory ledger. Every assertion in `equivault.compact` runs - range
 * checks, nullifier uniqueness, issuer authorization, Merkle membership and the
 * verified-division bounds. If the contract would reject something on Midnight,
 * it is rejected here too, with the same message.
 *
 * What this is NOT: it does not generate zero-knowledge proofs (that needs a
 * proof server), it does not verify them (that is done by Midnight consensus),
 * and nothing settles on a real ledger. Demo Mode is labelled everywhere it is
 * used, and `DEMO_CAPABILITIES` says so in machine-readable form.
 *
 * It exists so a first-time visitor can experience the whole allocation
 * lifecycle in about a minute, with no wallet, no tokens and no Docker.
 *
 * @module
 */

import { EquiVaultAPI, type EquiVaultDerivedState } from '@equivault/api';
import { EquiVaultSimulator } from '@equivault/contract';
import {
  DEMO_CAPABILITIES,
  type OfferingSession,
  StateStore,
} from './session';

/** The person using the app is always this participant in Demo Mode. */
export const VIEWER = 'you';

export type DemoOfferingSeed = {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  readonly totalSupply: bigint;
  readonly unitPriceCents: bigint;
  readonly minRequest: bigint;
  readonly maxRequest: bigint;
  /** Seconds from now until the subscription window closes. */
  readonly closesInSeconds: number;
  /**
   * Requests from other participants, seeded before the viewer arrives.
   * These amounts live only in each simulated participant's private state -
   * they are never readable from the offering's public state, which is the
   * whole point of the demonstration.
   */
  readonly seededRequests: readonly bigint[];
  /** Advance the offering to this phase during seeding. */
  readonly seedTo?: 'open' | 'closed' | 'finalized';
};

/**
 * The seeded catalogue. Fictional companies, simulated shares - plus one
 * deliberately non-financial offering, because the underlying primitive is
 * allocation, not equity.
 */
export const DEMO_SEEDS: readonly DemoOfferingSeed[] = [
  {
    slug: 'aurora-energy-systems',
    name: 'Aurora Energy Systems',
    description:
      'Grid-scale clean energy infrastructure. A simulated offering used to demonstrate private allocation under heavy oversubscription.',
    unit: 'shares',
    totalSupply: 100_000n,
    unitPriceCents: 2_500n,
    minRequest: 100n,
    maxRequest: 150_000n,
    closesInSeconds: 60 * 47,
    // 250,000 total demand against 100,000 shares => exactly 2.5x.
    seededRequests: [40_000n, 25_000n, 15_000n, 50_000n, 120_000n],
  },
  {
    slug: 'meridian-biotech',
    name: 'Meridian Biotech',
    description:
      'Late-stage therapeutics platform. A simulated offering that is closed and finalized, so the allocation result and verification can be inspected immediately.',
    unit: 'shares',
    totalSupply: 50_000n,
    unitPriceCents: 4_200n,
    minRequest: 50n,
    maxRequest: 60_000n,
    closesInSeconds: -120,
    seededRequests: [18_000n, 9_500n, 27_000n, 12_500n],
    seedTo: 'finalized',
  },
  {
    slug: 'northwind-scholarship',
    name: 'Northwind Scholarship Fund',
    description:
      'One hundred scholarships, allocated across applicants who privately declare how much support they need. The same contract, the same proof, no money involved.',
    unit: 'scholarships',
    totalSupply: 100n,
    unitPriceCents: 0n,
    minRequest: 1n,
    maxRequest: 5n,
    closesInSeconds: 60 * 60 * 18,
    seededRequests: [3n, 2n, 5n, 4n, 2n, 3n, 1n, 5n],
  },
];

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * One demo offering: a simulator, plus the bookkeeping needed to present it
 * through the same interface as a live, on-chain offering.
 */
export class DemoOfferingSession implements OfferingSession {
  readonly mode = 'demo' as const;
  readonly capabilities = DEMO_CAPABILITIES;

  private readonly store: StateStore<EquiVaultDerivedState>;

  private constructor(
    readonly address: string,
    readonly seed: DemoOfferingSeed,
    private readonly sim: EquiVaultSimulator,
  ) {
    this.store = new StateStore(this.derive());
  }

  static async create(seed: DemoOfferingSeed): Promise<DemoOfferingSession> {
    const start = nowSeconds();
    const deadline = start + seed.closesInSeconds;

    // An offering seeded as already-closed has a deadline in the past, so the
    // simulated clock has to start BEFORE that deadline - otherwise the
    // contract correctly rejects the seeded subscriptions as late.
    const seedTime = seed.closesInSeconds <= 0 ? deadline - 60 : start;

    const sim = await EquiVaultSimulator.create(
      {
        name: seed.name,
        description: seed.description,
        unit: seed.unit,
        totalSupply: seed.totalSupply,
        unitPriceCents: seed.unitPriceCents,
        minRequest: seed.minRequest,
        maxRequest: seed.maxRequest,
        deadline: BigInt(deadline),
      },
      seedTime,
    );

    // Seed other participants. Each gets their own secret key and their own
    // private request - the simulator keeps them genuinely separate.
    for (const [index, amount] of seed.seededRequests.entries()) {
      await sim.subscribeAs(`participant-${index + 1}`, amount);
    }

    // Bring the simulated clock up to the present.
    sim.setBlockTime(BigInt(start));

    const target = seed.seedTo ?? 'open';
    if (target !== 'open') {
      if (start >= deadline) {
        // Deadline has passed: anyone may close.
        sim.switchTo('closer');
        await sim.closeSubscriptionAfterDeadline();
      } else {
        sim.switchTo('issuer');
        await sim.closeSubscriptionAsIssuer();
      }
      if (target === 'finalized') {
        sim.switchTo('issuer');
        await sim.finalizeAllocation();
      }
    }

    // Hand control to the viewer for the rest of the session.
    sim.switchTo(VIEWER);
    return new DemoOfferingSession(`demo:${seed.slug}`, seed, sim);
  }

  getState(): EquiVaultDerivedState {
    return this.store.get();
  }

  subscribe(listener: (state: EquiVaultDerivedState) => void): () => void {
    return this.store.subscribe(listener);
  }

  /** Reuses the production derivation, so demo and live states are identical in shape. */
  private derive(): EquiVaultDerivedState {
    this.sim.switchTo(VIEWER);
    return EquiVaultAPI.deriveState(this.sim.getLedger(), this.sim.getPrivateState());
  }

  private publish(): void {
    this.store.set(this.derive());
  }

  /** Keeps the simulated clock just behind the real one so deadlines behave. */
  private syncClock(): void {
    this.sim.setBlockTime(BigInt(nowSeconds()));
  }

  async submitRequest(amount: bigint): Promise<void> {
    this.syncClock();
    this.sim.switchTo(VIEWER);
    this.sim.sealRequest(amount);
    try {
      await this.sim.submitRequest();
    } finally {
      this.publish();
    }
  }

  async closeSubscription(): Promise<void> {
    this.syncClock();
    const deadlinePassed = BigInt(nowSeconds()) >= this.getState().subscriptionDeadline;
    // The demo viewer is not the issuer, so they may only use the
    // permissionless path. Before the deadline, the issuer closes.
    if (deadlinePassed) {
      this.sim.switchTo(VIEWER);
      await this.sim.closeSubscriptionAfterDeadline();
    } else {
      this.sim.switchTo('issuer');
      await this.sim.closeSubscriptionAsIssuer();
    }
    this.publish();
  }

  async finalizeAllocation(): Promise<void> {
    this.sim.switchTo('issuer');
    try {
      await this.sim.finalizeAllocation();
    } finally {
      this.publish();
    }
  }

  async claimAllocation(): Promise<bigint> {
    this.sim.switchTo(VIEWER);
    try {
      return await this.sim.claimAllocation();
    } finally {
      this.publish();
    }
  }

  /**
   * Lets every seeded participant claim, so the results page shows a fully
   * settled offering. Used by the "run the whole offering" demo control.
   */
  async settleSeededParticipants(): Promise<void> {
    for (let index = 0; index < this.seed.seededRequests.length; index += 1) {
      this.sim.switchTo(`participant-${index + 1}`);
      try {
        await this.sim.claimAllocation();
      } catch {
        // A participant who already claimed is fine; keep going.
      }
    }
    this.publish();
  }

  /** The raw ledger, for the verification screen. */
  getLedger(): ReturnType<EquiVaultSimulator['getLedger']> {
    return this.sim.getLedger();
  }
}

/**
 * The full demo world: every seeded offering, created once and shared.
 */
export class DemoWorld {
  private constructor(readonly sessions: readonly DemoOfferingSession[]) {}

  private static pending: Promise<DemoWorld> | undefined;

  static load(): Promise<DemoWorld> {
    DemoWorld.pending ??= (async () => {
      const sessions = [];
      for (const seed of DEMO_SEEDS) {
        sessions.push(await DemoOfferingSession.create(seed));
      }
      return new DemoWorld(sessions);
    })();
    return DemoWorld.pending;
  }

  /** Rebuilds everything from scratch - the demo reset control. */
  static reset(): Promise<DemoWorld> {
    DemoWorld.pending = undefined;
    return DemoWorld.load();
  }

  find(address: string): DemoOfferingSession | undefined {
    return this.sessions.find((session) => session.address === address);
  }
}
