# Deploying EquiVault

## The shape of the problem

EquiVault has **no backend**. That is not a simplification for the hackathon — it falls out of the
privacy architecture:

| Component | Where it runs | Who hosts it |
| --- | --- | --- |
| Frontend | Static SPA | Netlify / Vercel (free tier) |
| Contract | Midnight network | The chain, once deployed from a wallet |
| Public state | Midnight indexer | Midnight infrastructure |
| **Proof generation** | **The user's own machine** | **The user** |
| Private state | The user's browser (IndexedDB) | Nobody else |

The fourth row is the important one. Proving happens on the participant's machine *because* the
witness is private — a hosted prover would have to be given the secret, which would defeat the
product. So there is no server for me to deploy, and no server for anyone to trust.

**Consequence for the deployed URL:** Demo Mode works fully for any visitor with zero setup. Live
mode additionally requires *that visitor* to run their own proof server and wallet locally.

---

## 1. Smart contract — NOT deployed yet

**Status: compiled, tested, not on-chain.**

The contract compiles to 5 circuits with prover and verifier keys, and is exercised by 45 contract
tests plus 23 UI tests running the real circuits. It has not been deployed to a Midnight network.

I could not deploy it, for two reasons that are worth stating plainly:

1. **Deployment needs a funded wallet.** It costs tDUST, and the deploy transaction is signed by a
   wallet I do not have and should not create or hold credentials for.
2. **Deployment happens from the browser.** `EquiVaultAPI.deploy` runs client-side through the Lace
   connector. There is no server-side deploy script to run, by design.

So deployment is a two-minute action for you, below.

### Deploy the contract

```bash
# 1. Proof server (leave running)
npm run proof-server
```

2. **Lace wallet** → create/open a Midnight wallet → set **Network** to `Preprod` → set **Proof
   server** to `http://localhost:6300`.
3. Fund it: [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/) → then **Tokens →
   Generate tDUST** and confirm. tDUST pays the fees.
4. `npm run dev` → open `http://localhost:5173` → **Connect wallet**.
5. Go to **Issue**, fill the form, review the privacy preview, **Launch offering**.
6. Copy the contract address from the URL. That is your deployed offering.

Suggested values for the demo (reproduces the 2.5× worked example):

| Field | Value |
| --- | --- |
| Name | Aurora Energy Systems |
| Unit | shares |
| Total supply | 100000 |
| Simulated price | 25 |
| Min / Max request | 100 / 150000 |
| Window | 24 hours |

> Keep the browser profile you deployed from. The issuer identity is a hash of a key held in that
> browser's private state — clearing site data means you can no longer close or finalize.

---

## 2. Frontend — Netlify (recommended)

Netlify is the better fit here: `netlify.toml` is committed, `NODE_VERSION` and `NPM_FLAGS` are set
declaratively, and the SPA redirect plus long-cache headers for the 16 MB of prover keys are already
configured.

### Prerequisite: get it into git

Nothing is committed yet.

```bash
cd equivault
git add -A
git commit -m "EquiVault: privacy-preserving allocation on Midnight"
git branch -M main
git remote add origin https://github.com/<you>/equivault.git
git push -u origin main
```

> **`contract/src/managed/` is committed on purpose** (~16 MB). Cloud build images have no Compact
> toolchain, so shipping the compiled circuits is what lets Netlify build at all — and it lets a
> judge clone and run without installing the compiler. Regenerate any time with `npm run compact`.

### Deploy

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → pick
   the repo.
2. Netlify reads `netlify.toml`, so the settings should already be:
   - Build command: `npm run build`
   - Publish directory: `ui/dist`
3. **Deploy**. First build takes roughly 3–5 minutes (the wasm bundles are large).

Optional, in **Site settings → Environment variables** — the code already defaults to these, but
setting them explicitly makes the deployment self-documenting:

| Key | Value |
| --- | --- |
| `VITE_DEMO_MODE` | `true` |
| `VITE_NETWORK_ID` | `preprod` |

### CLI alternative

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

---

## 3. Frontend — Vercel

`vercel.json` is committed with the equivalent config.

1. [vercel.com/new](https://vercel.com/new) → import the repo.
2. Framework preset: **Other**. Build command `npm run build`, output directory `ui/dist`, install
   command `npm install --legacy-peer-deps`.
3. **Settings → General → Node.js Version → 24.x** (Vercel does not read `.nvmrc`; Netlify does).
4. Deploy.

---

## 4. Verified before writing this

I simulated a cloud build in a shell with **no Compact toolchain on `PATH`** and a fresh checkout
state (generated assets deleted):

```
compact on PATH? -> NO
npm run build  →  ✓ built in 41.38s
ui/dist        →  30 MB
               →  index.html, assets/, keys/, zkir/, favicon.svg, _redirects
```

Then I served `ui/dist` as a plain static site and drove it in a browser: the landing page rendered,
client-side routing worked, and all three demo offerings seeded by executing the real compiled
circuits. The production bundle is what was tested, not just the dev server.

Sizes worth knowing: largest single file is the 9.7 MB ledger wasm; prover keys are 5.0 MB
(`submitRequest`, `claimAllocation`) and 2.7 MB each. All comfortably inside Netlify and Vercel
static limits, and all served `immutable` so they are fetched once.

---

## 5. The one thing to check immediately after deploying

**Live mode from an HTTPS origin talking to `http://localhost:6300`.**

Chrome and Firefox treat `http://localhost` as a *potentially trustworthy* origin, so mixed-content
blocking should not apply — an HTTPS page is normally allowed to call a localhost proof server. But
**I have not tested this from a real HTTPS origin**, only from `http://localhost`, and there may
additionally be a CORS question depending on how the proof server sets its headers.

Check it in one minute once the URL is live: open the deployed site, connect Lace with the proof
server running, and try **Submit private request** on a live offering. If it fails, the browser
console will say whether it was mixed content or CORS.

**If it does fail, nothing is lost for the demo recording.** Record the live-mode segment from
`http://localhost:5173`, which is verified working, and use the deployed URL for everything else.
The deployed URL's job is to let a judge experience the product instantly — and Demo Mode, which
needs no proof server, does exactly that.

---

## 6. Post-deploy checklist

- [ ] Landing page renders, gold gradient and hero intact
- [ ] **Enter EquiVault** → three offerings seed (takes a few seconds; real circuits are executing)
- [ ] Aurora shows **2.5x** and **250,000** total demand
- [ ] Submit a request → demand moves, your number appears nowhere public
- [ ] Close → Finalize → Claim → verification page recomputes its checks
- [ ] **Hard-refresh on a deep link** such as `/offerings/demo%3Aaurora-energy-systems` — this is the
      SPA-redirect test; a 404 here means the redirect rule did not apply
- [ ] Mobile width has no horizontal scroll
- [ ] Browser console has no errors
