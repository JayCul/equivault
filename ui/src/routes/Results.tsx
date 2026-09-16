import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Phase } from '@equivault/contract';
import { toFriendlyFailure, type FriendlyFailure } from '@equivault/api';
import { useApp, useOfferingState } from '../contexts/AppContext';
import {
  Button,
  ButtonLink,
  Callout,
  CheckIcon,
  Divider,
  EmptyState,
  Eyebrow,
  LockIcon,
  Pill,
  Section,
  Stat,
} from '../components/ui';
import { formatMultiple, formatPercent, formatQuantity, formatSimulatedPrice } from '../lib/format';

export const Results = () => {
  const { address = '' } = useParams();
  const { getSession } = useApp();
  const session = getSession(decodeURIComponent(address));
  const state = useOfferingState(session);

  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<bigint | undefined>();
  const [failure, setFailure] = useState<FriendlyFailure | undefined>();

  if (!session || !state) {
    return (
      <Section className="py-24">
        <EmptyState
          title="Offering not found"
          action={
            <ButtonLink to="/offerings" size="sm" variant="secondary">
              Back to offerings
            </ButtonLink>
          }
        >
          This offering is not loaded in the current session.
        </EmptyState>
      </Section>
    );
  }

  if (state.phase !== Phase.FINALIZED) {
    return (
      <Section className="py-24">
        <EmptyState
          title="Allocation is not final yet"
          action={
            <ButtonLink
              to={`/offerings/${encodeURIComponent(session.address)}`}
              size="sm"
              variant="secondary"
            >
              Back to the offering
            </ButtonLink>
          }
        >
          Results appear once the issuer has closed and finalized this offering.
        </EmptyState>
      </Section>
    );
  }

  const allocation = claimed ?? state.viewer.myAllocation;
  const hasClaimed = state.viewer.hasClaimed || claimed !== undefined;

  const handleClaim = async () => {
    setClaiming(true);
    setFailure(undefined);
    try {
      setClaimed(await session.claimAllocation());
    } catch (error: unknown) {
      setFailure(toFriendlyFailure(error));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Section className="py-12">
      <Link
        to={`/offerings/${encodeURIComponent(session.address)}`}
        className="text-[0.82rem] text-cream-500 hover:text-cream-100"
      >
        &larr; {state.name}
      </Link>

      <div className="mt-8 flex flex-col items-center text-center">
        <Pill tone="verify">
          <CheckIcon className="h-3 w-3" /> Allocation complete
        </Pill>
        <h1 className="mt-5 text-[2.4rem] leading-tight font-semibold tracking-[-0.025em] sm:text-[3rem]">
          {state.name}
        </h1>
        <p className="mt-3 max-w-xl text-[0.95rem] text-cream-300">
          The subscription closed and the published rule was applied. No participant request was
          disclosed at any point.
        </p>
      </div>

      {/* --- headline figures --------------------------------------------- */}
      <div className="mt-14 grid grid-cols-2 gap-8 border-y border-cream-500/15 py-10 lg:grid-cols-4">
        <Stat
          label={`${state.unit} offered`}
          value={formatQuantity(state.totalSupply)}
        />
        <Stat
          label="Total simulated demand"
          value={formatQuantity(state.totalDemand)}
          hint="aggregate across all participants"
        />
        <Stat
          label="Oversubscribed"
          value={formatMultiple(state.oversubscriptionBps)}
          accent
          hint={state.totalDemand > state.totalSupply ? 'demand exceeded supply' : 'fully filled'}
        />
        <Stat
          label="Participants"
          value={formatQuantity(state.participantCount)}
          hint={`${formatQuantity(state.claimCount)} claimed so far`}
        />
      </div>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        {/* --- your allocation ------------------------------------------- */}
        <div>
          <Eyebrow>Your allocation</Eyebrow>

          {hasClaimed && allocation !== undefined ? (
            <>
              <p className="tnum mt-4 text-[4.5rem] leading-none font-bold tracking-tight text-gradient-gold">
                {formatQuantity(allocation)}
              </p>
              <p className="mt-2 text-[1rem] text-cream-300">
                {state.unit} allocated to you
                {state.unitPriceCents > 0n ? (
                  <>
                    {' '}
                    &mdash;{' '}
                    <span className="tnum">
                      {formatSimulatedPrice(allocation * state.unitPriceCents)} simulated
                    </span>
                  </>
                ) : null}
              </p>

              {state.viewer.myRequest !== undefined ? (
                <div className="mt-6 rounded-lg border border-gold-500/25 bg-gold-500/[0.05] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[0.85rem] text-cream-300">
                      <LockIcon className="text-gold-400" /> You originally requested
                    </span>
                    <span className="tnum text-[1.05rem] font-semibold text-cream-50">
                      {formatQuantity(state.viewer.myRequest)} {state.unit}
                    </span>
                  </div>
                  <Divider className="my-4" />
                  <div className="flex items-center justify-between text-[0.85rem]">
                    <span className="text-cream-300">Fill rate</span>
                    <span className="tnum text-cream-50">
                      {formatPercent(allocation, state.viewer.myRequest)}
                    </span>
                  </div>
                  <p className="mt-4 text-[0.75rem] leading-relaxed text-cream-600">
                    Your original request is shown from your own private state. It was never
                    published. Only the allocation above became public, because disclosing it is what
                    lets you receive the {state.unit}.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4">
              <p className="text-[0.92rem] leading-relaxed text-cream-300">
                Claiming proves, in zero knowledge, that you hold one of the committed requests and
                that your allocation is exactly what the published rule produces &mdash; without
                revealing which request is yours.
              </p>

              {failure ? (
                <div className="mt-5">
                  <Callout tone="danger" title={failure.title}>
                    {failure.detail}
                  </Callout>
                </div>
              ) : null}

              <Button
                size="lg"
                className="mt-6"
                loading={claiming}
                disabled={!state.viewer.hasSubmitted}
                onClick={() => void handleClaim()}
              >
                Claim my allocation
              </Button>

              {!state.viewer.hasSubmitted ? (
                <p className="mt-3 text-[0.8rem] text-cream-600">
                  You did not subscribe to this offering, so there is nothing to claim.
                </p>
              ) : null}
            </div>
          )}

          <Divider className="my-10" />

          <Eyebrow>Settlement</Eyebrow>
          <dl className="mt-4 grid grid-cols-2 gap-6">
            <div>
              <dt className="text-[0.8rem] text-cream-500">Allocated</dt>
              <dd className="tnum mt-1 text-[1.1rem] text-cream-50">
                {formatQuantity(state.allocatedTotal)} {state.unit}
              </dd>
            </div>
            <div>
              <dt className="text-[0.8rem] text-cream-500">Unallocated</dt>
              <dd className="tnum mt-1 text-[1.1rem] text-cream-50">
                {formatQuantity(state.totalSupply - state.allocatedTotal)} {state.unit}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[0.78rem] leading-relaxed text-cream-600">
            Allocations are floored, so a small remainder can stay unallocated. That is what
            guarantees the offering can never allocate more than it holds. Units only appear here
            once a participant has claimed them.
          </p>
        </div>

        {/* --- verification ----------------------------------------------- */}
        <div>
          <Eyebrow>Verified by Midnight</Eyebrow>
          <div className="mt-4 rounded-lg border border-verify-400/25 bg-verify-400/[0.04] p-6">
            <ul className="space-y-3">
              {[
                {
                  label: 'Allocation rule applied as published',
                  detail: 'Recomputable from public aggregates.',
                },
                {
                  label: 'Private requests never disclosed',
                  detail: 'Only commitments and one-way tags are on the ledger.',
                },
                {
                  label: 'Result recorded against unlinkable tags',
                  detail: 'Receipts cannot be tied back to a subscriber.',
                },
                {
                  label: 'Independently checkable by anyone',
                  detail: 'No participant data needed to verify.',
                },
              ].map((item) => (
                <li key={item.label} className="flex gap-3">
                  <CheckIcon className="mt-0.5 shrink-0 text-verify-400" />
                  <span>
                    <span className="block text-[0.88rem] text-cream-50">{item.label}</span>
                    <span className="block text-[0.78rem] text-cream-500">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <ButtonLink
              to={`/verify/${encodeURIComponent(session.address)}`}
              variant="secondary"
              size="md"
              className="mt-6 w-full"
            >
              Verify this result yourself
            </ButtonLink>
          </div>

          <p className="mt-4 text-[0.75rem] leading-relaxed text-cream-600">
            {session.capabilities.settlesOnChain
              ? 'Every transaction in this offering carried a zero-knowledge proof that Midnight verified before accepting it.'
              : 'Demo Mode: the circuits and the rule are real, but no zero-knowledge proof was generated and nothing settled on Midnight.'}
          </p>
        </div>
      </div>
    </Section>
  );
};
