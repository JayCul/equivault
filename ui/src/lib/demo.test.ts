/**
 * @vitest-environment node
 *
 * These tests must run in the node environment, not jsdom: wasm-bindgen
 * rejects jsdom's `Uint8Array` because it comes from a different JS realm
 * ("invalid type: JsValue(Uint8Array), expected byte array").
 */
/**
 * Demo Mode tests.
 *
 * These run the real compiled circuits, so they double as an integration test
 * of the contract through the same code path the browser uses.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Phase } from '@equivault/contract';
import { buildVerificationReport } from '@equivault/api';
import { DEMO_SEEDS, DemoOfferingSession, DemoWorld } from './demo';

beforeAll(() => {
  setNetworkId('undeployed');
});

const seedBySlug = (slug: string) => {
  const seed = DEMO_SEEDS.find((candidate) => candidate.slug === slug);
  if (!seed) throw new Error(`missing seed ${slug}`);
  return seed;
};

describe('demo mode :: seeding', () => {
  it('seeds every offering without violating a contract assertion', async () => {
    const world = await DemoWorld.reset();
    expect(world.sessions).toHaveLength(DEMO_SEEDS.length);
  });

  it('builds the 2.5x oversubscribed worked example exactly', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('aurora-energy-systems'));
    const state = session.getState();

    expect(state.totalSupply).toEqual(100_000n);
    expect(state.totalDemand).toEqual(250_000n);
    expect(state.oversubscriptionBps).toEqual(25_000n);
    expect(state.participantCount).toEqual(5n);
    expect(state.phase).toEqual(Phase.OPEN);
  });

  it('seeds an already-finalized offering whose deadline is in the past', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('meridian-biotech'));
    const state = session.getState();

    expect(state.phase).toEqual(Phase.FINALIZED);
    expect(state.participantCount).toEqual(4n);
  });

  it('supports a non-financial offering with the same contract', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('northwind-scholarship'));
    const state = session.getState();

    expect(state.unit).toEqual('scholarships');
    expect(state.unitPriceCents).toEqual(0n);
    expect(state.totalSupply).toEqual(100n);
  });
});

describe('demo mode :: participant journey', () => {
  it('runs submit, close, finalize and claim end to end', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('aurora-energy-systems'));

    await session.submitRequest(8_000n);
    let state = session.getState();
    expect(state.viewer.hasSubmitted).toBe(true);
    expect(state.participantCount).toEqual(6n);
    expect(state.totalDemand).toEqual(258_000n);

    await session.closeSubscription();
    expect(session.getState().phase).toEqual(Phase.CLOSED);

    await session.finalizeAllocation();
    expect(session.getState().phase).toEqual(Phase.FINALIZED);

    const allocation = await session.claimAllocation();
    // floor(8,000 x 100,000 / 258,000)
    expect(allocation).toEqual(3_100n);

    state = session.getState();
    expect(state.viewer.hasClaimed).toBe(true);
    expect(state.viewer.myAllocation).toEqual(3_100n);
    expect(state.allocatedTotal).toEqual(3_100n);
  });

  it('notifies subscribers when state changes', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('aurora-energy-systems'));
    const seen: bigint[] = [];
    const unsubscribe = session.subscribe((state) => seen.push(state.totalDemand));

    await session.submitRequest(5_000n);
    unsubscribe();

    expect(seen[0]).toEqual(250_000n);
    expect(seen.at(-1)).toEqual(255_000n);
  });

  it('rejects a second request from the same viewer', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('aurora-energy-systems'));
    await session.submitRequest(5_000n);
    await expect(session.submitRequest(1_000n)).rejects.toThrow(/already subscribed/);
  });

  it('rejects a request outside the published range', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('aurora-energy-systems'));
    await expect(session.submitRequest(1n)).rejects.toThrow(/below offering minimum/);
  });

  it('never exposes a seeded participant request through public state', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('aurora-energy-systems'));
    const ledger = session.getLedger();

    // 120,000 is one seeded participant's private request.
    const serialized = JSON.stringify(
      {
        totalDemand: ledger.totalDemand,
        participantCount: ledger.participantCount,
        allocatedTotal: ledger.allocatedTotal,
        receipts: [...ledger.allocationReceipts].map(([, v]) => v),
      },
      (_key, value) => (typeof value === 'bigint' ? `${value}` : value),
    );

    expect(serialized).not.toContain('120000');
    expect(serialized).not.toContain('40000');
  });
});

describe('demo mode :: verification', () => {
  it('passes every public invariant after a full settlement', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('aurora-energy-systems'));
    await session.submitRequest(8_000n);
    await session.closeSubscription();
    await session.finalizeAllocation();
    await session.claimAllocation();
    await session.settleSeededParticipants();

    const report = buildVerificationReport(session.getLedger());
    expect(report.allPassed).toBe(true);
    expect(report.math.allocatedTotal).toBeLessThanOrEqual(report.math.totalSupply);
    expect(report.math.claimCount).toEqual(6n);
  });

  it('reports demo capabilities honestly', async () => {
    const session = await DemoOfferingSession.create(seedBySlug('aurora-energy-systems'));
    expect(session.capabilities.executesRealCircuits).toBe(true);
    expect(session.capabilities.generatesZkProofs).toBe(false);
    expect(session.capabilities.settlesOnChain).toBe(false);
  });
});
