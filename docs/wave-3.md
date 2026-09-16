# Wave 3 — Make the concept hard to ignore

**Goal:** stop being an IPO demo and become a private allocation primitive.

---

## The reframe

EquiVault started with IPO allocation because that is where the need is most obvious: an
oversubscribed offering visibly has to cut people back, and the traditional way to prove the cut was
fair is to publish the book.

But nothing in the contract is about equity. Read
[`equivault.compact`](../contract/src/equivault.compact) and the word "share" does not appear. It
allocates `totalSupply` units of `resourceUnit` among participants who submitted private requests,
under a published, deterministic rule.

> **EquiVault started with IPO allocation. The real product is private allocation.**

The generalization is already visible in Wave 1: the seeded catalogue includes the **Northwind
Scholarship Fund** — 100 scholarships, applicants privately declaring how much support they need,
no price, no money. Same contract. Same circuits. Same proof. The only differences are
`unit: 'scholarships'` and `unitPriceCents: 0`.

That is the argument, demonstrated rather than asserted.

## The primitive

Every scarce-resource allocation shares a shape:

```
An ISSUER publishes   a quantity, a rule, eligibility conditions,
                      a submission window and a disclosure policy.
PARTICIPANTS submit   private requests, proven valid without being revealed.
The RULE is applied   deterministically to public aggregates.
ANYONE can verify     the result, without access to any private input.
```

| Domain | Resource | Request | Why privacy matters |
| --- | --- | --- | --- |
| IPO allocation | Shares | Quantity wanted | Reveals capacity and strategy |
| Private procurement | A contract | Bid price | Reveals cost structure to competitors |
| Blind marketplace offers | An asset | Offer price | Reveals reservation price |
| Event tickets | Seats | Quantity | Reveals resale intent; enables targeting |
| Grant allocation | Funding | Amount needed | Reveals financial distress |
| Scholarships | Awards | Support needed | Reveals family circumstances |
| Competitive applications | Places | Preference strength | Reveals ranking strategy |
| Compute quotas | GPU hours | Demand | Reveals roadmap and scale |

The pattern repeats because the tension repeats: **everyone needs to trust the outcome, nobody
should have to publish their input.**

## What Wave 3 builds

### 1. A configurable allocation primitive

Generalize the contract so an issuer declares a policy rather than inheriting a hardcoded one:

- **Resource quantity** — already generic.
- **Allocation rule** — `AllocationRule` is already an enum with one member. Add `CAPPED_PRO_RATA`
  (max-min fair, with a published per-participant cap), `LOTTERY` (verifiable randomness over
  eligible participants), and `PRIORITY_BANDED` (tiers allocated in order, pro rata within a tier).
  The verified-division technique carries over unchanged.
- **Eligibility conditions** — the significant addition; see below.
- **Submission window** — already parameterized.
- **Disclosure policy** — let the issuer choose what the result publishes: full allocations, bucketed
  ranges, or a bare proof of correct settlement.

### 2. Private eligibility — the missing half

Today anyone holding a key may subscribe. Real allocations are gated: accredited investors,
enrolled students, registered suppliers, residents of a region.

The privacy-preserving version is a **membership proof against an eligibility Merkle root**
published by the issuer. A participant proves their credential is in the eligible set without
revealing which credential it is — exactly the technique already used for the request tree, applied
to a different tree. The circuit changes are small; the conceptual gain is large, because gating is
what makes an allocation system deployable.

This also supplies the Sybil resistance the threat model currently lists as out of scope.

### 3. Fixing the demand-delta leak

The one real privacy limitation is that `totalDemand` is a running public total, so consecutive
transactions expose individual amounts (unlinked to identity, but visible).

The fix is a **two-phase tally**:

1. **Subscription** publishes commitments and nullifiers only. No aggregate moves. Nothing leaks.
2. **Tally** reveals the aggregate exactly once, in a single transaction carrying a proof that the
   revealed total is the sum of the openings of all committed requests.

One number becomes public, once, with no per-participant deltas to difference. This is the single
highest-value remaining privacy improvement, and it is why the limitation is documented rather than
quietly designed around.

### 4. Selective disclosure as a first-class feature

The contract already does one form of it: a participant discloses their allocation to receive it,
never their request. Wave 3 makes the participant the one who chooses:

- *"I was allocated 3,200 shares"* — without revealing what was requested.
- *"I received at least 1,000"* — a range proof, without the exact figure.
- *"I was eligible to participate"* — without any eligibility detail.
- *"I participated and accept the outcome"* — without the amount at all.

Each is a small circuit over state the participant already holds. Only patterns genuinely
expressible in Compact will ship; nothing will be simulated.

### 5. Allocation-as-infrastructure

Extract the primitive into something other builders use:

- `@equivault/allocation-kit` — the Compact contract plus a typed TypeScript client.
- A policy schema so an issuer declares an allocation in configuration, not Compact.
- Embeddable participation and verification widgets.
- A public verifier that any third party can point at an offering address.

### 6. Post-allocation settlement: dividends and share recalculation

Everything so far ends at `claimAllocation`: a participant receives a quantity, and the offering is
done. Real equity does not stop there. Two settlement primitives extend the same architecture
without changing its privacy model.

**Dividends.** `allocationReceipts` is already an anonymous cap table: a map from an unlinkable
claim nullifier to a quantity, with no identity attached. A `claimDividend` circuit reuses that
directly. The issuer funds a dividend pool and publishes a rate; a holder proves they own a claim
nullifier already present in `allocationReceipts`, and receives `rate * allocation` without
re-disclosing which allocation is theirs beyond what was already public at claim time. A
dividend-scoped nullifier (a fourth domain, alongside `submit`, `claim` and `issuer`) stops the same
holder collecting one round twice, exactly like every other nullifier in this contract.

**Share recalculation (splits).** A 2-for-1 split or a 1-for-2 reverse split multiplies every
outstanding allocation by a ratio. Compact still has no division operator, so a split ratio is
represented as `(numerator, denominator)` and applied with the identical verified-multiplication
technique already proven correct for the core allocation quotient: `assert(recalculated *
denominator == original * numerator)` admits exactly one integer, so a wrong witness fails to prove
rather than mis-adjusting a balance. Because `allocationReceipts` is a map rather than one running
total, recalculation can apply lazily, at claim or view time, against the stored pre-split figure,
rather than requiring a single transaction that rewrites every entry at once.

**Why this is Wave 3, not Wave 2.** Wave 2 makes the existing one-shot allocation model into a
complete product: more offerings, better dashboards, real error handling, none of it changing what
the contract is capable of. Dividends and recalculation are new capabilities layered on top of an
already-settled allocation, in the same spirit as the new `AllocationRule` variants and the
eligibility work above; they belong with the rest of "what the primitive can do next," not with
"finish what it already does."

## What would be required for production

Stated plainly, because this is a demonstration and the gap is real:

| Area | Requirement |
| --- | --- |
| Audit | Independent review of the circuits, with the verified-division constraints as the focus |
| Legal | Securities regulation applies the moment the shares stop being simulated. Real deployment is a regulated activity in most jurisdictions |
| Identity | Private eligibility credentials, and an issuer process for maintaining the eligible set |
| Scale | The request tree is depth 10 (1,024 participants). Real offerings need depth 16–20, and the cost of proving at that depth needs measuring |
| Liveness | Permissionless finalization, so an absent issuer cannot strand claims |
| Key management | Private-state export, recovery and multi-device support. Today, losing browser state forfeits a claim |
| Settlement | EquiVault allocates; it does not settle. Real use needs delivery-versus-payment against a real asset |
| Operations | Indexer and proof-server availability, monitoring, and a registry for discovery |

## The message

The demo is an IPO because an IPO makes the problem obvious in ten seconds. The product is the
mechanism underneath: **a way to allocate something scarce, fairly and checkably, without anyone
having to publish what they asked for.**

Once that exists as infrastructure, the question stops being "how do we prove this IPO was fair"
and becomes "why does any allocation still require publishing everyone's private demand?"
