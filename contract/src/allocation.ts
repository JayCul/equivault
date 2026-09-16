/**
 * EquiVault allocation rule - the single source of truth.
 *
 * This module is deliberately dependency-free and pure so that:
 *   1. the witness layer can compute the quotient the circuit will verify,
 *   2. the UI can preview an allocation without touching the chain,
 *   3. the public verifier can independently recompute a published result,
 *   4. the tests can property-check it against the compiled circuit.
 *
 * The circuit in `equivault.compact` does NOT trust this code. It re-derives
 * the same value inside the zero-knowledge proof via Euclidean bounds. If this
 * module and the circuit ever disagree, proof generation fails loudly rather
 * than silently allocating the wrong number of units.
 *
 * @module
 */

/** Upper bound on any quantity (2^40). Mirrors the cap asserted in the circuit. */
export const MAX_QUANTITY = 1_099_511_627_776n;

/**
 * The deterministic, published allocation rule.
 *
 * ```text
 *   effectiveSupply = min(totalSupply, totalDemand)
 *   allocation_i    = floor(request_i * effectiveSupply / totalDemand)
 * ```
 *
 * Properties that make this rule safe to publish and cheap to verify:
 *
 * - **Oversubscribed** (`demand > supply`): every participant receives the same
 *   fraction `supply / demand` of what they asked for. Nobody is preferred.
 * - **Undersubscribed** (`demand <= supply`): `effectiveSupply === totalDemand`,
 *   so the formula collapses to `allocation_i === request_i` - a full fill.
 * - **Never over-allocates**: flooring each share means the sum of allocations
 *   is always `<= totalSupply`. Any rounding remainder stays unallocated.
 * - **Order independent**: the result does not depend on submission order, so
 *   there is nothing to gain by transacting early or late.
 *
 * @param request      The participant's private requested quantity.
 * @param totalSupply  Units offered (public).
 * @param totalDemand  Aggregate demand across all participants (public).
 * @returns The allocated quantity.
 */
export const allocationFor = (request: bigint, totalSupply: bigint, totalDemand: bigint): bigint => {
  if (totalDemand <= 0n) {
    throw new Error('EquiVault: cannot allocate against zero demand');
  }
  if (request < 0n) {
    throw new Error('EquiVault: request must be non-negative');
  }
  const effectiveSupply = totalDemand < totalSupply ? totalDemand : totalSupply;
  return (request * effectiveSupply) / totalDemand;
};

/**
 * Oversubscription ratio, scaled by 10_000 to stay in integer arithmetic.
 * A return value of 25_000 means the offering was 2.5x oversubscribed.
 */
export const oversubscriptionBps = (totalSupply: bigint, totalDemand: bigint): bigint => {
  if (totalSupply <= 0n) {
    return 0n;
  }
  return (totalDemand * 10_000n) / totalSupply;
};

/**
 * Checks the Euclidean bounds the circuit asserts. Used by the tests and by the
 * public verifier to confirm a published allocation is the only integer the
 * circuit would have accepted.
 */
export const satisfiesAllocationBounds = (
  quotient: bigint,
  request: bigint,
  totalSupply: bigint,
  totalDemand: bigint,
): boolean => {
  if (totalDemand <= 0n) {
    return false;
  }
  const effectiveSupply = totalDemand < totalSupply ? totalDemand : totalSupply;
  const numerator = request * effectiveSupply;
  const lower = quotient * totalDemand;
  const upper = lower + totalDemand;
  return lower <= numerator && numerator < upper;
};
