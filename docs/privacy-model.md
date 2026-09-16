# EquiVault privacy model

The authoritative statement lives in the contract header
([`contract/src/equivault.compact`](../contract/src/equivault.compact)). This document explains the
reasoning; [`threat-model.md`](threat-model.md) states the limits.

---

## 1. The boundary

```
      YOUR DEVICE                    │            THE LEDGER
                                     │
  secretKey ──────────┐              │
  requestedAmount ────┤              │
  nonce (opening) ────┤              │
  merkle path ────────┘              │
        │                            │
        ▼                            │
   ┌─────────────┐                   │
   │  CIRCUIT    │ ── disclose() ──► │  commitment (32 bytes)
   │  witnesses  │                   │  nullifier  (32 bytes)
   │  + asserts  │                   │  aggregate demand
   └─────────────┘                   │  claimed allocation
                                     │
   nothing else crosses ─────────────┤
```

## 2. Private values, and why each must be

| Value | Why it must stay private |
| --- | --- |
| `secretKey` | It is the participant's identity. Disclosing it would let anyone impersonate them and link every action. |
| `requestedAmount` | The entire point. It reveals financial capacity, appetite and strategy. |
| `nonce` | The commitment opening. Publishing it makes the commitment non-hiding and reveals the amount. |
| Merkle path | Reveals *which* leaf is the participant's, linking their claim back to their submission. |

## 3. Public values, and why each is safe

| Value | Why publishing it is safe |
| --- | --- |
| Offering parameters, allocation rule | They must be public for the result to be checkable. |
| `participantCount` | A count, with no identities attached. |
| `totalDemand` | An aggregate. See the delta caveat in the threat model. |
| `requestTree` root | A Merkle root over hiding commitments. Not invertible. |
| `submissionNullifiers` | `persistentHash([tag, offeringId, "submit", sk])`. One-way, offering-scoped. |
| `claimNullifiers` | Same construction, different domain. Not linkable to the submission tag. |
| `allocationReceipts` | The allocation the participant chose to disclose, keyed by an unlinkable tag. |
| `issuerCommitment` | A hash of the issuer's key, not the key. |

## 4. Three mechanisms doing the work

### 4.1 Hiding, binding commitments

```compact
export circuit requestCommitment(amount: Uint<64>, nonce: Bytes<32>): Bytes<32> {
  return persistentCommit<Uint<64>>(amount, nonce);
}
```

**Hiding:** the same amount with two different openings yields unrelated commitments, so the
published value reveals nothing about the amount. **Binding:** the same opening with two different
amounts yields different commitments, so a participant cannot later claim they asked for something
else. Both directions are asserted in the test suite.

### 4.2 Domain-separated, offering-scoped nullifiers

```compact
export circuit identityTag(id: Bytes<32>, sk: Bytes<32>, domain: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<4, Bytes<32>>>(
    [pad(32, "equivault:v1:"), id, domain, sk]
  );
}
```

Three properties fall out of this construction:

1. **One-way** — the ledger holds a hash, so the key is not recoverable.
2. **Domain-separated** — `submit`, `claim` and `issuer` tags from one key are mutually unlinkable,
   which is what stops an observer joining a subscription to its later claim.
3. **Offering-scoped** — binding `offeringId` means the same key produces different tags in
   different offerings. Without this, a key reused across offerings would produce *identical*
   nullifiers and link a user's participation across all of them.

This circuit is **pure**, so it is not a transaction entry point and can never be called on-chain
with a secret key as a public argument.

### 4.3 Merkle membership without revealing the leaf

```compact
const commitment = requestCommitment(request.amount, request.nonce);
const path = requestPath();                       // private witness
assert(disclose(path.leaf == commitment), "...");
const root = disclose(merkleTreePathRoot<10, Bytes<32>>(path));
assert(requestTree.checkRoot(root), "...");
```

Only the **root** is disclosed — and the root is already public. The path and the leaf stay private,
so the claim proves "one of these committed requests is mine" without identifying which. Without
this, a claim would have to name its commitment, linking it to the submission transaction.

## 5. What the compiler enforces for you

Compact's disclosure analysis is transitive and pessimistic. It refused to compile earlier drafts of
this contract until each of these was acknowledged:

- a witness value written to the ledger,
- a **comparison result** derived from a witness (`request.amount >= minRequest`),
- a value derived through arithmetic and a type cast (`(totalDemand + amount) as Uint<64>`),
- an ordinary **circuit parameter** used as a ledger key,
- a **hash of a hash of a modulus of a hash** of a witness — the Merkle root case, which the
  compiler traced through three layers of derivation.

Every `disclose(...)` in the contract is therefore a deliberate, reviewable decision rather than an
accident. `grep -n 'disclose' contract/src/equivault.compact` enumerates the complete boundary.

## 6. The issuer is not privileged

Worth stating separately because it is unusual. The issuer:

- **can** create the offering, close it early, and finalize it;
- **cannot** read any participant's request, learn who participated, or influence the allocation.

There is no circuit that discloses a request to anyone, and the issuer holds no key material that a
participant does not. The creation flow says this explicitly in the privacy preview, before the
issuer commits to launching.
