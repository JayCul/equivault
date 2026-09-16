import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phase } from '@equivault/contract';
import { useApp } from '../contexts/AppContext';
import {
  Button,
  Callout,
  Divider,
  EmptyState,
  Eyebrow,
  Pill,
  Section,
  Spinner,
  cx,
  type PillTone,
} from '../components/ui';
import type { OfferingSession } from '../lib/session';
import { useOfferingState } from '../contexts/AppContext';
import {
  countdownTo,
  formatMultiple,
  formatQuantity,
  formatSimulatedPrice,
} from '../lib/format';

const PHASE_LABEL: Record<Phase, { label: string; tone: PillTone }> = {
  [Phase.OPEN]: { label: 'Subscription open', tone: 'gold' },
  [Phase.CLOSED]: { label: 'Closed', tone: 'neutral' },
  [Phase.FINALIZED]: { label: 'Allocation final', tone: 'verify' },
};

/** Live countdown, ticking once a second while the offering is open. */
const Countdown = ({ deadline }: { deadline: bigint }) => {
  const [value, setValue] = useState(() => countdownTo(deadline));

  useEffect(() => {
    const timer = window.setInterval(() => setValue(countdownTo(deadline)), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return (
    <span className={cx('tnum', value.expired ? 'text-cream-600' : 'text-cream-100')}>
      {value.label}
    </span>
  );
};

const OfferingCard = ({ session }: { session: OfferingSession }) => {
  const state = useOfferingState(session);
  if (!state) return null;

  const phase = PHASE_LABEL[state.phase];
  const isOpen = state.phase === Phase.OPEN;
  const destination = state.phase === Phase.FINALIZED
    ? `/offerings/${encodeURIComponent(session.address)}/results`
    : `/offerings/${encodeURIComponent(session.address)}`;

  return (
    <Link
      to={destination}
      className="group flex flex-col justify-between bg-ink-900 p-7 transition-colors hover:bg-ink-850"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <Pill tone={phase.tone}>{phase.label}</Pill>
          {state.viewer.hasSubmitted ? <Pill tone="gold">You subscribed</Pill> : null}
        </div>

        <h3 className="mt-5 text-[1.3rem] leading-snug font-semibold tracking-[-0.01em] text-cream-50">
          {state.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-[0.85rem] leading-relaxed text-cream-500">
          {state.description}
        </p>
      </div>

      <div className="mt-7">
        <Divider className="mb-5" />
        <dl className="grid grid-cols-2 gap-y-4 text-[0.82rem]">
          <div>
            <dt className="eyebrow">Offered</dt>
            <dd className="tnum mt-1 text-cream-100">
              {formatQuantity(state.totalSupply)} {state.unit}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Price</dt>
            <dd className="tnum mt-1 text-cream-100">
              {state.unitPriceCents > 0n ? (
                <>
                  {formatSimulatedPrice(state.unitPriceCents)}{' '}
                  <span className="text-cream-600">simulated</span>
                </>
              ) : (
                <span className="text-cream-600">Not priced</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Participants</dt>
            <dd className="tnum mt-1 text-cream-100">{formatQuantity(state.participantCount)}</dd>
          </div>
          <div>
            <dt className="eyebrow">{isOpen ? 'Closes in' : 'Demand'}</dt>
            <dd className="mt-1 text-cream-100">
              {isOpen ? (
                <Countdown deadline={state.subscriptionDeadline} />
              ) : (
                <span className="tnum">
                  {formatMultiple(state.oversubscriptionBps)} subscribed
                </span>
              )}
            </dd>
          </div>
        </dl>

        <span className="mt-6 inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-gold-400">
          {state.phase === Phase.FINALIZED ? 'View allocation' : 'View offering'}
          <span className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
        </span>
      </div>
    </Link>
  );
};

export const Offerings = () => {
  const { sessions, loading, loadError, mode, resetDemo, wallet, connect } = useApp();
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetDemo();
    } finally {
      setResetting(false);
    }
  };

  return (
    <Section className="py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Offerings</Eyebrow>
          <h1 className="mt-3 text-[2.2rem] font-semibold tracking-[-0.02em] sm:text-[2.6rem]">
            Browse simulated offerings
          </h1>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-cream-300">
            Every offering below distributes a fixed supply among participants who each submitted a
            private request. Open one to participate, or inspect a finished allocation.
          </p>
        </div>

        {mode === 'demo' ? (
          <Button variant="secondary" size="sm" onClick={handleReset} loading={resetting}>
            Reset demo data
          </Button>
        ) : null}
      </div>

      {mode === 'demo' ? (
        <div className="mt-8">
          <Callout
            tone="gold"
            title="Demo Mode: real circuits, simulated ledger"
            action={
              wallet.kind === 'connected' ? undefined : (
                <Button size="sm" variant="secondary" onClick={() => void connect()}>
                  Connect a wallet for the live network
                </Button>
              )
            }
          >
            These offerings run the actual compiled EquiVault circuits in your browser, including
            every range check, nullifier and Merkle membership proof. They do{' '}
            <strong className="text-cream-100">not</strong> generate zero-knowledge proofs or settle
            on Midnight &mdash; connect a wallet for that.
          </Callout>
        </div>
      ) : null}

      <div className="mt-10">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-cream-500">
            <Spinner /> Preparing offerings and compiling circuit state&hellip;
          </div>
        ) : loadError ? (
          <Callout tone="danger" title={loadError.title}>
            {loadError.detail}
          </Callout>
        ) : sessions.length === 0 ? (
          <EmptyState
            title={mode === 'live' ? 'No offerings joined yet' : 'No offerings available'}
            action={
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Load demo offerings
              </Button>
            }
          >
            {mode === 'live'
              ? 'Create an offering, or join an existing one by its contract address.'
              : 'Reset the demo data to seed the sample offerings again.'}
          </EmptyState>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-lg border border-cream-500/15 bg-cream-500/15 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <OfferingCard key={session.address} session={session} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
};
