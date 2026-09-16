/**
 * Public verification.
 *
 * This screen is written for someone who did not participate and does not
 * trust the issuer. Every claim on it is backed by a computation performed in
 * the browser over public data - and where something is NOT being checked, the
 * screen says so rather than showing a green tick.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phase } from '@equivault/contract';
import {
  buildVerificationReport,
  verifyCircuitBinding,
  type VerificationCheck,
} from '@equivault/api';
import manifest from '../generated/circuit-manifest.json';
import { useApp, useOfferingState } from '../contexts/AppContext';
import { DemoOfferingSession } from '../lib/demo';
import {
  Button,
  Callout,
  CheckIcon,
  CrossIcon,
  Divider,
  EmptyState,
  Eyebrow,
  Pill,
  Section,
  Stat,
  cx,
} from '../components/ui';
import { formatMultiple, formatQuantity, truncateHex } from '../lib/format';

const CheckRow = ({ check }: { check: VerificationCheck }) => {
  const [open, setOpen] = useState(false);
  const passed = check.status === 'pass';

  return (
    <li className="border-b border-cream-500/12 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-ink-850/60"
        aria-expanded={open}
      >
        <span
          className={cx(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
            passed ? 'bg-verify-400/15 text-verify-400' : 'bg-danger-400/15 text-danger-400',
          )}
        >
          {passed ? <CheckIcon className="h-3.5 w-3.5" /> : <CrossIcon className="h-3.5 w-3.5" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[0.9rem] text-cream-50">{check.label}</span>
          <span className="tnum mt-0.5 block text-[0.78rem] text-cream-500">{check.evidence}</span>
          {open ? (
            <span className="mt-3 block text-[0.82rem] leading-relaxed text-cream-300">
              {check.explanation}
            </span>
          ) : null}
        </span>

        <span className="mt-1 shrink-0 text-[0.7rem] text-cream-600">{open ? 'Hide' : 'Why'}</span>
      </button>
    </li>
  );
};

export const Verify = () => {
  const { address } = useParams();
  const navigate = useNavigate();
  const { getSession, sessions } = useApp();
  const [input, setInput] = useState('');

  const session = address ? getSession(decodeURIComponent(address)) : undefined;
  const state = useOfferingState(session);

  // The ledger is only directly readable for demo sessions in this build; see
  // the limitation note rendered below.
  const ledger = useMemo(
    () => (session instanceof DemoOfferingSession ? session.getLedger() : undefined),
    [session],
  );

  const report = useMemo(() => (ledger ? buildVerificationReport(ledger) : undefined), [ledger]);

  const binding = useMemo(
    // Demo sessions have no deployed contract, so there are no on-chain
    // verifier keys to compare against. Reported honestly as not-applicable.
    () => verifyCircuitBinding([], session?.mode === 'demo' ? {} : manifest.circuits),
    [session],
  );

  if (!session || !state) {
    return (
      <Section className="py-14">
        <Eyebrow>Verification</Eyebrow>
        <h1 className="mt-3 text-[2.2rem] font-semibold tracking-[-0.02em] sm:text-[2.6rem]">
          Check an allocation for yourself
        </h1>
        <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-cream-300">
          Verification needs no participant data, no wallet and no permission. Pick a finished
          offering and recompute its result from public state alone.
        </p>

        <div className="mt-10 max-w-xl">
          <label htmlFor="address" className="eyebrow">
            Offering address
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="address"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="demo:aurora-energy-systems"
              className="tnum flex-1 rounded-md border border-cream-500/20 bg-ink-900 px-4 py-2.5 text-[0.85rem] outline-none focus:border-gold-500/60"
            />
            <Button
              onClick={() => navigate(`/verify/${encodeURIComponent(input.trim())}`)}
              disabled={input.trim() === ''}
            >
              Verify
            </Button>
          </div>
        </div>

        {sessions.length > 0 ? (
          <div className="mt-12">
            <Eyebrow>Or pick a loaded offering</Eyebrow>
            <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-cream-500/15 bg-cream-500/15 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((item) => (
                <button
                  key={item.address}
                  type="button"
                  onClick={() => navigate(`/verify/${encodeURIComponent(item.address)}`)}
                  className="bg-ink-900 p-5 text-left transition-colors hover:bg-ink-850"
                >
                  <p className="text-[0.95rem] font-medium text-cream-50">
                    {item.getState().name}
                  </p>
                  <p className="tnum mt-1 text-[0.75rem] text-cream-600">{item.address}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-12">
            <EmptyState title="No offerings loaded">
              Open the offerings page first so there is something to verify.
            </EmptyState>
          </div>
        )}
      </Section>
    );
  }

  return (
    <Section className="py-12">
      <button
        type="button"
        onClick={() => navigate('/verify')}
        className="text-[0.82rem] text-cream-500 hover:text-cream-100"
      >
        &larr; Verify another offering
      </button>

      <header className="mt-6 flex flex-col gap-4 border-b border-cream-500/15 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Independent verification</Eyebrow>
          <h1 className="mt-3 text-[2.1rem] font-semibold tracking-[-0.025em] sm:text-[2.5rem]">
            {state.name}
          </h1>
          <p className="tnum mt-2 text-[0.78rem] text-cream-600">{session.address}</p>
        </div>
        {report ? (
          <Pill tone={report.allPassed ? 'verify' : 'danger'}>
            {report.allPassed ? (
              <>
                <CheckIcon className="h-3 w-3" /> All public checks passed
              </>
            ) : (
              <>
                <CrossIcon className="h-3 w-3" /> Checks failed
              </>
            )}
          </Pill>
        ) : null}
      </header>

      {/* --- recomputed figures ------------------------------------------ */}
      {report ? (
        <>
          <div className="grid grid-cols-2 gap-8 py-9 lg:grid-cols-4">
            <Stat label="Supply" value={formatQuantity(report.math.totalSupply)} />
            <Stat label="Aggregate demand" value={formatQuantity(report.math.totalDemand)} />
            <Stat
              label="Oversubscription"
              value={formatMultiple(report.math.oversubscriptionBps)}
              accent
            />
            <Stat
              label="Allocated"
              value={formatQuantity(report.math.allocatedTotal)}
              hint={`${formatQuantity(report.math.unallocatedRemainder)} unallocated`}
            />
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
            <div>
              <Eyebrow>Checks performed in your browser</Eyebrow>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-cream-500">
                Each one is an arithmetic or set-cardinality test over public ledger state. None of
                them needs a single participant&rsquo;s request.
              </p>

              <ul className="mt-5 overflow-hidden rounded-lg border border-cream-500/15">
                {report.checks.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </ul>

              <Divider className="my-9" />

              <Eyebrow>Recompute the rule</Eyebrow>
              <div className="mt-3 rounded-lg border border-cream-500/15 bg-ink-900/70 p-5">
                <p className="tnum rounded bg-ink-950 px-3 py-2.5 text-[0.8rem] text-gold-300">
                  allocation = floor(request &times; min({formatQuantity(report.math.totalSupply)},{' '}
                  {formatQuantity(report.math.totalDemand)}) &divide;{' '}
                  {formatQuantity(report.math.totalDemand)})
                </p>
                <p className="mt-3 text-[0.82rem] leading-relaxed text-cream-300">
                  Substituting any request into this formula gives that participant&rsquo;s
                  allocation. The largest share the rule can produce for this offering is{' '}
                  <span className="tnum text-cream-50">
                    {formatQuantity(report.math.maximumPossibleAllocation)} {state.unit}
                  </span>
                  , and every published receipt respects that bound.
                </p>
              </div>
            </div>

            <div>
              <Eyebrow>What is being proven</Eyebrow>
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-cream-500/15 bg-ink-900/60 p-5">
                  <p className="text-[0.88rem] font-medium text-cream-50">
                    Enforced by the circuits
                  </p>
                  <ul className="mt-2.5 space-y-1.5 text-[0.82rem] text-cream-300">
                    <li>&bull; Each request was within the published limits.</li>
                    <li>&bull; Each participant subscribed at most once.</li>
                    <li>&bull; Each claim opened a genuinely committed request.</li>
                    <li>&bull; Each allocation is the unique correct quotient.</li>
                    <li>&bull; Only the issuer could finalize.</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-cream-500/15 bg-ink-900/60 p-5">
                  <p className="text-[0.88rem] font-medium text-cream-50">Never revealed</p>
                  <ul className="mt-2.5 space-y-1.5 text-[0.82rem] text-cream-300">
                    <li>&bull; Any individual requested quantity.</li>
                    <li>&bull; Any participant&rsquo;s identity or wallet.</li>
                    <li>&bull; Which committed request belongs to whom.</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-warn-400/30 bg-warn-400/[0.05] p-5">
                  <p className="text-[0.88rem] font-medium text-warn-400">
                    Observable, and worth knowing
                  </p>
                  <p className="mt-2 text-[0.82rem] leading-relaxed text-cream-300">
                    Aggregate demand is public and updates with each subscription, so the change
                    between two consecutive subscription transactions equals one
                    participant&rsquo;s request. That amount is not attributable to any identity,
                    but it is visible. EquiVault does not claim otherwise.
                  </p>
                </div>
              </div>

              <Divider className="my-8" />

              <Eyebrow>Circuit binding</Eyebrow>
              <div className="mt-3 rounded-lg border border-cream-500/15 bg-ink-900/60 p-5">
                {binding.status === 'not-applicable' ? (
                  <>
                    <Pill tone="neutral">Not applicable in Demo Mode</Pill>
                    <p className="mt-3 text-[0.82rem] leading-relaxed text-cream-300">
                      There is no deployed contract to compare against. On a live offering, this
                      panel hashes the verifier keys the network holds and checks them against the
                      circuits compiled from this repository &mdash; proving the offering runs
                      exactly the source you can read.
                    </p>
                  </>
                ) : (
                  <>
                    <Pill tone={binding.status === 'pass' ? 'verify' : 'danger'}>
                      {binding.status === 'pass' ? 'Circuits match this build' : 'Circuit mismatch'}
                    </Pill>
                    <p className="mt-3 text-[0.82rem] text-cream-300">
                      {binding.matched.length} matched, {binding.mismatched.length} mismatched,{' '}
                      {binding.missing.length} missing, {binding.unexpected.length} unexpected.
                    </p>
                  </>
                )}

                <Divider className="my-4" />
                <p className="eyebrow">Contract source fingerprint</p>
                <p className="tnum mt-1 text-[0.75rem] break-all text-cream-500">
                  {truncateHex(manifest.sourceSha256, 16, 16)}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="py-10">
          <Callout tone="neutral" title="Public state not directly readable here">
            This build reads raw ledger state for locally simulated offerings. For a live offering,
            verification runs against the indexer through the same
            <code className="mx-1 rounded bg-ink-800 px-1.5 py-0.5 text-[0.78rem]">
              buildVerificationReport
            </code>
            function, which is covered by the API test suite.
          </Callout>
        </div>
      )}

      {state.phase !== Phase.FINALIZED ? (
        <div className="mt-8">
          <Callout tone="warn" title="This offering is not finalized yet">
            The checks above still hold, but the allocation is not complete, so the settlement
            figures will keep changing.
          </Callout>
        </div>
      ) : null}
    </Section>
  );
};
