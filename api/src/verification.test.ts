import { describe, expect, it } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { EquiVaultSimulator } from '@equivault/contract';
import {
  buildVerificationReport,
  checkPublicInvariants,
  recomputeAllocationMath,
  sha256Hex,
  verifyCircuitBinding,
} from './verification.js';

setNetworkId('undeployed');

const START = 1_800_000_000;

const AURORA = {
  totalSupply: 100_000n,
  minRequest: 1n,
  maxRequest: 200_000n,
  deadline: BigInt(START) + 3_600n,
};

/** Runs a complete offering and lets everyone claim. */
const completedOffering = async (demands: Record<string, bigint>): Promise<EquiVaultSimulator> => {
  const sim = await EquiVaultSimulator.create(AURORA, START);
  for (const [label, amount] of Object.entries(demands)) {
    await sim.subscribeAs(label, amount);
  }
  sim.switchTo('issuer');
  await sim.closeSubscriptionAsIssuer();
  await sim.finalizeAllocation();
  for (const label of Object.keys(demands)) {
    sim.switchTo(label);
    await sim.claimAllocation();
  }
  return sim;
};

const DEMANDS = {
  alice: 40_000n,
  bob: 25_000n,
  carol: 15_000n,
  dave: 50_000n,
  erin: 120_000n,
};

describe('verification :: allocation math', () => {
  it('recomputes the oversubscription ratio from public state alone', async () => {
    const sim = await completedOffering(DEMANDS);
    const math = recomputeAllocationMath(sim.getLedger());

    expect(math.totalDemand).toEqual(250_000n);
    expect(math.totalSupply).toEqual(100_000n);
    expect(math.oversubscriptionBps).toEqual(25_000n); // 2.5x
    expect(math.isOversubscribed).toBe(true);
  });

  it('reports the rounding remainder that stays unallocated', async () => {
    const sim = await completedOffering(DEMANDS);
    const math = recomputeAllocationMath(sim.getLedger());

    expect(math.allocatedTotal).toBeLessThanOrEqual(math.totalSupply);
    expect(math.unallocatedRemainder).toEqual(math.totalSupply - math.allocatedTotal);
  });

  it('treats an undersubscribed offering as not oversubscribed', async () => {
    const sim = await completedOffering({ alice: 1_000n, bob: 2_000n });
    const math = recomputeAllocationMath(sim.getLedger());

    expect(math.isOversubscribed).toBe(false);
    expect(math.allocatedTotal).toEqual(3_000n);
  });
});

describe('verification :: public invariants', () => {
  it('passes every invariant for an honestly completed offering', async () => {
    const sim = await completedOffering(DEMANDS);
    const report = buildVerificationReport(sim.getLedger());

    expect(report.allPassed).toBe(true);
    for (const check of report.checks) {
      expect(check.status, `${check.id} should pass`).toEqual('pass');
    }
  });

  it('passes for an offering that closed with no participants at all', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    sim.switchTo('issuer');
    await sim.closeSubscriptionAsIssuer();
    await sim.finalizeAllocation();

    const report = buildVerificationReport(sim.getLedger());
    expect(report.allPassed).toBe(true);
    expect(report.math.participantCount).toEqual(0n);
  });

  it('passes mid-flight, before anyone has claimed', async () => {
    const sim = await EquiVaultSimulator.create(AURORA, START);
    await sim.subscribeAs('alice', 40_000n);
    await sim.subscribeAs('bob', 25_000n);

    const report = buildVerificationReport(sim.getLedger());
    expect(report.allPassed).toBe(true);
    expect(report.math.claimCount).toEqual(0n);
  });

  it('checks each invariant against real numbers, not a hardcoded verdict', async () => {
    const sim = await completedOffering(DEMANDS);
    const checks = checkPublicInvariants(sim.getLedger());

    const ids = checks.map((c) => c.id);
    expect(ids).toContain('no-over-allocation');
    expect(ids).toContain('receipts-sum');
    expect(ids).toContain('one-request-per-participant');
    expect(ids).toContain('one-claim-per-participant');

    // Every check must cite concrete evidence - no empty badges.
    for (const check of checks) {
      expect(check.evidence.length).toBeGreaterThan(0);
      expect(check.explanation.length).toBeGreaterThan(0);
    }
  });

  it('is computable by someone who knows no participant request', async () => {
    const sim = await completedOffering(DEMANDS);
    // Only public state is passed in; the verifier has no private state at all.
    const report = buildVerificationReport(sim.getLedger());
    expect(report.allPassed).toBe(true);
    // And the individual requests are genuinely absent from what was used.
    const serialized = JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? `${v}` : v));
    expect(serialized).not.toContain('120000');
  });
});

describe('verification :: circuit binding', () => {
  it('passes when the deployed circuits match the local build', () => {
    const expected = { submitRequest: 'aaaa', claimAllocation: 'bbbb' };
    const deployed = [
      { circuit: 'submitRequest', verifierKeyHash: 'aaaa' },
      { circuit: 'claimAllocation', verifierKeyHash: 'bbbb' },
    ];
    const result = verifyCircuitBinding(deployed, expected);

    expect(result.status).toEqual('pass');
    expect(result.matched).toHaveLength(2);
  });

  it('fails when a deployed circuit was compiled from different source', () => {
    const expected = { submitRequest: 'aaaa' };
    const deployed = [{ circuit: 'submitRequest', verifierKeyHash: 'tampered' }];
    const result = verifyCircuitBinding(deployed, expected);

    expect(result.status).toEqual('fail');
    expect(result.mismatched).toEqual(['submitRequest']);
  });

  it('fails when the deployment is missing an expected circuit', () => {
    const result = verifyCircuitBinding([], { submitRequest: 'aaaa' });
    expect(result.status).toEqual('fail');
    expect(result.missing).toEqual(['submitRequest']);
  });

  it('fails when the deployment exposes an unexpected extra circuit', () => {
    const result = verifyCircuitBinding(
      [
        { circuit: 'submitRequest', verifierKeyHash: 'aaaa' },
        { circuit: 'backdoor', verifierKeyHash: 'cccc' },
      ],
      { submitRequest: 'aaaa' },
    );
    expect(result.status).toEqual('fail');
    expect(result.unexpected).toEqual(['backdoor']);
  });

  it('reports not-applicable rather than passing when nothing is expected', () => {
    const result = verifyCircuitBinding([], {});
    expect(result.status).toEqual('not-applicable');
  });

  it('hashes verifier keys deterministically', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const a = await sha256Hex(bytes);
    const b = await sha256Hex(new Uint8Array([1, 2, 3, 4]));
    expect(a).toEqual(b);
    expect(a).toHaveLength(64);
    expect(await sha256Hex(new Uint8Array([1, 2, 3, 5]))).not.toEqual(a);
  });
});
