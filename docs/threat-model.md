# EquiVault threat model

This document is deliberately unflattering. A privacy product that oversells itself is worse than
one that is honest about its edges, because people make decisions based on the claim.

Everything below was derived by walking the actual surfaces: ledger state, transaction metadata,
frontend state, browser storage, network calls, error messages and timing.

---

## 1. What EquiVault protects

| Property | Mechanism | Strength |
| --- | --- | --- |
| Your requested quantity is not published | It is a witness; only `persistentCommit(amount, nonce)` reaches the ledger | Strong — commitment is hiding |
| Nobody can brute-force your amount from the commitment | The 32-byte opening is required | Strong — tested against 64 guesses with the correct amount |
| Your identity is not published | You appear only as `persistentHash([tag, offeringId, domain, secretKey])` | Strong — one-way |
| You cannot be linked across offerings | The offering id is bound into every nullifier | Strong |
| Your submission cannot be linked to your claim | Different domain separators, plus a Merkle path witness so the claimed leaf is never revealed | Strong |
| The issuer cannot read participant requests | There is no circuit that discloses them; the issuer holds no special key material | Strong — structural |
| The allocation cannot be rigged | The quotient is constrained by Euclidean bounds admitting exactly one integer | Strong |
| The offering cannot over-allocate | `allocatedTotal + allocation ≤ totalSupply` asserted in-circuit | Strong |
| You cannot subscribe or claim twice | Nullifier sets | Strong |

## 2. What EquiVault does NOT protect

### 2.1 Aggregate demand deltas — the significant one

`totalDemand` is a running public total updated by every subscription. An observer watching the
ledger across two consecutive subscription transactions learns the difference, which **is** one
participant's exact requested quantity.

- **What leaks:** a multiset of requested quantities, in submission order.
- **What does not leak:** who submitted any of them. Midnight transactions do not publish a sender,
  and the participant appears only as a one-way nullifier.
- **Residual risk:** an observer who can correlate a transaction with a person by other means —
  network-level observation, timing, or a participant announcing they just subscribed — recovers
  that person's amount.
- **Why it is built this way:** the pro-rata rule needs `totalDemand`, and no participant can add to
  a total they cannot read. Committing to a blinded running total would require each participant to
  know the previous total, which defeats the blinding.
- **Planned mitigation (Wave 3):** a two-phase tally where subscriptions publish commitments only,
  and the aggregate is revealed once, in a single transaction, via a summation proof.

This limitation is surfaced *in the product*, on the verification screen, not just in this file.

### 2.2 Participation is observable

The ledger publishes `participantCount` and one nullifier per subscriber. That someone participated
at position *n* is public; who they are is not. If an offering has exactly one participant,
"someone participated" and "that specific person participated" converge — small anonymity sets
provide little anonymity, which is a property of the maths, not of this implementation.

### 2.3 Timing

Transactions are timestamped by the chain. A participant who subscribes at an unusual moment, or
who is the only one to transact in a window, narrows their own anonymity set. EquiVault does not
add cover traffic or randomized delays.

### 2.4 Claimed allocations are public

By design. The participant discloses their allocation in order to receive it — that is the
selective-disclosure story, not a leak. But note the consequence: since
`allocation = floor(request × effectiveSupply ÷ demand)` and both scalars are public, a published
allocation bounds the underlying request to a narrow interval. **Claiming reveals your request to
within rounding.**

A participant who does not want that can simply not claim; and the amounts themselves were already
in the public delta multiset (§2.1). What claiming adds is the *link* between one amount and one
claim tag — still not to an identity.

### 2.5 The device is the trust boundary

Private state lives in the browser. Anything with script access to the origin can read it. In
particular, an XSS vulnerability would defeat the at-rest encryption entirely, because the
generated key sits in `localStorage` next to the data it protects. A user-supplied passphrase
(`setUserPassphrase`) is strictly stronger, since that key never touches storage.

### 2.6 Availability, not confidentiality

- Only the issuer can `finalizeAllocation`. An issuer who disappears after closing strands every
  participant's claim. Mitigated partially: *closing* is permissionless after the deadline, so an
  offering cannot be held open forever. Making finalization permissionless once closed is a
  reasonable Wave 2 change, since the rule is deterministic and there is nothing to manipulate.
- Losing browser state forfeits a claim. No recovery exists by design; there is no custodian.

### 2.7 Out of scope

- Network-level anonymity. Use of Tor or a VPN is the user's decision; EquiVault does not provide it.
- Wallet and proof-server security. Both are trusted components outside this codebase.
- Sybil resistance. One secret key is one participant. Nothing stops a person generating many keys.
  Real deployments would gate participation with a private eligibility credential — see
  [`wave-3.md`](wave-3.md).
- Front-running. The allocation rule is order-independent, so there is nothing to gain; but nothing
  prevents an observer reordering their own submission.

## 3. Leak surfaces checked

| Surface | Finding |
| --- | --- |
| Ledger state | Only commitments, nullifiers, aggregates and claimed allocations. Asserted by tests. |
| Transaction metadata | No sender published. Amounts are not transaction arguments. |
| Frontend state | Requested quantity is held in React state and private state only; never placed in a URL. |
| URLs / query params | Only offering addresses appear in routes. No quantities, no identities. |
| `localStorage` | Only the generated at-rest encryption key. No private state. |
| IndexedDB | Private state, encrypted. |
| Console / logs | The logger is a structural interface and is not wired to a sink by default. `submitRequest` logs `{ sealed: true }`, never the amount. |
| Error messages | Mapped through `toFriendlyFailure`. Tested to never echo a raw assertion or a numeric value from the underlying error. |
| Analytics | None. There is no analytics or telemetry in this project. |
| API calls | Only to the wallet-configured indexer and the local proof server. |

## 4. What a reviewer should check themselves

1. `grep -n 'disclose' contract/src/equivault.compact` — every crossing of the privacy boundary.
2. `contract/src/test/equivault.test.ts`, the `privacy invariants` block — the leak assertions.
3. `api/src/verification.ts` — note that every check cites recomputed evidence, and that circuit
   binding reports `not-applicable` rather than passing when it cannot actually be evaluated.
4. Compile the contract yourself and compare `ui/src/generated/circuit-manifest.json`.
