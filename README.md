<div align="center">

# EquiVault

**Private IPO Access for Everyone**

This project is built on the [Midnight Network](https://midnight.network/).

[![Compact compiler](https://img.shields.io/badge/Compact%20compiler-0.31.1-F5A623.svg)](https://docs.midnight.network/relnotes/compact)
[![Compact language](https://img.shields.io/badge/Compact%20language-0.23-F5A623.svg)](https://docs.midnight.network/compact)
[![Midnight.js](https://img.shields.io/badge/Midnight.js-4.1.1-F5A623.svg)](https://docs.midnight.network/)
[![Tests](https://img.shields.io/badge/tests-105%20passing-1f7d55.svg)](#testing)

</div>

---

> **Simulated market.** EquiVault is an educational demonstration. The companies are fictional,
> the shares are simulated, no real securities change hands, no money is involved, and nothing
> here is investment advice.

---

## 1. Product overview

EquiVault is a privacy-preserving allocation system. Participants privately submit how many units
of a scarce resource they want. Midnight proves the allocation followed the published rule —
without publishing anyone's request.

The first problem it solves is an oversubscribed IPO, because that is where the need is most
obvious. But the contract underneath allocates *units of a scarce resource*, and equity is only one
instantiation of it. Scholarships, procurement tenders and ticket drops use the same circuits.

**One idea, stated plainly:**

> You should not have to reveal private information just to prove that a fair decision was made.

## 2. The problem

A company offers 100,000 shares. Ten thousand people want in. Total demand reaches 250,000 — the
offering is 2.5x oversubscribed, so somebody has to be cut back.

To prove the cut-back was fair, allocation systems traditionally publish the book: who asked for
what. That single design choice leaks far more than a number. A participant's request reveals:

- how much they are willing to invest,
- their financial capacity,
- their investment strategy,
- their level of interest.

## 3. Why privacy matters here

The usual answer is "trust the issuer". EquiVault's answer is that you should not have to trust
anyone, *and* you should not have to publish anything.

The insight is that fairness does not require publishing the inputs. It requires proving the rule
was applied to them. Those are different things, and zero-knowledge proofs separate them.

## 4. Why Midnight

Midnight is a privacy-first blockchain where contracts hold **private inputs** (witnesses) and
**public state** (the ledger) side by side, and the compiler forces you to be explicit about which
is which.

Three properties of the platform do real work in this design:

| Midnight capability | What EquiVault does with it |
| --- | --- |
| Witnesses — private inputs that never reach the ledger | The requested quantity and the commitment opening live only on the participant's device |
| `disclose()` — an explicit, compiler-enforced privacy boundary | Every value that crosses into public state is a deliberate, reviewable decision |
| ZK circuits over private state | Range checks, single-subscription enforcement and the allocation arithmetic are all proven without revealing the amount |

The `disclose()` analysis is stricter than it first appears: the compiler tracks values derived
*indirectly* from witnesses — through arithmetic, comparisons, type casts and even the boolean
result of a comparison — and refuses to compile until each disclosure is acknowledged. Circuit
parameters are treated as potentially private too. That is what makes the privacy boundary in
`contract/src/equivault.compact` a checked property rather than a claim.

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  ui/          React 19 + Vite + Tailwind                         │
│               Landing, offerings, participation, results, verify │
└───────────────┬──────────────────────────────┬───────────────────┘
                │                              │
      LiveOfferingSession            DemoOfferingSession
     (wallet, proofs, chain)      (real circuits, local ledger)
                │                              │
┌───────────────▼──────────────────────────────▼───────────────────┐
│  api/         EquiVaultAPI · providers · verification · errors   │
└───────────────┬──────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────┐
│  contract/    equivault.compact · witnesses · allocation rule    │
│               + a multi-participant simulator                    │
└───────────────┬──────────────────────────────────────────────────┘
                │
        Midnight network · proof server · Lace wallet
```

Both backends implement one `OfferingSession` interface, so every screen runs unchanged against
either. Each backend declares its own `capabilities`, and the UI renders claims from those flags —
which is why Demo Mode can never display a proof badge it did not earn.

```
equivault/
├── contract/     Compact source, witnesses, allocation rule, simulator, tests
├── api/          Midnight SDK integration, verification engine, error mapping
├── ui/           React front end
├── docs/         Privacy model, threat model, wave write-ups, demo script
└── scripts/      Toolchain helpers
```

## 6. Privacy model

| | Value | Where it lives |
| --- | --- | --- |
| 🔒 | Participant secret key | Private state, on device |
| 🔒 | Requested quantity | Private state, on device |
| 🔒 | Commitment opening (nonce) | Private state, on device |
| 🔒 | Which tree leaf is whose | Never derivable from the ledger |
| 👁 | Offering parameters and allocation rule | Public ledger |
| 👁 | Participant count | Public ledger |
| 👁 | **Aggregate** demand | Public ledger |
| 👁 | Hiding commitments, one-way nullifiers | Public ledger |
| 👁 | Each claimed allocation, keyed by an unlinkable tag | Public ledger |

**The issuer is not privileged.** Creating an offering grants no visibility into participant
requests. The issuer sees aggregates and the final result, exactly like everyone else. This is
enforced by the contract, not by the UI.

Full detail in [`docs/privacy-model.md`](docs/privacy-model.md); honest limitations in
[`docs/threat-model.md`](docs/threat-model.md).

## 7. Allocation algorithm

```
effectiveSupply = min(totalSupply, totalDemand)
allocationᵢ     = floor(requestᵢ × effectiveSupply ÷ totalDemand)
```

- **Oversubscribed** (`demand > supply`): every participant receives the same fraction of what they
  asked for. Nobody is preferred.
- **Undersubscribed** (`demand ≤ supply`): `effectiveSupply == totalDemand`, so the formula collapses
  to a full fill.
- **Never over-allocates**: flooring each share means the sum is always `≤ totalSupply`. Any
  rounding remainder stays unallocated, and that is deliberate.
- **Order independent**: the result does not depend on who transacted first, so there is nothing to
  gain by racing.

### Division without a division operator

Compact has no `/` operator. Rather than approximate, EquiVault supplies the quotient as a **private
witness** and constrains it inside the circuit with Euclidean bounds:

```
quotient × demand  ≤  request × effectiveSupply  <  (quotient + 1) × demand
```

Exactly one integer satisfies both inequalities, so the constraint *defines* the quotient rather
than trusting it. Supplying a wrong value does not over-allocate — it makes proof generation fail.

The rule also lives as plain, dependency-free TypeScript in
[`contract/src/allocation.ts`](contract/src/allocation.ts), so the UI can preview it and a verifier
can recompute it. The circuit does not trust that code; it re-derives the same value in-proof.

## 8. The Compact contract

[`contract/src/equivault.compact`](contract/src/equivault.compact) — 5 transaction entry points:

| Circuit | Private inputs | What it proves | What becomes public |
| --- | --- | --- | --- |
| `submitRequest` | secret key, amount, nonce | amount within published limits; this key has not subscribed | commitment, nullifier, updated aggregate demand, participant count |
| `closeSubscriptionAsIssuer` | secret key | caller is the issuer | phase → CLOSED |
| `closeSubscriptionAfterDeadline` | — | the deadline has passed | phase → CLOSED |
| `finalizeAllocation` | secret key | caller is the issuer | phase → FINALIZED |
| `claimAllocation` | secret key, amount, nonce, quotient, Merkle path | the commitment is in the request tree; this key has not claimed; the quotient is the unique correct one | the allocation, keyed by an unlinkable claim nullifier |

Two further circuits — `identityTag` and `requestCommitment` — are **pure**, which in Compact means
they are *not* transaction entry points. `identityTag` was deliberately made pure (taking the
offering id as a parameter instead of reading the ledger) so that it can never be invoked on-chain
with a secret key as a public argument.

**Unlinkability, concretely.** A claim proves membership in the request tree via a **Merkle path
supplied as a private witness**, so the participant never reveals *which* leaf is theirs. Submission
and claim nullifiers are domain-separated hashes of the same key, so the two transactions cannot be
tied together. Nullifiers also bind the offering id, so one key produces unlinkable tags across
different offerings.

## 9. Frontend architecture

- **React 19 + Vite + Tailwind v4**, near-black and gold, tabular numerals for every figure.
- **`OfferingSession`** is the single interface; `DemoOfferingSession` and `LiveOfferingSession`
  implement it.
- **Private state** is held in IndexedDB, encrypted at rest, scoped per wallet account. See
  [`ui/src/lib/privateStorage.ts`](ui/src/lib/privateStorage.ts) for precisely what that does and
  does not protect against.
- **Errors** are mapped to human copy by [`api/src/errors.ts`](api/src/errors.ts). Raw assertion
  strings and private values never reach the screen.

## 10. Setup

### Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | **≥ 24.11.1** | `.nvmrc` pins `24.11.1` |
| Docker | any recent | Only needed for the proof server (live mode) |
| Compact toolchain | compiler **0.31.1** | See below |
| Lace wallet | 4.x connector | Only needed for live mode |

> **Windows users:** the Compact toolchain has no native Windows build — use WSL 2. Note also that
> `compact` on the Windows PATH is the built-in NTFS compression tool, so always invoke the Midnight
> one from inside WSL.

### Install the Compact toolchain

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

Then pin the compiler that matches this project's SDK:

```bash
compact update 0.31.1
```

> **Why pin?** The toolchain has two incompatible tracks. Compiler **0.31.1** (language 0.23) pairs
> with `compact-runtime` 0.16.0 and Midnight.js **4.1.1** — the current stable line, and what this
> project targets. Compiler 0.34.0 emits code requiring `compact-runtime` 0.19.0, which only pairs
> with a `5.0.0-beta` SDK. Installing "latest" gives you 0.34.0 and a
> `Version mismatch: compiled code expects 0.19.0, runtime is 0.16.0` error at test time.

### Install and build

```bash
npm install
npm run compact     # compile the Compact contract to circuits + keys
npm run build       # build contract, api and ui
```

## 11. Environment variables

`ui/.env` (copy from `ui/.env.example`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_NETWORK_ID` | `preprod` | Midnight network the wallet connects to |
| `VITE_DEMO_MODE` | `true` | Start in Demo Mode (no wallet required) |
| `VITE_LOG_LEVEL` | `error` | Browser console verbosity |

There are no secrets in this project. Participant private state is generated in the browser and
never transmitted.

## 12. Local development

```bash
npm run dev         # http://localhost:5173
```

That is enough to explore the whole product in Demo Mode. For the live network you also need:

```bash
npm run proof-server        # docker, listens on :6300
npm run proof-server:stop
```

and a Lace wallet set to the matching network with its proof server pointed at
`http://localhost:6300`, funded from the faucet.

## 13. Testing

```bash
npm test                                      # contract tests
npm run test --workspace @equivault/api       # verification + error mapping
npm run test --workspace @equivault/ui        # demo mode, formatting, key handling
```

**105 tests**, covering:

- **Contract (45):** offering creation and invalid parameters; valid and invalid requests; requests
  after the deadline; duplicate subscription; unauthorized close and finalize; oversubscribed and
  undersubscribed allocation; boundary where demand equals supply; double claims; claims from
  non-participants; claims that inflate the requested amount; order independence; and a property
  test asserting the sum of allocations never exceeds supply across 200 random populations.
- **Privacy (within the contract suite):** dedicated tests asserting that no individual requested
  quantity, secret key or commitment opening ever appears anywhere in public state; that
  commitments hide *and* bind the amount; that an attacker who correctly guesses an amount still
  cannot match the published commitment without the opening; and that one key yields unlinkable
  tags across offerings and across domains.
- **API (37):** every verification invariant, circuit-binding pass/fail/missing/unexpected cases,
  and the full error-classification table — including assertions that friendly copy never echoes a
  raw assertion string or a numeric value from the underlying error.
- **UI (23):** demo seeding for all three offerings, the complete submit → close → finalize → claim
  journey, formatting, and private-state key handling.

## 14. Network deployment

Full guide: [`docs/deployment.md`](docs/deployment.md) — Netlify/Vercel config, contract
deployment steps, and the verified cloud-build result.


1. Start the proof server and connect a funded Lace wallet.
2. `npm run compact && npm run build`.
3. Open **Issue**, fill in the offering, review the privacy preview, then **Launch offering** — this
   deploys a contract instance and returns its address.
4. Share the address. Participants join it, subscribe privately, and claim after finalization.

The UI serves prover keys and circuit IR from its own origin (`scripts/copy-zk-assets.mjs` copies
them into `ui/public`), so the browser proves against exactly the artifacts this build compiled.

## 15. Demo instructions

Fastest path for a reviewer — no wallet, no Docker, about a minute:

```bash
npm install && npm run compact && npm run dev
```

1. Land on `/` and read the hero, then drag the slider in the interactive example.
2. **Enter EquiVault** → three seeded offerings. Aurora is exactly 2.5x oversubscribed.
3. Open **Aurora Energy Systems**, enter `8,000`, and note the live projection.
4. **Submit private request** — demand moves 250,000 → 258,000, participants 5 → 6, and the request
   itself appears nowhere public.
5. Use the demo controls to **Close subscription**, then **Finalize allocation**.
6. **Claim my allocation** → 3,100 shares, which is `floor(8,000 × 100,000 ÷ 258,000)`.
7. **Verify this result yourself** → invariants recomputed in your browser from public state alone.

A full narration is in [`docs/demo-script.md`](docs/demo-script.md), and practical recording
advice in [`docs/recording-guide.md`](docs/recording-guide.md).

## 16. Threat model

See [`docs/threat-model.md`](docs/threat-model.md). The headline, stated up front because it is the
honest thing to do:

> **Aggregate demand is a running public total.** The change between two consecutive subscription
> transactions equals one participant's request. That amount is **not attributable to an identity**
> — Midnight transactions do not publish a sender, and the participant appears on-chain only as a
> one-way nullifier — but it *is* observable. EquiVault does not claim otherwise, and the
> verification screen says so in the product itself.

## 17. Known limitations

- **Demand-delta observability** — see above. The mitigation (batched or committed tallying) is Wave 3 work.
- **Demo Mode does not generate proofs.** It runs the real circuits and enforces every assertion,
  but there is no proof server and no ledger. Labelled everywhere, and encoded in `capabilities`.
- **Circuit binding is live-mode only.** Comparing deployed verifier keys against this build's
  requires a deployed contract; in Demo Mode the check honestly reports *not applicable* rather than
  showing a green tick.
- **Losing private state forfeits a claim.** Openings live in the browser. Clearing site data or
  switching device means an allocation can no longer be claimed. That is the cost of holding the
  secret yourself; an export/import flow is Wave 2/3 work.
- **1,024 participants per offering** — the request tree is depth 10.
- **Quantities are capped at 2^40** so the verified-division products stay well inside the field.
- **Encryption at rest is device-bound by default.** The generated key sits in `localStorage`
  alongside the data, so it resists inspection of IndexedDB but not script access to the origin.
- **Flooring leaves a remainder unallocated.** Correct and deliberate, but it does mean a handful of
  units can go undistributed.

## 18. Roadmap

| Wave | Focus | Write-up |
| --- | --- | --- |
| **1** | Prove the core idea: private requests, verified allocation, real circuits | [`docs/wave-1.md`](docs/wave-1.md) |
| **2** | Turn it into a product: multiple offerings, issuer and portfolio experiences, stronger verification, real failure handling | [`docs/wave-2.md`](docs/wave-2.md) |
| **3** | Generalize it: private allocation as reusable infrastructure, beyond finance | [`docs/wave-3.md`](docs/wave-3.md) |

---

## Licence

Apache-2.0. The Compact contract derives its project structure from the Midnight Foundation's
`example-bboard`, also Apache-2.0.
