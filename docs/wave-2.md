# Wave 2 — Make it a real product

**Goal:** turn a correct prototype into something a person can actually use.

Wave 1 proved the mechanism. Wave 2 is about everything between "the circuit is right" and "someone
would trust this with a decision that matters". Parts of this landed during Wave 1 because the
architecture made them cheap; the rest is scoped here.

---

## What was improved

### Multiple offerings, and a reason to browse

Wave 1 could have shipped one hardcoded offering. Instead each deployed contract instance *is* an
offering, so the browse view is a genuine list with independent lifecycles: one open and counting
down, one already finalized so a reviewer can inspect a completed result immediately, and one that
is not financial at all.

That third one — a scholarship fund — is the Wave 3 thesis quietly planted in Wave 2. Same
contract, same circuits, `unit: 'scholarships'`, no price.

### A participant experience that survives contact with reality

**Portfolio** assembles positions from private state plus public aggregates. It shows what you
requested (from your device), what you are projected to receive, your fill rate, and what you have
claimed. Nobody else can reconstruct that view — not the issuer, not another participant.

It also carries the warning that matters: your commitment openings live in this browser, and losing
them forfeits the claim. Stating that plainly is part of the product, not a footnote.

### An issuer experience that is deliberately un-privileged

The issuer dashboard shows subscription progress, aggregate demand, oversubscription and settlement
— and an explicit panel saying the issuer *cannot* see individual requests, enforced by the
contract rather than the screen.

The creation flow puts a **privacy preview** before the launch button: exactly what will be public,
exactly what will stay private, including from the issuer themselves. An issuer should understand
the boundary before they publish, not after.

### Contextual privacy explanation throughout

Rather than one explainer page, the privacy boundary is annotated where decisions happen: a
`Private` marker on the amount input, a "your exact request remains private" line under the figure
you just typed, a stays-private/becomes-public pairing on each offering, and an interactive
six-stage flow showing where the amount stops and the commitment continues.

### Stronger verification

The verification screen is written for someone who did not participate and does not trust the
issuer. Every check recomputes from public state and **cites its evidence** — not a tick, but
"3,100 of 100,000 shares allocated", "5 nullifiers, 5 committed requests, 5 participants". Each has
a *Why* expander explaining what it actually proves.

Two design rules held throughout: no badge without a computation behind it, and where something
cannot be checked, say so. Circuit binding reports `not-applicable` in Demo Mode instead of passing.

### Failure handling that does not leak

`api/src/errors.ts` maps every failure — wallet missing, disconnected, rejected; proof server
unreachable; insufficient funds; network down; expired offering; duplicate request; invalid range;
unauthorized finalization; non-participant claim — to a title, an explanation and a retry hint.

Two properties are asserted by tests: friendly copy never echoes a raw assertion string, and never
echoes a numeric value from the underlying error. A raw error could contain a private quantity;
the user-facing copy must not.

---

## Still ahead in Wave 2

- **Private-state export and import.** The single sharpest usability edge is that losing browser
  state forfeits a claim. The SDK's private-state provider already supports passphrase-protected
  export/import; surfacing it as a "back up your openings" flow closes the gap.
- **A passphrase option in the UI.** `setUserPassphrase` exists and is tested, but nothing in the
  interface calls it yet. A user-held passphrase is strictly stronger than the device-bound
  generated key.
- **Permissionless finalization after close.** Today only the issuer can finalize, so an absent
  issuer strands claims. The rule is deterministic and there is nothing to manipulate, so a
  deadline-gated `finalizeAfterDeadline` circuit removes the liveness dependency.
- **Transaction history and verification records** in the portfolio, with links to the settled
  transaction for each action.
- **Offering discovery.** Live mode currently joins by contract address. A registry contract, or an
  indexer query by contract type, would make browsing work on a real network.
- **Multi-device private state**, via an encrypted export the participant moves themselves.

## What becomes more usable

| Before | After |
| --- | --- |
| One offering | A browsable set with independent lifecycles |
| Raw errors | Human copy that never leaks a value or an assertion |
| "Trust us, it is private" | A privacy boundary annotated at each decision point |
| A verification badge | Recomputed checks that cite their evidence |
| Issuer assumed privileged | Issuer shown, explicitly, to be un-privileged |
| Wallet required to see anything | Demo Mode: real circuits, no wallet, under a minute |
