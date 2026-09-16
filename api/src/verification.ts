/**
 * Public verification.
 *
 * This module answers a specific question: *given only public information, can
 * a stranger convince themselves that this allocation was carried out honestly?*
 *
 * Be precise about what is and is not being checked here:
 *
 *  - Every state transition on the ledger was already accompanied by a
 *    zero-knowledge proof that the Midnight network verified before accepting
 *    the transaction. That is the primary guarantee, and it is enforced by
 *    consensus, not by this file. Nothing here re-proves it, and nothing here
 *    can override it.
 *  - What this file adds is the checks a reader can perform for themselves:
 *    that the published aggregates are internally consistent, that the rule was
 *    applied as published, and that the contract running at a given address is
 *    compiled from the circuits in this repository.
 *
 * There is deliberately no "ZK verified" badge that is not backed by one of
 * these checks.
 *
 * @module
 */

import { allocationFor, oversubscriptionBps } from '@equivault/contract';
import type { ledger as readLedger } from '@equivault/contract';

type Ledger = ReturnType<typeof readLedger>;

export type CheckStatus = 'pass' | 'fail' | 'not-applicable';

export type VerificationCheck = {
  readonly id: string;
  readonly label: string;
  /** What this check actually proves, in plain language. */
  readonly explanation: string;
  readonly status: CheckStatus;
  /** The concrete numbers behind the verdict. */
  readonly evidence: string;
};

export type AllocationMath = {
  readonly totalSupply: bigint;
  readonly totalDemand: bigint;
  /** Oversubscription scaled by 10_000; 25_000 means 2.5x. */
  readonly oversubscriptionBps: bigint;
  readonly isOversubscribed: boolean;
  readonly allocatedTotal: bigint;
  /** Units left over from flooring each participant's share. */
  readonly unallocatedRemainder: bigint;
  readonly participantCount: bigint;
  readonly claimCount: bigint;
  /** Largest allocation any single participant could legitimately hold. */
  readonly maximumPossibleAllocation: bigint;
};

export const recomputeAllocationMath = (ledger: Ledger): AllocationMath => {
  const { totalSupply, totalDemand, allocatedTotal, participantCount, claimCount, maxRequest } = ledger;

  return {
    totalSupply,
    totalDemand,
    oversubscriptionBps: oversubscriptionBps(totalSupply, totalDemand),
    isOversubscribed: totalDemand > totalSupply,
    allocatedTotal,
    unallocatedRemainder: totalSupply - allocatedTotal,
    participantCount,
    claimCount,
    maximumPossibleAllocation:
      totalDemand > 0n ? allocationFor(maxRequest, totalSupply, totalDemand) : 0n,
  };
};

/**
 * The invariants a stranger can check against public state alone.
 *
 * Each one is a real arithmetic or set-cardinality check over data the ledger
 * publishes. None of them requires knowing a single participant's request.
 */
export const checkPublicInvariants = (ledger: Ledger): VerificationCheck[] => {
  const math = recomputeAllocationMath(ledger);
  const receipts = [...ledger.allocationReceipts];
  const receiptSum = receipts.reduce((sum, [, value]) => sum + value, 0n);
  const submissionCount = ledger.submissionNullifiers.size();
  const claimNullifierCount = ledger.claimNullifiers.size();
  const leafCount = ledger.requestTree.firstFree();

  const check = (
    id: string,
    label: string,
    explanation: string,
    ok: boolean,
    evidence: string,
  ): VerificationCheck => ({
    id,
    label,
    explanation,
    status: ok ? 'pass' : 'fail',
    evidence,
  });

  const checks: VerificationCheck[] = [
    check(
      'no-over-allocation',
      'The offering never allocated more than it held',
      'The sum of every allocation handed out is at most the published supply. This is the property that makes the result safe to act on.',
      math.allocatedTotal <= math.totalSupply,
      `${math.allocatedTotal} of ${math.totalSupply} ${ledger.resourceUnit} allocated`,
    ),
    check(
      'receipts-sum',
      'Published receipts add up to the published total',
      'Every individual allocation receipt on the ledger sums exactly to the running allocated total, so no receipt was altered or omitted.',
      receiptSum === math.allocatedTotal,
      `${receipts.length} receipts summing to ${receiptSum}; ledger reports ${math.allocatedTotal}`,
    ),
    check(
      'one-request-per-participant',
      'Each participant submitted exactly once',
      'The number of one-way submission nullifiers equals the participant count and the number of leaves in the request tree, so nobody subscribed twice and no request was inserted without a nullifier.',
      submissionCount === math.participantCount && leafCount === math.participantCount,
      `${submissionCount} nullifiers, ${leafCount} committed requests, ${math.participantCount} participants`,
    ),
    check(
      'one-claim-per-participant',
      'Each allocation was claimed at most once',
      'The number of claim nullifiers equals the number of receipts and never exceeds the number of participants, so no allocation was claimed twice.',
      claimNullifierCount === BigInt(receipts.length) && math.claimCount <= math.participantCount,
      `${math.claimCount} claims from ${math.participantCount} participants`,
    ),
    check(
      'allocations-within-rule',
      'No allocation exceeds what the rule permits',
      'Under the published pro-rata rule, the largest share anyone could receive is bounded by the offering maximum. Every receipt respects that bound.',
      receipts.every(([, value]) => value <= math.maximumPossibleAllocation),
      `largest permitted share is ${math.maximumPossibleAllocation}; largest receipt is ${
        receipts.reduce((max, [, v]) => (v > max ? v : max), 0n)
      }`,
    ),
    check(
      'demand-consistency',
      'Aggregate demand is consistent with the participant count',
      'Total demand is zero only when there are no participants, and is otherwise at least the published minimum for every participant.',
      math.participantCount === 0n
        ? math.totalDemand === 0n
        : math.totalDemand >= ledger.minRequest * math.participantCount,
      `${math.totalDemand} total demand across ${math.participantCount} participants`,
    ),
  ];

  return checks;
};

// --- circuit binding -------------------------------------------------------

export type CircuitFingerprint = {
  readonly circuit: string;
  /** SHA-256 of the verifier key, hex encoded. */
  readonly verifierKeyHash: string;
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const source =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes.buffer
      : bytes.slice().buffer;
  const digest = await crypto.subtle.digest('SHA-256', source as ArrayBuffer);
  return toHex(new Uint8Array(digest));
};

/**
 * Fingerprints the circuits actually deployed at a contract address, by hashing
 * the verifier key the network holds for each entry point.
 */
export const fingerprintDeployedCircuits = async (contractState: {
  operations(): Array<string | Uint8Array>;
  operation(op: string | Uint8Array): { verifierKey: Uint8Array } | undefined;
}): Promise<CircuitFingerprint[]> => {
  const fingerprints = await Promise.all(
    contractState.operations().map(async (op) => {
      const name = typeof op === 'string' ? op : toHex(op);
      const operation = contractState.operation(op);
      if (operation === undefined) {
        return undefined;
      }
      return { circuit: name, verifierKeyHash: await sha256Hex(operation.verifierKey) };
    }),
  );

  return fingerprints
    .filter((f): f is CircuitFingerprint => f !== undefined)
    .sort((a, b) => a.circuit.localeCompare(b.circuit));
};

export type CircuitBindingResult = {
  readonly status: CheckStatus;
  readonly matched: string[];
  readonly mismatched: string[];
  readonly missing: string[];
  readonly unexpected: string[];
};

/**
 * Compares the deployed circuits against the ones compiled from this
 * repository. A `pass` means the offering at that address is running exactly
 * the source in `contract/src/equivault.compact` - so reading that file tells
 * you precisely what the offering can and cannot do.
 *
 * `expected` comes from `npm run circuit-manifest`, which hashes the local
 * `.verifier` artifacts produced by the Compact compiler.
 */
export const verifyCircuitBinding = (
  deployed: readonly CircuitFingerprint[],
  expected: Readonly<Record<string, string>>,
): CircuitBindingResult => {
  const matched: string[] = [];
  const mismatched: string[] = [];
  const unexpected: string[] = [];

  for (const { circuit, verifierKeyHash } of deployed) {
    const want = expected[circuit];
    if (want === undefined) {
      unexpected.push(circuit);
    } else if (want === verifierKeyHash) {
      matched.push(circuit);
    } else {
      mismatched.push(circuit);
    }
  }

  const deployedNames = new Set(deployed.map((d) => d.circuit));
  const missing = Object.keys(expected).filter((name) => !deployedNames.has(name));

  const expectedCount = Object.keys(expected).length;
  const status: CheckStatus =
    expectedCount === 0
      ? 'not-applicable'
      : mismatched.length === 0 && missing.length === 0 && unexpected.length === 0
        ? 'pass'
        : 'fail';

  return { status, matched, mismatched, missing, unexpected };
};

export type VerificationReport = {
  readonly math: AllocationMath;
  readonly checks: readonly VerificationCheck[];
  readonly allPassed: boolean;
};

export const buildVerificationReport = (ledger: Ledger): VerificationReport => {
  const checks = checkPublicInvariants(ledger);
  return {
    math: recomputeAllocationMath(ledger),
    checks,
    allPassed: checks.every((c) => c.status !== 'fail'),
  };
};
