import { describe, expect, it } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { EquiVaultSimulator } from '../simulator.js';
import { allocationFor, oversubscriptionBps, satisfiesAllocationBounds } from '../allocation.js';
import { AllocationRule, Phase, pureCircuits } from '../managed/equivault/contract/index.js';
import { randomBytes } from '../witnesses.js';

setNetworkId('undeployed');

const START = 1_800_000_000;
const DEADLINE = BigInt(START) + 3_600n;

/** The worked example from the product brief: 100k shares, 250k demand, 2.5x. */
const AURORA = {
  totalSupply: 100_000n,
  minRequest: 1n,
  // Deliberately above the supply: a single participant is allowed to bid for
  // more than the whole book, which is what makes oversubscription possible.
  maxRequest: 200_000n,
  deadline: DEADLINE,
};

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** `JSON.stringify` refuses to serialize BigInt, so widen it for snapshots. */
const stringifyState = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? `${v}` : v));

describe('EquiVault :: offering creation', () => {
  it('initializes public state from the constructor parameters', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    const l = sim.getLedger();

    expect(l.totalSupply).toEqual(100_000n);
    expect(l.unitPriceCents).toEqual(2_500n);
    expect(l.phase).toEqual(Phase.OPEN);
    expect(l.allocationRule).toEqual(AllocationRule.PRO_RATA);
    expect(l.totalDemand).toEqual(0n);
    expect(l.allocatedTotal).toEqual(0n);
    expect(l.participantCount).toEqual(0n);
    expect(l.claimCount).toEqual(0n);
    expect(l.resourceName).toEqual('Aurora Energy Systems');
    expect(l.resourceUnit).toEqual('shares');
  });

  it('commits to the issuer without publishing the issuer secret key', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    const issuerSecret = sim.getPrivateState().secretKey;
    const l = sim.getLedger();

    expect(l.issuerCommitment).toHaveLength(32);
    expect(toHex(l.issuerCommitment)).not.toEqual(toHex(issuerSecret));
  });

  it('rejects an offering with zero supply', async () => {
    await expect(EquiVaultSimulator.create({ ...AURORA, totalSupply: 0n }, START)).rejects.toThrow(
      /supply must be positive/,
    );
  });

  it('rejects an offering whose minimum exceeds its maximum', async () => {
    await expect(
      EquiVaultSimulator.create({ ...AURORA, minRequest: 500n, maxRequest: 100n }, START),
    ).rejects.toThrow(/minimum exceeds maximum/);
  });

  it('rejects an offering above the quantity cap', async () => {
    await expect(
      EquiVaultSimulator.create({ ...AURORA, totalSupply: 2_000_000_000_000n }, START),
    ).rejects.toThrow(/supply exceeds maximum/);
  });
});

describe('EquiVault :: private subscription', () => {
  it('accepts a valid private request and publishes only aggregates', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    const l = sim.getLedger();

    expect(l.participantCount).toEqual(1n);
    expect(l.totalDemand).toEqual(40_000n);
    expect(l.submissionNullifiers.size()).toEqual(1n);
    expect(l.requestTree.firstFree()).toEqual(1n);
  });

  it('accumulates aggregate demand across participants', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    await sim.subscribeAs('bob', 25_000n);
    await sim.subscribeAs('carol', 15_000n);
    await sim.subscribeAs('dave', 50_000n);

    const l = sim.getLedger();
    expect(l.participantCount).toEqual(4n);
    expect(l.totalDemand).toEqual(130_000n);
  });

  it('rejects a request below the offering minimum', async () => {
    const sim = await EquiVaultSimulator.create({ ...AURORA, minRequest: 1_000n }, START);
    sim.switchTo('alice');
    sim.sealRequest(999n);
    await expect(sim.submitRequest()).rejects.toThrow(/below offering minimum/);
  });

  it('rejects a request above the offering maximum', async () => {
    const sim = await EquiVaultSimulator.create({ ...AURORA, maxRequest: 10_000n }, START);
    sim.switchTo('alice');
    sim.sealRequest(10_001n);
    await expect(sim.submitRequest()).rejects.toThrow(/above offering maximum/);
  });

  it('rejects a second request from the same secret key', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    sim.sealRequest(10_000n);
    await expect(sim.submitRequest()).rejects.toThrow(/already subscribed/);
  });

  it('rejects a request once the deadline has passed', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    sim.setBlockTime(DEADLINE + 1n);
    sim.switchTo('alice');
    sim.sealRequest(40_000n);
    await expect(sim.submitRequest()).rejects.toThrow(/deadline has passed/);
  });

  it('rejects a request once the offering is closed', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    sim.switchTo('issuer');
    await sim.closeSubscriptionAsIssuer();
    sim.switchTo('bob');
    sim.sealRequest(10_000n);
    await expect(sim.submitRequest()).rejects.toThrow(/not open/);
  });
});

describe('EquiVault :: lifecycle and authorization', () => {
  it('lets the issuer close the subscription early', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    sim.switchTo('issuer');
    const l = await sim.closeSubscriptionAsIssuer();
    expect(l.phase).toEqual(Phase.CLOSED);
  });

  it('rejects an early close by a non-issuer', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('mallory', 40_000n);
    await expect(sim.closeSubscriptionAsIssuer()).rejects.toThrow(/not the issuer/);
  });

  it('lets anyone close once the deadline has passed', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    sim.switchTo('stranger');
    sim.setBlockTime(DEADLINE + 1n);
    const l = await sim.closeSubscriptionAfterDeadline();
    expect(l.phase).toEqual(Phase.CLOSED);
  });

  it('refuses a deadline close before the deadline', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    sim.switchTo('stranger');
    await expect(sim.closeSubscriptionAfterDeadline()).rejects.toThrow(/deadline has not passed/);
  });

  it('rejects finalization by a non-issuer', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    sim.switchTo('issuer');
    await sim.closeSubscriptionAsIssuer();
    sim.switchTo('mallory');
    await expect(sim.finalizeAllocation()).rejects.toThrow(/not the issuer/);
  });

  it('rejects finalization before the offering is closed', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    sim.switchTo('issuer');
    await expect(sim.finalizeAllocation()).rejects.toThrow(/not closed/);
  });

  it('lets the issuer finalize a closed offering', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    sim.switchTo('issuer');
    await sim.closeSubscriptionAsIssuer();
    const l = await sim.finalizeAllocation();
    expect(l.phase).toEqual(Phase.FINALIZED);
  });
});

/** Drives a full offering to FINALIZED with the given participant demands. */
const runOffering = async (
  demands: Record<string, bigint>,
  overrides: Partial<typeof AURORA> = {},
): Promise<EquiVaultSimulator> => {
  const sim = await EquiVaultSimulator.create({ ...AURORA, ...overrides }, START);
  for (const [label, amount] of Object.entries(demands)) {
    await sim.subscribeAs(label, amount);
  }
  sim.switchTo('issuer');
  await sim.closeSubscriptionAsIssuer();
  await sim.finalizeAllocation();
  return sim;
};

describe('EquiVault :: oversubscribed allocation', () => {
  const DEMANDS = {
    alice: 40_000n,
    bob: 25_000n,
    carol: 15_000n,
    dave: 50_000n,
    erin: 120_000n,
  };
  const TOTAL_DEMAND = 250_000n;

  it('reports a 2.5x oversubscription', async () => {
    const sim = await runOffering(DEMANDS);
    const l = sim.getLedger();
    expect(l.totalDemand).toEqual(TOTAL_DEMAND);
    expect(oversubscriptionBps(l.totalSupply, l.totalDemand)).toEqual(25_000n);
  });

  it('allocates each participant their exact pro-rata share', async () => {
    const sim = await runOffering(DEMANDS);

    for (const [label, requested] of Object.entries(DEMANDS)) {
      sim.switchTo(label);
      const allocation = await sim.claimAllocation();
      const expected = allocationFor(requested, 100_000n, TOTAL_DEMAND);
      expect(allocation).toEqual(expected);
      expect(satisfiesAllocationBounds(allocation, requested, 100_000n, TOTAL_DEMAND)).toBe(true);
    }
  });

  it('matches the worked example from the product brief', async () => {
    // 40,000 requested of 250,000 demand for 100,000 shares => 16,000 shares.
    expect(allocationFor(40_000n, 100_000n, 250_000n)).toEqual(16_000n);
    // 8,000 requested => 3,200 shares, the figure quoted on the results page.
    expect(allocationFor(8_000n, 100_000n, 250_000n)).toEqual(3_200n);
  });

  it('never allocates more than the supply', async () => {
    const sim = await runOffering(DEMANDS);
    for (const label of Object.keys(DEMANDS)) {
      sim.switchTo(label);
      await sim.claimAllocation();
    }
    const l = sim.getLedger();
    expect(l.allocatedTotal).toBeLessThanOrEqual(l.totalSupply);
    expect(l.claimCount).toEqual(5n);
  });

  it('is independent of the order participants subscribe in', async () => {
    const forward = await runOffering(DEMANDS);
    const reversed = await runOffering(
      Object.fromEntries(Object.entries(DEMANDS).reverse()) as typeof DEMANDS,
    );

    forward.switchTo('carol');
    reversed.switchTo('carol');
    // Same request, same public aggregates => same allocation, regardless of order.
    expect(forward.getLedger().totalDemand).toEqual(reversed.getLedger().totalDemand);
    expect(await forward.claimAllocation()).toEqual(await reversed.claimAllocation());
  });
});

describe('EquiVault :: undersubscribed allocation', () => {
  it('fills every request completely', async () => {
    const demands = { alice: 10_000n, bob: 5_000n, carol: 2_500n };
    const sim = await runOffering(demands);
    expect(sim.getLedger().totalDemand).toEqual(17_500n);

    for (const [label, requested] of Object.entries(demands)) {
      sim.switchTo(label);
      expect(await sim.claimAllocation()).toEqual(requested);
    }
    expect(sim.getLedger().allocatedTotal).toEqual(17_500n);
  });

  it('fills exactly at the boundary where demand equals supply', async () => {
    const demands = { alice: 60_000n, bob: 40_000n };
    const sim = await runOffering(demands);
    expect(sim.getLedger().totalDemand).toEqual(100_000n);

    sim.switchTo('alice');
    expect(await sim.claimAllocation()).toEqual(60_000n);
    sim.switchTo('bob');
    expect(await sim.claimAllocation()).toEqual(40_000n);
    expect(sim.getLedger().allocatedTotal).toEqual(100_000n);
  });
});

describe('EquiVault :: claiming', () => {
  const DEMANDS = { alice: 40_000n, bob: 60_000n, carol: 150_000n };

  it('rejects a claim before the offering is finalized', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    await expect(sim.claimAllocation()).rejects.toThrow(/not finalized/);
  });

  it('rejects a second claim from the same secret key', async () => {
    const sim = await runOffering(DEMANDS);
    sim.switchTo('alice');
    await sim.claimAllocation();
    await expect(sim.claimAllocation()).rejects.toThrow(/already claimed/);
  });

  it('rejects a claim from someone who never subscribed', async () => {
    const sim = await runOffering(DEMANDS);
    sim.switchTo('mallory');
    sim.sealRequest(90_000n);
    await expect(sim.claimAllocation()).rejects.toThrow(/not in the on-chain request set/);
  });

  it('rejects a claim that inflates the requested amount', async () => {
    const sim = await runOffering(DEMANDS);
    sim.switchTo('alice');
    const original = sim.getPrivateState().request!;
    // Keep the original nonce but claim a larger amount: the commitment no
    // longer matches any leaf of the request tree.
    sim.sealRequest(999_000n, original.nonce);
    await expect(sim.claimAllocation()).rejects.toThrow(/not in the on-chain request set/);
  });

  it('records the allocation against an unlinkable claim nullifier', async () => {
    const sim = await runOffering(DEMANDS);
    sim.switchTo('alice');
    const allocation = await sim.claimAllocation();

    const l = sim.getLedger();
    const receipts = [...l.allocationReceipts];
    expect(receipts).toHaveLength(1);

    const [claimNullifier, recorded] = receipts[0]!;
    expect(recorded).toEqual(allocation);
    // The claim nullifier is NOT the submission nullifier, so the two
    // transactions cannot be tied together by an observer.
    expect(l.submissionNullifiers.member(claimNullifier)).toBe(false);
  });
});

describe('EquiVault :: privacy invariants', () => {
  const DEMANDS = { alice: 40_000n, bob: 25_000n, carol: 15_000n, dave: 50_000n, erin: 120_000n };

  /** Collects every scalar that appears anywhere in the public state. */
  const publicScalars = (snapshot: Record<string, unknown>): bigint[] => {
    const found: bigint[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'bigint') {
        found.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(walk);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(walk);
      }
    };
    walk(snapshot);
    return found;
  };

  it('never writes an individual requested quantity to the ledger', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    // Use quantities that cannot arise as a sum, a count or an allocation.
    const secretAmounts = [40_001n, 25_003n, 15_007n];
    await sim.subscribeAs('alice', secretAmounts[0]!);
    await sim.subscribeAs('bob', secretAmounts[1]!);
    await sim.subscribeAs('carol', secretAmounts[2]!);

    const scalars = publicScalars(sim.publicStateSnapshot());
    for (const secret of secretAmounts) {
      expect(scalars).not.toContain(secret);
    }
  });

  it('never writes a participant secret key to the ledger', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    sim.switchTo('alice');
    const secretKey = toHex(sim.getPrivateState().secretKey);
    sim.sealRequest(40_000n);
    await sim.submitRequest();

    expect(stringifyState(sim.publicStateSnapshot())).not.toContain(secretKey);
  });

  it('never writes a commitment opening to the ledger', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    sim.switchTo('alice');
    const sealed = sim.sealRequest(40_000n);
    await sim.submitRequest();

    expect(stringifyState(sim.publicStateSnapshot())).not.toContain(toHex(sealed.nonce));
  });

  it('produces commitments that hide the amount', async () => {
    // The same amount with two different openings yields unrelated commitments,
    // so an observer cannot brute-force amounts from the published commitment.
    const amount = 40_000n;
    const a = pureCircuits.requestCommitment(amount, randomBytes(32));
    const b = pureCircuits.requestCommitment(amount, randomBytes(32));
    expect(toHex(a)).not.toEqual(toHex(b));
  });

  it('produces commitments that bind the amount', async () => {
    const nonce = randomBytes(32);
    const a = pureCircuits.requestCommitment(40_000n, nonce);
    const b = pureCircuits.requestCommitment(40_001n, nonce);
    expect(toHex(a)).not.toEqual(toHex(b));
  });

  it('gives the same secret key unlinkable nullifiers across offerings', async () => {
    const secretKey = randomBytes(32);
    const domain = new Uint8Array(32);
    domain.set(new TextEncoder().encode('submit'));

    const offeringA = randomBytes(32);
    const offeringB = randomBytes(32);

    const tagA = pureCircuits.identityTag(offeringA, secretKey, domain);
    const tagB = pureCircuits.identityTag(offeringB, secretKey, domain);
    expect(toHex(tagA)).not.toEqual(toHex(tagB));
  });

  it('gives the same secret key unlinkable tags across domains', async () => {
    const secretKey = randomBytes(32);
    const offeringId = randomBytes(32);
    const pad = (s: string): Uint8Array => {
      const out = new Uint8Array(32);
      out.set(new TextEncoder().encode(s));
      return out;
    };

    const submit = pureCircuits.identityTag(offeringId, secretKey, pad('submit'));
    const claim = pureCircuits.identityTag(offeringId, secretKey, pad('claim'));
    const issuer = pureCircuits.identityTag(offeringId, secretKey, pad('issuer'));

    expect(new Set([toHex(submit), toHex(claim), toHex(issuer)]).size).toEqual(3);
  });

  it('does not let the issuer read participant requests from public state', async () => {
    const sim = await runOffering(DEMANDS);
    const snapshot = sim.publicStateSnapshot();
    const scalars = publicScalars(snapshot);

    // The issuer sees the aggregate, never the parts.
    expect(scalars).toContain(250_000n);
    expect(snapshot.participantCount).toEqual(5n);
    // 120,000 is erin's private request and appears nowhere on the ledger.
    expect(scalars).not.toContain(120_000n);
  });

  it('publishes commitments an attacker cannot match even knowing the amount', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    sim.switchTo('alice');
    const sealed = sim.sealRequest(40_000n);
    await sim.submitRequest();

    const tree = sim.getLedger().requestTree;

    // With the opening, the participant can locate their own leaf.
    const real = pureCircuits.requestCommitment(sealed.amount, sealed.nonce);
    expect(tree.findPathForLeaf(real)).toBeDefined();

    // An attacker who has correctly guessed the amount still cannot produce the
    // published commitment, because they do not hold the 32-byte opening.
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const guess = pureCircuits.requestCommitment(40_000n, randomBytes(32));
      expect(tree.findPathForLeaf(guess)).toBeUndefined();
    }
  });
});

describe('EquiVault :: allocation rule properties', () => {
  it('is exactly reproducible from public state alone plus one private request', () => {
    expect(allocationFor(40_000n, 100_000n, 250_000n)).toEqual(16_000n);
    expect(allocationFor(25_000n, 100_000n, 250_000n)).toEqual(10_000n);
    expect(allocationFor(15_000n, 100_000n, 250_000n)).toEqual(6_000n);
    expect(allocationFor(50_000n, 100_000n, 250_000n)).toEqual(20_000n);
  });

  it('floors rather than rounding, so the pool can never be oversold', () => {
    // 3 participants each asking for 1 unit of a 1-unit supply.
    expect(allocationFor(1n, 1n, 3n)).toEqual(0n);
  });

  it('sums to at most the total supply for random populations', () => {
    for (let trial = 0; trial < 200; trial += 1) {
      const supply = BigInt(1 + Math.floor(Math.random() * 1_000_000));
      const requests = Array.from(
        { length: 1 + Math.floor(Math.random() * 25) },
        () => BigInt(1 + Math.floor(Math.random() * 500_000)),
      );
      const demand = requests.reduce((a, b) => a + b, 0n);
      const allocated = requests.reduce((sum, r) => sum + allocationFor(r, supply, demand), 0n);
      expect(allocated).toBeLessThanOrEqual(supply);
    }
  });

  it('rejects allocation against zero demand', () => {
    expect(() => allocationFor(10n, 100n, 0n)).toThrow(/zero demand/);
  });

  it('accepts only the single correct quotient', () => {
    const correct = allocationFor(40_000n, 100_000n, 250_000n);
    expect(satisfiesAllocationBounds(correct, 40_000n, 100_000n, 250_000n)).toBe(true);
    expect(satisfiesAllocationBounds(correct + 1n, 40_000n, 100_000n, 250_000n)).toBe(false);
    expect(satisfiesAllocationBounds(correct - 1n, 40_000n, 100_000n, 250_000n)).toBe(false);
  });
});
