/**
 * Issuer flow: create an offering, and manage the ones you issued.
 *
 * The privacy preview before launch is the important part. An issuer should
 * understand, before they publish anything, that creating an offering does NOT
 * grant them visibility into participant requests.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phase } from '@equivault/contract';
import { toFriendlyFailure, type CreateOfferingParams, type FriendlyFailure } from '@equivault/api';
import { useApp, useOfferingState } from '../contexts/AppContext';
import {
  Button,
  Callout,
  Divider,
  Eyebrow,
  EyeIcon,
  LockIcon,
  Pill,
  Section,
  Stat,
  cx,
} from '../components/ui';
import { formatMultiple, formatQuantity } from '../lib/format';
import type { OfferingSession } from '../lib/session';

type Draft = {
  name: string;
  description: string;
  unit: string;
  totalSupply: string;
  unitPrice: string;
  minRequest: string;
  maxRequest: string;
  durationHours: string;
};

const EMPTY: Draft = {
  name: '',
  description: '',
  unit: 'shares',
  totalSupply: '100000',
  unitPrice: '25',
  minRequest: '100',
  maxRequest: '150000',
  durationHours: '24',
};

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[0.82rem] text-cream-100">{label}</span>
    {children}
    {hint ? <span className="text-[0.72rem] text-cream-600">{hint}</span> : null}
  </label>
);

const inputClass =
  'tnum rounded-md border border-cream-500/20 bg-ink-900 px-3.5 py-2.5 text-[0.9rem] text-cream-50 outline-none transition-colors focus:border-gold-500/60 placeholder:text-cream-600';

/* -------------------------------------------------------------------------- */

const PrivacyPreview = ({ draft }: { draft: Draft }) => (
  <div className="grid gap-px overflow-hidden rounded-lg border border-cream-500/15 bg-cream-500/15 sm:grid-cols-2">
    <div className="bg-ink-900 p-5">
      <p className="eyebrow flex items-center gap-2 text-verify-400">
        <EyeIcon /> Will be public
      </p>
      <ul className="mt-3 space-y-2 text-[0.82rem] text-cream-300">
        <li>Offering name and description</li>
        <li>
          Supply: {draft.totalSupply === '' ? '—' : formatQuantity(BigInt(draft.totalSupply || '0'))}{' '}
          {draft.unit}
        </li>
        <li>The allocation rule and its parameters</li>
        <li>Subscription deadline</li>
        <li>Number of participants</li>
        <li>Aggregate demand</li>
        <li>The final allocation result</li>
      </ul>
    </div>

    <div className="bg-ink-900 p-5">
      <p className="eyebrow flex items-center gap-2 text-gold-400">
        <LockIcon /> Will stay private
      </p>
      <ul className="mt-3 space-y-2 text-[0.82rem] text-cream-300">
        <li>Every participant&rsquo;s requested quantity</li>
        <li>Every participant&rsquo;s identity</li>
        <li>Which committed request belongs to whom</li>
        <li>Commitment openings</li>
      </ul>
      <div className="mt-4 rounded-md border border-gold-500/25 bg-gold-500/[0.06] p-3">
        <p className="text-[0.78rem] leading-relaxed text-cream-300">
          <strong className="text-cream-50">Including from you.</strong> Issuing an offering does not
          give you access to participant requests. You will see aggregates and the final result, the
          same as everyone else.
        </p>
      </div>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */

const CreateForm = () => {
  const { createOffering, wallet, connect, mode } = useApp();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FriendlyFailure | undefined>();

  const set = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const parsed = useMemo((): CreateOfferingParams | undefined => {
    try {
      const supply = BigInt(draft.totalSupply || '0');
      const min = BigInt(draft.minRequest || '0');
      const max = BigInt(draft.maxRequest || '0');
      const hours = Number(draft.durationHours || '0');
      if (draft.name.trim() === '' || supply <= 0n || min <= 0n || min > max || hours <= 0) {
        return undefined;
      }
      return {
        name: draft.name.trim(),
        description: draft.description.trim(),
        unit: draft.unit.trim() || 'units',
        totalSupply: supply,
        unitPriceCents: BigInt(Math.round(Number(draft.unitPrice || '0') * 100)),
        minRequest: min,
        maxRequest: max,
        subscriptionDeadline: BigInt(Math.floor(Date.now() / 1000) + hours * 3600),
      };
    } catch {
      return undefined;
    }
  }, [draft]);

  const handleLaunch = async () => {
    if (!parsed) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const session = await createOffering(parsed);
      navigate(`/offerings/${encodeURIComponent(session.address)}`);
    } catch (error: unknown) {
      setFailure(toFriendlyFailure(error));
    } finally {
      setBusy(false);
    }
  };

  const needsWallet = wallet.kind !== 'connected';

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <div>
        <Eyebrow>New offering</Eyebrow>
        <h2 className="mt-3 text-[1.7rem] font-semibold tracking-[-0.02em]">
          Define what is being allocated
        </h2>

        <div className="mt-7 grid gap-5">
          <Field label="Name">
            <input
              className={inputClass}
              value={draft.name}
              onChange={set('name')}
              placeholder="Aurora Energy Systems"
            />
          </Field>

          <Field label="Description">
            <textarea
              className={cx(inputClass, 'min-h-20 resize-y')}
              value={draft.description}
              onChange={set('description')}
              placeholder="What is being offered, and to whom."
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Unit" hint="shares, scholarships, tickets…">
              <input className={inputClass} value={draft.unit} onChange={set('unit')} />
            </Field>
            <Field label="Total supply">
              <input
                className={inputClass}
                inputMode="numeric"
                value={draft.totalSupply}
                onChange={set('totalSupply')}
              />
            </Field>
            <Field label="Simulated price" hint="In simulated dollars. Use 0 if not priced.">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.unitPrice}
                onChange={set('unitPrice')}
              />
            </Field>
            <Field label="Subscription window" hint="Hours until the deadline.">
              <input
                className={inputClass}
                inputMode="numeric"
                value={draft.durationHours}
                onChange={set('durationHours')}
              />
            </Field>
            <Field label="Minimum request">
              <input
                className={inputClass}
                inputMode="numeric"
                value={draft.minRequest}
                onChange={set('minRequest')}
              />
            </Field>
            <Field label="Maximum request" hint="May exceed supply to allow oversubscription.">
              <input
                className={inputClass}
                inputMode="numeric"
                value={draft.maxRequest}
                onChange={set('maxRequest')}
              />
            </Field>
          </div>

          <Field label="Allocation method">
            <div className="rounded-md border border-cream-500/20 bg-ink-900 px-3.5 py-2.5">
              <p className="text-[0.88rem] text-cream-50">Pro rata, floored</p>
              <p className="tnum mt-1 text-[0.75rem] text-cream-600">
                floor(request &times; min(supply, demand) &divide; demand)
              </p>
            </div>
          </Field>
        </div>
      </div>

      <div>
        <Eyebrow>Privacy preview</Eyebrow>
        <h2 className="mt-3 text-[1.7rem] font-semibold tracking-[-0.02em]">
          Exactly what this offering will expose
        </h2>
        <p className="mt-3 text-[0.88rem] leading-relaxed text-cream-300">
          Review this before launching. Once an offering is live, its privacy boundary is fixed by
          the contract, not by configuration.
        </p>

        <div className="mt-6">
          <PrivacyPreview draft={draft} />
        </div>

        {failure ? (
          <div className="mt-6">
            <Callout tone="danger" title={failure.title}>
              {failure.detail}
            </Callout>
          </div>
        ) : null}

        {needsWallet ? (
          <div className="mt-6">
            <Callout
              tone="gold"
              title="Launching an offering needs a wallet"
              action={
                <Button size="sm" variant="secondary" onClick={() => void connect()}>
                  Connect wallet
                </Button>
              }
            >
              Deploying a contract is a real Midnight transaction, so it needs a connected wallet, a
              running proof server and test funds. {mode === 'demo'
                ? 'Demo Mode can show you the participant and verification flows without any of that.'
                : null}
            </Callout>
          </div>
        ) : null}

        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={!parsed || needsWallet}
          loading={busy}
          onClick={() => void handleLaunch()}
        >
          Launch offering
        </Button>
        {!parsed ? (
          <p className="mt-2 text-center text-[0.75rem] text-cream-600">
            Fill in a name, a positive supply, and a valid request range.
          </p>
        ) : null}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */

const IssuerRow = ({ session }: { session: OfferingSession }) => {
  const state = useOfferingState(session);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | undefined>();
  const [failure, setFailure] = useState<FriendlyFailure | undefined>();

  if (!state) return null;

  const run = async (action: 'close' | 'finalize') => {
    setBusy(action);
    setFailure(undefined);
    try {
      if (action === 'close') await session.closeSubscription();
      else await session.finalizeAllocation();
    } catch (error: unknown) {
      setFailure(toFriendlyFailure(error));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="bg-ink-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.1rem] font-semibold text-cream-50">{state.name}</h3>
          <p className="tnum mt-1 text-[0.72rem] text-cream-600">{session.address}</p>
        </div>
        <Pill
          tone={
            state.phase === Phase.OPEN ? 'gold' : state.phase === Phase.FINALIZED ? 'verify' : 'neutral'
          }
        >
          {state.phase === Phase.OPEN
            ? 'Open'
            : state.phase === Phase.FINALIZED
              ? 'Finalized'
              : 'Closed'}
        </Pill>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-5">
        <Stat label="Supply" value={formatQuantity(state.totalSupply)} />
        <Stat label="Participants" value={formatQuantity(state.participantCount)} />
        <Stat label="Aggregate demand" value={formatQuantity(state.totalDemand)} />
        <Stat
          label="Subscription"
          value={state.totalDemand > 0n ? formatMultiple(state.oversubscriptionBps) : '—'}
          accent={state.totalDemand > state.totalSupply}
        />
        <Stat
          label="Allocated"
          value={formatQuantity(state.allocatedTotal)}
          hint={`${formatQuantity(state.totalSupply - state.allocatedTotal)} unallocated`}
        />
      </div>

      <div className="mt-5 rounded-md border border-gold-500/20 bg-gold-500/[0.04] px-4 py-2.5">
        <p className="flex items-center gap-2 text-[0.78rem] text-cream-300">
          <LockIcon className="shrink-0 text-gold-400" />
          You cannot see individual requests for your own offering. That is enforced by the
          contract, not by this screen.
        </p>
      </div>

      {failure ? (
        <div className="mt-4">
          <Callout tone="danger" title={failure.title}>
            {failure.detail}
          </Callout>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={state.phase !== Phase.OPEN}
          loading={busy === 'close'}
          onClick={() => void run('close')}
        >
          Close subscription
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={state.phase !== Phase.CLOSED}
          loading={busy === 'finalize'}
          onClick={() => void run('finalize')}
        >
          Finalize allocation
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/verify/${encodeURIComponent(session.address)}`)}
        >
          Verification status
        </Button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */

export const Issue = () => {
  const { sessions } = useApp();
  const issued = sessions.filter((session) => session.getState().viewer.isIssuer);

  return (
    <Section className="py-14">
      <Eyebrow>Issue</Eyebrow>
      <h1 className="mt-3 text-[2.2rem] font-semibold tracking-[-0.02em] sm:text-[2.6rem]">
        Create a simulated offering
      </h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-cream-300">
        Define a scarce resource, publish the rule that will divide it, and let participants
        subscribe privately. Fictional companies and simulated units only.
      </p>

      <div className="mt-12">
        <CreateForm />
      </div>

      {issued.length > 0 ? (
        <>
          <Divider className="my-14" />
          <Eyebrow>Your offerings</Eyebrow>
          <h2 className="mt-3 text-[1.7rem] font-semibold tracking-[-0.02em]">Issuer dashboard</h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-cream-500/15 bg-cream-500/15">
            {issued.map((session) => (
              <IssuerRow key={session.address} session={session} />
            ))}
          </div>
        </>
      ) : null}
    </Section>
  );
};
