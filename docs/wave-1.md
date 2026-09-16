# Wave 1 — The privacy proof

**Goal:** prove the core idea works. Technical correctness over feature count.

Wave 1 had to answer exactly one question:

> Can EquiVault prove that a private allocation process works, without exposing every
> participant's request?

Yes. Here is what that took.

---

## What problem was solved

An oversubscribed offering has to cut everyone back, and to prove the cut was fair, allocation
systems publish who asked for what. EquiVault removes the publishing step without removing the
proof.

100,000 shares, 250,000 of demand, 2.5x oversubscribed. Every participant's request stays on their
own device. The allocation is still recomputable by a stranger.

## What privacy capability was demonstrated

1. **A request that is committed but never published.** The ledger holds
   `persistentCommit(amount, nonce)` — hiding, so the amount is unrecoverable; binding, so the
   participant cannot change their story later.
2. **An identity reduced to a one-way tag.** Participants appear only as domain-separated,
   offering-scoped nullifiers. The same key yields unlinkable tags across offerings and across
   actions.
3. **A claim that cannot be linked to its submission.** The Merkle path is a private witness, so
   only the already-public root is disclosed. The participant proves "one of these requests is
   mine" without saying which.
4. **An allocation that is constrained, not trusted.** This is the part that matters most.

## The hardest technical problem: division

Compact has no `/` operator. The pro-rata rule needs one.

The approach that works: supply the quotient as a **private witness** and constrain it in-circuit
with Euclidean bounds.

```compact
const effectiveSupply = totalDemand < totalSupply ? totalDemand : totalSupply;
const quotient  = allocationQuotient();          // private witness
const numerator = request.amount * effectiveSupply;
const lower     = quotient * totalDemand;
const upper     = lower + totalDemand;

assert(disclose(lower <= numerator), "allocation quotient too small");
assert(disclose(numerator < upper),  "allocation quotient too large");
```

Exactly one integer satisfies both. The circuit therefore *defines* the quotient rather than
accepting it — a wrong witness does not over-allocate, it fails to prove.

`effectiveSupply = min(supply, demand)` also makes one formula cover both cases: oversubscribed
gives a proportional cut, undersubscribed collapses to a full fill.

## What was implemented

| Area | Delivered |
| --- | --- |
| Compact contract | 5 transaction entry points, 2 pure circuits, full lifecycle |
| Private state | Witness layer with secret key, sealed request, quotient and Merkle path |
| Allocation | Deterministic, order-independent, never over-allocating, verified in-circuit |
| Midnight integration | Real providers: wallet connector, proof server, indexer, encrypted private state |
| Wallet | Lace discovery, connection, balancing and submission — no mocks |
| Verification | Invariants recomputed from public state; circuit binding against compiled verifier keys |
| Frontend | Landing, offerings, participation, results, verification, issuer, portfolio |
| Demo Mode | Real compiled circuits executing in-browser, no wallet required |
| Tests | 105, including a dedicated privacy suite |

## Engineering decisions worth recording

**Pinned to the stable toolchain track.** The latest Compact compiler (0.34.0) emits code requiring
`compact-runtime` 0.19.0, which only pairs with a `5.0.0-beta` SDK. This project pins compiler
**0.31.1** to match `compact-runtime` 0.16.0 and Midnight.js **4.1.1** — the line the official
examples ship and testnet supports. Correctness over novelty.

**`identityTag` was made pure.** As an impure exported circuit it became a transaction entry point,
which would have let anyone submit a transaction passing a secret key as a public argument. Taking
the offering id as a parameter instead of reading the ledger makes it pure, and pure circuits are
not entry points. Transaction surface went from 6 to 5.

**One interface, two backends.** `OfferingSession` is implemented by both the live and demo
backends, so every screen exercises the same code path. Each backend declares `capabilities`
(`executesRealCircuits`, `generatesZkProofs`, `settlesOnChain`) and the UI renders claims from those
flags — which is why Demo Mode structurally cannot display a proof badge it did not earn.

**The verification screen refuses to overclaim.** Circuit binding reports `not-applicable` in Demo
Mode rather than showing a green tick, because there is no deployed contract to compare against.

## Honest limitation, surfaced in the product

Aggregate demand is a running public total, so the delta between two consecutive subscription
transactions equals one participant's request. It is unlinkable to an identity, but observable.
This is stated in the contract header, in [`threat-model.md`](threat-model.md), and on the
verification screen itself. Addressing it is Wave 3 work.

## Definition of done — checked

- [x] The contract compiles with the current compiler
- [x] Contract tests pass (45)
- [x] The frontend builds
- [x] Wallet connection implemented against the real 4.x connector API
- [x] A participant can submit a private request
- [x] Allocation and claiming work
- [x] The result can be verified from public state alone
- [x] Private values are not exposed — asserted by tests, not assumed
- [x] The demo runs from a clean clone with no wallet
- [x] Failure states are handled and never show raw errors
