# Demo recording guide

Practical companion to [`demo-script.md`](demo-script.md). That file is the narration; this one is
how to get a clean take.

---

## Before you press record

### Setup (5 minutes)

```bash
cd equivault
npm install
npm run compact          # only if contract/src/managed is missing
npm run dev              # http://localhost:5173
```

For the live-network segment, also:

```bash
npm run proof-server     # leave running
```

### Browser preparation

- **Use a fresh profile or an incognito-style window.** EquiVault stores private state per origin;
  a clean profile guarantees you are not already subscribed to the demo offerings.
- **Zoom to 100%**, window at **1440×900** or larger. The layout is responsive but the stat rows
  read best on a wide viewport.
- **Hide bookmarks and extensions** you are not demonstrating.
- Pre-open the tabs you need: the app, and optionally `contract/src/equivault.compact` in an editor
  if you want to show the source.

### Reset between takes

**Offerings → Reset demo data.** This rebuilds every offering from scratch, so Aurora goes back to
exactly 5 participants and 250,000 demand. Do this before every take — otherwise your second take
starts at 258,000 and the "2.5×" line will be wrong.

A full page reload also resets, because demo offerings are rebuilt in memory on load.

---

## The numbers that must be on screen

These are the ones a judge will check. Verify each take actually shows them:

| Moment | Expected | Why it matters |
| --- | --- | --- |
| Aurora, before you subscribe | **100,000** offered, **250,000** demand, **2.5x** | The worked example from the brief |
| After submitting 8,000 | participants **5 → 6**, demand **250,000 → 258,000** | Only aggregates moved |
| Your allocation after claiming | **3,100 shares** | `floor(8,000 × 100,000 ÷ 258,000)` |
| Fill rate | **39%** | Same fraction everyone else received |

If you want the round **3,200** figure from the original brief instead, subscribe as the *only*
extra participant to an offering already at exactly 250,000 total — i.e. request **8,000** and the
brief's arithmetic assumes demand stays 250,000. The app shows 3,100 because your own 8,000 is
correctly included in the denominator. **Use 3,100 and say so** — it is the honest number, and a
judge who checks the arithmetic will find it correct.

---

## Recommended take structure

Record in **four separate takes** and cut them together. Trying to do three minutes in one pass
means re-recording everything when you fluff the verification section.

### Take 1 — Landing (0:00–0:35)

Scroll slowly. Pause on:
- the hero (`Own your demand. Not everyone else's.`)
- the four leak items
- the interactive slider — **drag it**, do not just point at it; watching the allocation recompute
  live is the moment the rule becomes obvious

### Take 2 — Participate (0:35–1:20)

1. Enter EquiVault → offerings.
2. Open **Aurora Energy Systems**. Let the countdown tick for a beat.
3. Type `8000` slowly. Pause on the `Private` marker and the "you would receive about 3,100" line.
4. **Submit private request.**
5. **This is the key shot:** scroll up so participants and demand are visible as they change, and
   stay there for two seconds. Then scroll to the committed panel showing your 8,000 read from local
   private state.

### Take 3 — Settle and claim (1:20–2:00)

1. Demo controls → **Close subscription** → **Finalize allocation**.
2. Land on Results. Hold on **3,100** for a beat before narrating.
3. Show the "you originally requested 8,000 — never published" panel.

### Take 4 — Verify and generalize (2:00–3:00)

1. **Verify this result yourself.**
2. Expand one check's **Why** so the evidence is visible.
3. **Scroll to the amber panel** and read it. Showing the limitation is more convincing than hiding
   it, and judges notice.
4. Back to offerings → open **Northwind Scholarship Fund** → land the "same contract, no money"
   point.

---

## Optional: the live-network segment

Worth 20 seconds if you have deployed a contract, because it proves the chain integration is real.

1. **Connect wallet** → approve in Lace.
2. Open your deployed offering.
3. Submit a request. Narrate the wait: *"my machine is building the zero-knowledge proof — the
   amount never leaves this device"* — proving takes a few seconds and the pause is the point, not
   dead air.
4. Show the wallet approval dialog.

If you cut this, say explicitly that Demo Mode runs the real compiled circuits without proving. Do
not let a viewer infer that a proof happened when it did not — the app itself is careful about this
and the narration should match.

---

## Things that will bite you

| Problem | Fix |
| --- | --- |
| Offerings take several seconds to appear | Expected — real circuits are executing. Cut the pause, or cover it with narration. |
| "You have already subscribed" | You did a take already. **Reset demo data.** |
| Aurora shows 258,000 instead of 250,000 | Same cause. Reset. |
| Countdown reads 00:00:00 | The offering expired mid-session. Reset. |
| Wallet not detected | Lace must be installed *and* on a Midnight network. Reload after switching. |
| Proof generation fails | Proof server not running, or the wallet's proof server URL is not `http://localhost:6300`. |
| "Not enough test funds" | Generate tDUST in the wallet's Tokens tab. |

---

## Framing, if you only get one line in

> "EquiVault lets you take part in an oversubscribed IPO without revealing how many shares you
> wanted — and still lets anyone check the allocation was fair."

And the close:

> "You should not have to reveal private information just to prove that a fair decision was made."
