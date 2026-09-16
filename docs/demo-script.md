# EquiVault demo script

A three-minute walkthrough, written so it lands for a judge who has never heard of Midnight.

**Setup:** `npm install && npm run compact && npm run dev`, then open `http://localhost:5173`.
No wallet, no Docker, no tokens. Demo Mode runs the real compiled circuits locally.

Reset between takes with **Reset demo data** on the offerings page.

---

### 0:00 — The hook

> "What if you could take part in an oversubscribed IPO without revealing how many shares you
> wanted?"

*Black screen, then the landing page.*

### 0:10 — The landing page

*Scroll slowly through the hero.*

> "EquiVault. Own your demand — not everyone else's.
>
> A company offers a hundred thousand shares. Ten thousand people want in. To prove the split was
> fair, allocation systems publish who asked for what. That leaks your capacity, your strategy, and
> how badly you wanted in."

*Stop on the interactive example. Drag the slider.*

> "Here's the rule everyone agrees to up front: pro rata. Ask for forty thousand out of two hundred
> and fifty thousand of demand, and you get sixteen thousand of the hundred thousand shares. The
> question is whether that can be proven without publishing the book."

### 0:20 — Open the offering

*Click Enter EquiVault. Three offerings appear.*

> "Three simulated offerings. Note the third — a scholarship fund. Same contract. I'll come back to
> that."

*Open Aurora Energy Systems.*

> "A hundred thousand shares. Five participants so far. Two hundred and fifty thousand of demand —
> exactly two and a half times oversubscribed. That number is public. What each of those five people
> asked for is not."

### 0:35 — On the wallet

> "I'm in Demo Mode, which runs the real compiled circuits in the browser — every range check, every
> nullifier, every Merkle proof. What it doesn't do is generate a zero-knowledge proof or settle on
> chain, and the app says so rather than showing a badge it hasn't earned. Connecting a Lace wallet
> switches to the live network."

### 0:45 — Submit a private request

*Type 8,000.*

> "I want eight thousand shares. Watch the label: private. It tells me I'd receive about three
> thousand one hundred at the current demand level."

*Click Submit private request.*

> "Now watch the public state. Participants: five to six. Demand: two-fifty to two-fifty-eight.
>
> And that's all that moved. My eight thousand appears nowhere. The chain got a commitment — thirty
> two bytes that reveal nothing about the amount — and a one-way tag proving I subscribed exactly
> once."

### 1:00 — The privacy visualization

*Scroll to the flow diagram. Click through the stages.*

> "Here's the boundary. My device holds the secret key, the amount, and the opening. What crosses is
> a sealed commitment and a proof that the amount is within the published limits and that I haven't
> subscribed twice.
>
> The proof convinces without disclosing. That's the whole idea."

*Point at the stays-private / becomes-public pairing.*

> "What stays private: my quantity, my identity, my opening, and which committed request is mine.
> What becomes public: a commitment, the aggregate, the rule, and the final result."

### 1:20 — Close and finalize

*Use the demo controls.*

> "The issuer closes the subscription, which freezes demand, and finalizes, which locks the pro-rata
> factor.
>
> Worth saying clearly: the issuer cannot see individual requests either. Not because the interface
> hides them — because no circuit in the contract discloses them."

### 1:40 — The allocation

*Results page.*

> "Three thousand one hundred shares. Floor of eight thousand times a hundred thousand over two
> hundred and fifty-eight thousand. A thirty-nine percent fill, the same fraction everyone else got.
>
> My original request is shown from my own private state — it was never published. Only the
> allocation became public, because disclosing it is what lets me receive the shares. That's
> selective disclosure: I chose to reveal the outcome, not the input."

### 2:00 — Verification

*Click Verify this result yourself.*

> "This is the part I'd want to see if I didn't trust the issuer.
>
> Every check here is recomputed in my browser from public state alone. No participant data. The
> offering never allocated more than it held. The receipts sum to the published total. Each
> participant subscribed once and claimed once. No allocation exceeds what the rule permits."

*Expand a Why.*

> "Each one says what it actually proves, and cites its numbers — not a green tick, evidence."

*Scroll to the warning panel.*

> "And here's what it doesn't claim. Aggregate demand is public and updates with each subscription,
> so the change between two transactions equals one person's request. It isn't attributable to
> anyone — Midnight transactions don't publish a sender — but it is visible. The product says so,
> rather than hoping nobody checks. Fixing it is on the roadmap."

### 2:40 — The bigger idea

*Back to offerings. Open Northwind Scholarship Fund.*

> "A hundred scholarships. Applicants privately declare how much support they need. No shares, no
> price, no money — and not one line of the contract changed.
>
> Because the contract doesn't allocate shares. It allocates units of a scarce resource under a rule
> anyone can check. Procurement bids. Ticket drops. Grant rounds. Compute quotas.
>
> EquiVault started with IPO allocation because that's where the need is obvious. The real product
> is private allocation."

### 3:00 — Close

> "You should not have to reveal private information just to prove that a fair decision was made.
>
> That's what Midnight makes possible, and that's EquiVault."

---

## If you have thirty seconds instead

1. Aurora is 2.5x oversubscribed — the aggregate is public, the individual requests are not.
2. Submit 8,000 — demand moves, your number doesn't appear.
3. Finalize, claim: 3,100 shares.
4. Verify: every invariant recomputed from public state, by someone who wasn't involved.

## Things worth having ready

- **"Is the blockchain part real?"** Yes. The Compact contract compiles with compiler 0.31.1,
  produces prover and verifier keys, and the wallet, proof-server and indexer integration is the
  real Midnight SDK. Demo Mode executes those same compiled circuits; it just doesn't prove or
  settle, and it says so.
- **"How do you divide without a division operator?"** Compact has none. The quotient is a private
  witness constrained by `q × demand ≤ request × supply < (q+1) × demand`. Exactly one integer
  satisfies it, so a wrong witness fails to prove rather than over-allocating.
- **"Can a claim be linked to a submission?"** No. The Merkle path is a private witness, so only the
  already-public root is disclosed, and the two nullifiers are domain-separated hashes of the same
  key.
- **"What can't you do yet?"** See [`threat-model.md`](threat-model.md) — the demand-delta leak, and
  the fact that losing browser state forfeits a claim.
