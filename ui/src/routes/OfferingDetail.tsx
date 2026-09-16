import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { allocationFor, Phase } from '@equivault/contract';
import { toFriendlyFailure, type FriendlyFailure } from '@equivault/api';
import { useApp, useOfferingState } from '../contexts/AppContext';
import { KnowsRevealsPanel, PrivacyFlow } from '../components/PrivacyFlow';
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
  Spinner,
  Stat,
  Visibility,
  cx,
} from '../components/ui';
import {
  countdownTo,
  formatDeadline,
  formatMultiple,
  formatQuantity,
  formatSimulatedPrice,
} from '../lib/format';

type Step = 'idle' | 'sealing' | 'proving' | 'submitting' | 'done';

const STEP_COPY: Record<Exclude<Step, 'idle' | 'done'>, string> = {
  sealing: 'Sealing your request on this device',
  proving: 'Building the zero-knowledge proof',
  submitting: 'Submitting the transaction',
};

export const OfferingDetail = () => {
  const { address = '' } = useParams();
  const navigate = useNavigate();
  const { getSession, mode } = useApp();
  const session = getSession(decodeURIComponent(address));
  const state = useOfferingState(session);

  const [amountText, setAmountText] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [failure, setFailure] = useState<FriendlyFailure | undefined>();
  const [countdown, setCountdown] = useState(() =>
    state ? countdownTo(state.subscriptionDeadline) : undefined,
  );

  useEffect(() => {
    if (!state) return;
    const tick = () => setCountdown(countdownTo(state.subscriptionDeadline));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  const amount = useMemo(() => {
    const digits = amountText.replace(/[^\d]/g, '');
    return digits.length > 0 ? BigInt(digits) : undefined;
  }, [amountText]);

  const validation = useMemo(() => {
    if (!state || amount === undefined) return undefined;
    if (amount < state.minRequest) {
      return `Minimum request is ${formatQuantity(state.minRequest)} ${state.unit}.`;
    }
    if (amount > state.maxRequest) {
      return `Maximum request is ${formatQuantity(state.maxRequest)} ${state.unit}.`;
    }
    return undefined;
  }, [amount, state]);

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

  const isOpen = state.phase === Phase.OPEN && !countdown?.expired;
  const canSubmit =
    isOpen && !state.viewer.hasSubmitted && amount !== undefined && validation === undefined;

  const projected =
    amount !== undefined && state.totalDemand >= 0n
      ? allocationFor(amount, state.totalSupply, state.totalDemand + amount)
      : undefined;

  const handleSubmit = async () => {
    if (amount === undefined) return;
    setFailure(undefined);
    try {
      setStep('sealing');
      await new Promise((resolve) => setTimeout(resolve, 260));
      setStep(session.capabilities.generatesZkProofs ? 'proving' : 'submitting');
      await session.submitRequest(amount);
      setStep('done');
      setAmountText('');
    } catch (error: unknown) {
      setFailure(toFriendlyFailure(error));
      setStep('idle');
    }
  };

  return (
    <Section className="py-12">
      <Link to="/offerings" className="text-[0.82rem] text-cream-500 hover:text-cream-100">
        &larr; All offerings
      </Link>

      {/* --- header ------------------------------------------------------- */}
      <header className="mt-6 flex flex-col gap-5 border-b border-cream-500/15 pb-9 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={isOpen ? 'gold' : state.phase === Phase.FINALIZED ? 'verify' : 'neutral'}>
              {isOpen
                ? 'Subscription open'
                : state.phase === Phase.FINALIZED
                  ? 'Allocation final'
                  : 'Closed'}
            </Pill>
            <Pill tone="neutral">{state.unit}</Pill>
            {mode === 'demo' ? <Pill tone="gold">Demo</Pill> : null}
          </div>
          <h1 className="mt-4 text-[2.3rem] leading-tight font-semibold tracking-[-0.025em] sm:text-[2.9rem]">
            {state.name}
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-cream-300">{state.description}</p>
        </div>

        {isOpen && countdown ? (
          <div className="shrink-0 text-left lg:text-right">
            <p className="eyebrow">Subscription closes</p>
            <p className="tnum mt-1 text-3xl font-semibold tracking-tight text-gradient-gold">
              {countdown.label}
            </p>
            <p className="mt-1 text-[0.78rem] text-cream-600">
              {formatDeadline(state.subscriptionDeadline)}
            </p>
          </div>
        ) : null}
      </header>

      {/* --- key figures -------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-8 py-9 lg:grid-cols-4">
        <Stat
          label={`${state.unit} offered`}
          value={formatQuantity(state.totalSupply)}
          hint="fixed supply"
        />
        <Stat
          label="Simulated price"
          value={
            state.unitPriceCents > 0n ? formatSimulatedPrice(state.unitPriceCents) : 'Not priced'
          }
          hint="no real money"
        />
        <Stat
          label="Participants"
          value={formatQuantity(state.participantCount)}
          hint="count only, no identities"
        />
        <Stat
          label="Subscription level"
          value={
            state.totalDemand > 0n ? formatMultiple(state.oversubscriptionBps) : <span>&mdash;</span>
          }
          accent={state.totalDemand > state.totalSupply}
          hint={`${formatQuantity(state.totalDemand)} total demand`}
        />
      </div>

      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        {/* --- left: participate ----------------------------------------- */}
        <div>
          <Eyebrow>Participate</Eyebrow>

          {state.viewer.hasSubmitted ? (
            <div className="mt-4 rounded-lg border border-verify-400/30 bg-verify-400/[0.05] p-6">
              <p className="flex items-center gap-2 text-[1rem] font-semibold text-verify-400">
                <CheckIcon /> Your private request is committed
              </p>
              <p className="mt-2 text-[0.88rem] leading-relaxed text-cream-300">
                The chain holds a commitment to your request and a one-way tag proving you
                subscribed exactly once. It does not hold your quantity.
              </p>

              {state.viewer.myRequest !== undefined ? (
                <div className="mt-5 rounded-md border border-gold-500/25 bg-gold-500/[0.05] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[0.82rem] text-cream-300">
                      <LockIcon className="text-gold-400" /> You requested
                    </span>
                    <span className="tnum text-[1.05rem] font-semibold text-gradient-gold">
                      {formatQuantity(state.viewer.myRequest)} {state.unit}
                    </span>
                  </div>
                  <p className="mt-2 text-[0.75rem] text-cream-600">
                    Read from your local private state. Visible only to you, on this device.
                  </p>
                </div>
              ) : null}

              {state.phase === Phase.FINALIZED ? (
                <ButtonLink
                  to={`/offerings/${encodeURIComponent(session.address)}/results`}
                  size="md"
                  className="mt-5"
                >
                  View your allocation
                </ButtonLink>
              ) : (
                <p className="mt-5 text-[0.82rem] text-cream-500">
                  Your allocation can be claimed once the issuer finalizes this offering.
                </p>
              )}
            </div>
          ) : !isOpen ? (
            <Callout tone="neutral" title="Subscription is closed">
              This offering is no longer accepting requests.
              {state.phase === Phase.FINALIZED ? (
                <>
                  {' '}
                  <Link
                    to={`/offerings/${encodeURIComponent(session.address)}/results`}
                    className="text-gold-400 underline underline-offset-2"
                  >
                    See the final allocation
                  </Link>
                  .
                </>
              ) : null}
            </Callout>
          ) : (
            <div className="mt-4">
              <label htmlFor="amount" className="flex items-center justify-between">
                <span className="text-[0.88rem] text-cream-100">
                  How many {state.unit} do you want?
                </span>
                <Visibility kind="private" />
              </label>

              <input
                id="amount"
                inputMode="numeric"
                autoComplete="off"
                placeholder={`${formatQuantity(state.minRequest)} – ${formatQuantity(state.maxRequest)}`}
                value={amountText}
                onChange={(event) => {
                  const digits = event.target.value.replace(/[^\d]/g, '');
                  setAmountText(digits === '' ? '' : formatQuantity(BigInt(digits)));
                }}
                disabled={step !== 'idle'}
                className={cx(
                  'tnum mt-3 w-full rounded-md border bg-ink-900 px-4 py-3.5 text-2xl font-semibold tracking-tight outline-none transition-colors',
                  validation
                    ? 'border-danger-400/50 text-danger-400'
                    : 'border-cream-500/20 text-cream-50 focus:border-gold-500/60',
                )}
              />

              <div className="mt-2 flex min-h-5 items-center justify-between text-[0.78rem]">
                <span className={validation ? 'text-danger-400' : 'text-cream-600'}>
                  {validation ??
                    `Between ${formatQuantity(state.minRequest)} and ${formatQuantity(state.maxRequest)} ${state.unit}`}
                </span>
                {amount !== undefined && state.unitPriceCents > 0n && !validation ? (
                  <span className="tnum text-cream-600">
                    {formatSimulatedPrice(amount * state.unitPriceCents)} simulated
                  </span>
                ) : null}
              </div>

              {amount !== undefined && !validation ? (
                <div className="mt-5 rounded-md border border-cream-500/15 bg-ink-900/70 p-4">
                  <p className="text-[0.88rem] text-cream-100">
                    You are requesting{' '}
                    <span className="tnum font-semibold text-gradient-gold">
                      {formatQuantity(amount)} {state.unit}
                    </span>
                    .
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-[0.8rem] text-cream-500">
                    <LockIcon className="text-gold-400" />
                    Your exact request remains private.
                  </p>
                  {projected !== undefined ? (
                    <p className="mt-3 border-t border-cream-500/12 pt-3 text-[0.8rem] text-cream-500">
                      At the current demand level you would receive about{' '}
                      <span className="tnum text-cream-100">
                        {formatQuantity(projected)} {state.unit}
                      </span>
                      . This changes as others subscribe.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {failure ? (
                <div className="mt-5">
                  <Callout tone="danger" title={failure.title}>
                    {failure.detail}
                  </Callout>
                </div>
              ) : null}

              {step !== 'idle' && step !== 'done' ? (
                <div className="mt-5 flex items-center gap-3 rounded-md border border-gold-500/25 bg-gold-500/[0.05] px-4 py-3">
                  <Spinner className="text-gold-400" />
                  <span className="text-[0.85rem] text-cream-100">{STEP_COPY[step]}</span>
                </div>
              ) : null}

              <Button
                size="lg"
                className="mt-6 w-full"
                disabled={!canSubmit}
                loading={step !== 'idle' && step !== 'done'}
                onClick={() => void handleSubmit()}
              >
                Submit private request
              </Button>

              <p className="mt-3 text-center text-[0.75rem] text-cream-600">
                {session.capabilities.generatesZkProofs
                  ? 'Your wallet will ask you to approve the transaction. The amount is not part of it.'
                  : 'Demo Mode runs the real circuit locally. No proof is generated and nothing settles on chain.'}
              </p>
            </div>
          )}

          {/* issuer / lifecycle controls */}
          <LifecycleControls session={session} state={state} navigate={navigate} />
        </div>

        {/* --- right: privacy -------------------------------------------- */}
        <div>
          <Eyebrow>What stays private</Eyebrow>
          <h2 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.015em] text-cream-50">
            Your requested quantity is never published.
          </h2>
          <p className="mt-3 text-[0.88rem] leading-relaxed text-cream-300">
            EquiVault publishes a commitment to your request, not the request. The allocation is
            still fully checkable, because the rule only needs public aggregates and a proof that
            your private number was used correctly.
          </p>

          <KnowsRevealsPanel
            className="mt-6"
            requested={state.viewer.myRequest ?? amount}
            unit={state.unit}
          />

          <Divider className="my-8" />

          <Eyebrow>Allocation rule</Eyebrow>
          <div className="mt-3 rounded-lg border border-cream-500/15 bg-ink-900/70 p-5">
            <p className="text-[0.9rem] font-medium text-cream-50">
              Pro rata, floored
            </p>
            <p className="tnum mt-3 rounded bg-ink-950 px-3 py-2.5 text-[0.8rem] text-gold-300">
              allocation = floor(request &times; min(supply, demand) &divide; demand)
            </p>
            <ul className="mt-4 space-y-1.5 text-[0.82rem] text-cream-300">
              <li>&bull; Oversubscribed: everyone receives the same fraction of their request.</li>
              <li>&bull; Undersubscribed: every request is filled completely.</li>
              <li>&bull; Flooring guarantees the supply can never be exceeded.</li>
              <li>&bull; The outcome does not depend on submission order.</li>
            </ul>
          </div>

          <Divider className="my-8" />

          <Eyebrow>Under the hood</Eyebrow>
          <div className="mt-3">
            <PrivacyFlow
              amount={state.viewer.myRequest ?? amount ?? 40_000n}
              unit={state.unit}
              autoplay={false}
            />
          </div>
        </div>
      </div>
    </Section>
  );
};

/* -------------------------------------------------------------------------- */

const LifecycleControls = ({
  session,
  state,
  navigate,
}: {
  session: ReturnType<typeof useApp>['sessions'][number];
  state: NonNullable<ReturnType<typeof useOfferingState>>;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const [busy, setBusy] = useState<'close' | 'finalize' | undefined>();
  const [failure, setFailure] = useState<FriendlyFailure | undefined>();

  const run = async (action: 'close' | 'finalize') => {
    setBusy(action);
    setFailure(undefined);
    try {
      if (action === 'close') {
        await session.closeSubscription();
      } else {
        await session.finalizeAllocation();
        navigate(`/offerings/${encodeURIComponent(session.address)}/results`);
      }
    } catch (error: unknown) {
      setFailure(toFriendlyFailure(error));
    } finally {
      setBusy(undefined);
    }
  };

  if (state.phase === Phase.FINALIZED) return null;

  const canClose = state.phase === Phase.OPEN;
  const canFinalize = state.phase === Phase.CLOSED;
  const isIssuer = state.viewer.isIssuer;
  const demoDriven = session.mode === 'demo';

  // Live mode: only surface controls the viewer can actually use.
  if (!demoDriven && !isIssuer && !canClose) return null;

  return (
    <div className="mt-10 rounded-lg border border-cream-500/15 bg-ink-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>{demoDriven ? 'Demo controls' : 'Issuer controls'}</Eyebrow>
        {isIssuer ? <Pill tone="gold">You are the issuer</Pill> : null}
      </div>

      <p className="mt-2 text-[0.82rem] leading-relaxed text-cream-500">
        {demoDriven
          ? 'Drive the offering through its lifecycle so you can see the allocation and verification without waiting for the deadline.'
          : 'Closing freezes demand. Finalizing locks the pro-rata factor so participants can claim.'}
      </p>

      {failure ? (
        <div className="mt-4">
          <Callout tone="danger" title={failure.title}>
            {failure.detail}
          </Callout>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canClose}
          loading={busy === 'close'}
          onClick={() => void run('close')}
        >
          Close subscription
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canFinalize}
          loading={busy === 'finalize'}
          onClick={() => void run('finalize')}
        >
          Finalize allocation
        </Button>
      </div>
    </div>
  );
};
