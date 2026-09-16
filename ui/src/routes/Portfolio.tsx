/**
 * The participant's own view: what they subscribed to, what they hold, and what
 * is still outstanding.
 *
 * Everything on this page is derived locally. The subscription and allocation
 * figures come from the viewer's private state combined with public aggregates,
 * which is precisely the split EquiVault is demonstrating.
 */

import { Link } from 'react-router-dom';
import { Phase } from '@equivault/contract';
import type { EquiVaultDerivedState } from '@equivault/api';
import { useApp, useOfferingState } from '../contexts/AppContext';
import {
  ButtonLink,
  Divider,
  EmptyState,
  Eyebrow,
  LockIcon,
  Pill,
  Section,
  Stat,
} from '../components/ui';
import { formatPercent, formatQuantity, formatSimulatedPrice } from '../lib/format';
import type { OfferingSession } from '../lib/session';

type Holding = {
  readonly session: OfferingSession;
  readonly state: EquiVaultDerivedState;
};

const PositionRow = ({ session }: { session: OfferingSession }) => {
  const state = useOfferingState(session);
  if (!state || !state.viewer.hasSubmitted) return null;

  const { myRequest, myAllocation, projectedAllocation, hasClaimed } = state.viewer;
  const settled = state.phase === Phase.FINALIZED;

  return (
    <Link
      to={
        settled
          ? `/offerings/${encodeURIComponent(session.address)}/results`
          : `/offerings/${encodeURIComponent(session.address)}`
      }
      className="grid gap-5 bg-ink-900 p-6 transition-colors hover:bg-ink-850 sm:grid-cols-[1.4fr_repeat(3,0.9fr)] sm:items-center"
    >
      <div>
        <p className="text-[1.02rem] font-medium text-cream-50">{state.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Pill
            tone={
              hasClaimed ? 'verify' : state.phase === Phase.OPEN ? 'gold' : 'neutral'
            }
          >
            {hasClaimed
              ? 'Claimed'
              : settled
                ? 'Ready to claim'
                : state.phase === Phase.OPEN
                  ? 'Subscription open'
                  : 'Awaiting finalization'}
          </Pill>
        </div>
      </div>

      <div>
        <p className="eyebrow flex items-center gap-1.5">
          <LockIcon className="text-gold-400" /> You requested
        </p>
        <p className="tnum mt-1 text-[1rem] text-cream-100">
          {myRequest !== undefined ? `${formatQuantity(myRequest)} ${state.unit}` : 'Private'}
        </p>
      </div>

      <div>
        <p className="eyebrow">{settled ? 'Allocated' : 'Projected'}</p>
        <p className="tnum mt-1 text-[1rem] text-cream-100">
          {hasClaimed && myAllocation !== undefined
            ? `${formatQuantity(myAllocation)} ${state.unit}`
            : projectedAllocation !== undefined
              ? `≈ ${formatQuantity(projectedAllocation)} ${state.unit}`
              : '—'}
        </p>
      </div>

      <div>
        <p className="eyebrow">Fill rate</p>
        <p className="tnum mt-1 text-[1rem] text-cream-100">
          {myRequest !== undefined && myRequest > 0n
            ? formatPercent(
                (hasClaimed ? myAllocation : projectedAllocation) ?? 0n,
                myRequest,
              )
            : '—'}
        </p>
      </div>
    </Link>
  );
};

export const Portfolio = () => {
  const { sessions } = useApp();

  const holdings: Holding[] = sessions
    .map((session) => ({ session, state: session.getState() }))
    .filter(({ state }) => state.viewer.hasSubmitted);

  const claimed = holdings.filter(({ state }) => state.viewer.hasClaimed);

  const totalUnits = claimed.reduce(
    (sum, { state }) => sum + (state.viewer.myAllocation ?? 0n),
    0n,
  );
  const totalValueCents = claimed.reduce(
    (sum, { state }) => sum + (state.viewer.myAllocation ?? 0n) * state.unitPriceCents,
    0n,
  );

  return (
    <Section className="py-14">
      <Eyebrow>Portfolio</Eyebrow>
      <h1 className="mt-3 text-[2.2rem] font-semibold tracking-[-0.02em] sm:text-[2.6rem]">
        Your positions
      </h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-cream-300">
        Assembled on this device from your private state and public offering data. Nobody else can
        reconstruct this view, including the issuers.
      </p>

      {holdings.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="You have not subscribed to anything yet"
            action={
              <ButtonLink to="/offerings" size="sm" variant="secondary">
                Browse offerings
              </ButtonLink>
            }
          >
            Submit a private request to an open offering and it will appear here.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-8 border-y border-cream-500/15 py-8 lg:grid-cols-4">
            <Stat label="Active subscriptions" value={formatQuantity(holdings.length - claimed.length)} />
            <Stat label="Completed allocations" value={formatQuantity(claimed.length)} />
            <Stat label="Simulated units held" value={formatQuantity(totalUnits)} accent />
            <Stat
              label="Simulated value"
              value={formatSimulatedPrice(totalValueCents)}
              hint="not real money"
            />
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-cream-500/15 bg-cream-500/15">
            {holdings.map(({ session }) => (
              <PositionRow key={session.address} session={session} />
            ))}
          </div>

          <Divider className="my-12" />

          <div className="rounded-lg border border-gold-500/25 bg-gold-500/[0.05] p-6">
            <p className="flex items-center gap-2 text-[0.95rem] font-medium text-cream-50">
              <LockIcon className="text-gold-400" /> Keep this browser profile
            </p>
            <p className="mt-2 max-w-3xl text-[0.85rem] leading-relaxed text-cream-300">
              Your commitment openings live in this browser&rsquo;s local storage. They are what let
              you prove ownership of a committed request at claim time. Clearing site data for
              EquiVault, or switching to a different browser or device, means an allocation can no
              longer be claimed. That is the cost of holding the secret yourself instead of asking a
              custodian to hold it for you.
            </p>
          </div>
        </>
      )}
    </Section>
  );
};
