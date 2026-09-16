import { useMemo, useState } from 'react';
import { allocationFor, oversubscriptionBps } from '@equivault/contract';
import { EquiVaultMark } from '../components/Logo';
import { KnowsRevealsPanel, PrivacyFlow } from '../components/PrivacyFlow';
import {
  ButtonLink,
  Divider,
  Eyebrow,
  LockIcon,
  Pill,
  Section,
  Stat,
} from '../components/ui';
import { formatMultiple, formatQuantity, formatPercent } from '../lib/format';

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

const Hero = () => (
  <div className="relative overflow-hidden">
    {/* A single, restrained gold wash. No neon, no floating coins. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          'radial-gradient(60rem 30rem at 50% -8rem, rgba(245,166,35,0.13), transparent 62%)',
      }}
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
    />

    <Section className="pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div className="flex flex-col items-center text-center">
        <div className="animate-rise relative mb-8">
          <span className="absolute inset-0 -z-10 rounded-full bg-gold-500/20 blur-2xl" />
          <EquiVaultMark size={76} />
        </div>

        <Pill tone="gold" className="animate-rise mb-6">
          <LockIcon /> Powered by Midnight
        </Pill>

        <h1
          className="animate-rise max-w-3xl text-[2.6rem] leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-6xl"
          style={{ animationDelay: '60ms' }}
        >
          Own your demand.
          <br />
          <span className="text-gradient-gold sheen">Not everyone else&rsquo;s.</span>
        </h1>

        <p
          className="animate-rise mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-cream-300 text-pretty"
          style={{ animationDelay: '120ms' }}
        >
          EquiVault shows how allocation can work when everyone needs to trust the result, but
          nobody needs to see everyone else&rsquo;s private request.
        </p>

        <div
          className="animate-rise mt-10 flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: '180ms' }}
        >
          <ButtonLink to="/offerings" size="lg">
            Enter EquiVault
          </ButtonLink>
          <ButtonLink to="/verify" size="lg" variant="secondary">
            Verify an allocation
          </ButtonLink>
        </div>

        <p className="mt-5 text-[0.78rem] text-cream-600">
          No wallet needed to explore. Demo Mode runs the real circuits locally.
        </p>
      </div>
    </Section>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Problem                                                                    */
/* -------------------------------------------------------------------------- */

const LEAKS = [
  'How much you are willing to invest',
  'Your financial capacity',
  'Your investment strategy',
  'How badly you want in',
];

const Problem = () => (
  <Section className="py-20 sm:py-28">
    <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
      <div>
        <Eyebrow>The problem</Eyebrow>
        <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[2.6rem]">
          Everyone wants fair allocation. Nobody needs everyone else to see their demand.
        </h2>
        <p className="mt-6 text-[0.98rem] leading-relaxed text-cream-300">
          A company offers 100,000 shares. Ten thousand people want in. To prove the split was fair,
          allocation systems traditionally publish who asked for what &mdash; and that single design
          choice leaks far more than a number.
        </p>
      </div>

      <div className="flex flex-col justify-center gap-3">
        {LEAKS.map((leak, index) => (
          <div
            key={leak}
            className="flex items-center gap-4 border-l-2 border-danger-400/40 bg-danger-400/[0.04] py-3 pl-5"
          >
            <span className="tnum text-[0.7rem] text-cream-600">
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <span className="text-[0.92rem] text-cream-100">{leak}</span>
          </div>
        ))}
        <p className="mt-4 text-[0.88rem] text-cream-500">
          Publishing the book is not what makes an allocation fair. Proving the rule was followed is.
        </p>
      </div>
    </div>
  </Section>
);

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    label: 'Private request',
    body: 'You choose a quantity. It is sealed inside a commitment on your own device and never transmitted.',
  },
  {
    label: 'Private computation',
    body: 'A zero-knowledge proof establishes that your request is valid and that you have not subscribed twice, without revealing the amount.',
  },
  {
    label: 'Verifiable allocation',
    body: 'The published rule is applied to public aggregates. Anyone can recompute the outcome and confirm it, with no access to any individual request.',
  },
];

const HowItWorks = () => (
  <Section className="py-20 sm:py-24">
    <Eyebrow>How it works</Eyebrow>
    <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-[2.4rem]">
      Three steps between a private number and a public result.
    </h2>

    <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-cream-500/15 bg-cream-500/15 md:grid-cols-3">
      {STEPS.map((step, index) => (
        <li key={step.label} className="bg-ink-900 p-7">
          <div className="flex items-center gap-3">
            <span className="tnum text-[0.72rem] text-gold-500">
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <span className="h-px flex-1 bg-gold-500/25" />
          </div>
          <h3 className="mt-5 text-[1.05rem] font-semibold text-cream-50">{step.label}</h3>
          <p className="mt-2 text-[0.88rem] leading-relaxed text-cream-300">{step.body}</p>
        </li>
      ))}
    </ol>
  </Section>
);

/* -------------------------------------------------------------------------- */
/* Interactive example                                                        */
/* -------------------------------------------------------------------------- */

/** The seeded book for the worked example, matching the Aurora demo offering. */
const OTHER_DEMAND = 210_000n;
const SUPPLY = 100_000n;

const InteractiveExample = () => {
  const [request, setRequest] = useState(40_000n);

  const { demand, allocation, ratio, fillRate } = useMemo(() => {
    const totalDemand = OTHER_DEMAND + request;
    return {
      demand: totalDemand,
      allocation: allocationFor(request, SUPPLY, totalDemand),
      ratio: oversubscriptionBps(SUPPLY, totalDemand),
      fillRate: formatPercent(allocationFor(request, SUPPLY, totalDemand), request),
    };
  }, [request]);

  return (
    <Section className="py-20 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>Try it</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-[2.4rem]">
            An oversubscribed offering, worked through.
          </h2>
          <p className="mt-5 text-[0.95rem] leading-relaxed text-cream-300">
            Aurora Energy Systems is offering {formatQuantity(SUPPLY)} simulated shares. Other
            participants have privately requested {formatQuantity(OTHER_DEMAND)}. Move the slider to
            set your own request and watch the published rule resolve it.
          </p>

          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <label htmlFor="request" className="eyebrow">
                Your request
              </label>
              <span className="tnum text-lg font-semibold text-gradient-gold">
                {formatQuantity(request)} shares
              </span>
            </div>
            <input
              id="request"
              type="range"
              min={1_000}
              max={150_000}
              step={1_000}
              value={Number(request)}
              onChange={(event) => setRequest(BigInt(event.target.value))}
              className="mt-3 w-full accent-[var(--color-gold-500)]"
            />
            <div className="mt-2 flex justify-between text-[0.72rem] text-cream-600">
              <span>1,000</span>
              <span>150,000</span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 rounded-md border border-gold-500/25 bg-gold-500/[0.05] px-4 py-3">
            <LockIcon className="text-gold-400" />
            <p className="text-[0.82rem] text-cream-300">
              In the real product, this number never leaves your device.
            </p>
          </div>
        </div>

        <div className="surface rounded-lg p-7">
          <div className="grid grid-cols-2 gap-7">
            <Stat label="Shares offered" value={formatQuantity(SUPPLY)} />
            <Stat label="Total demand" value={formatQuantity(demand)} hint="aggregate only" />
            <Stat label="Oversubscribed" value={formatMultiple(ratio)} accent />
            <Stat label="Your fill rate" value={fillRate} />
          </div>

          <Divider className="my-7" />

          <div className="flex flex-col gap-2">
            <Eyebrow>Your allocation</Eyebrow>
            <p className="tnum text-5xl font-bold tracking-tight text-gradient-gold">
              {formatQuantity(allocation)}
            </p>
            <p className="text-[0.82rem] text-cream-500">
              shares &mdash; floor({formatQuantity(request)} &times; {formatQuantity(SUPPLY)} &divide;{' '}
              {formatQuantity(demand)})
            </p>
          </div>

          <Divider className="my-7" />

          <p className="text-[0.82rem] leading-relaxed text-cream-300">
            Every participant receives the same fraction of what they asked for. The rule is
            published in advance, produces one answer, and does not depend on who submitted first.
          </p>
        </div>
      </div>
    </Section>
  );
};

/* -------------------------------------------------------------------------- */
/* Privacy visualization                                                      */
/* -------------------------------------------------------------------------- */

const PrivacySection = () => (
  <Section className="py-20 sm:py-24">
    <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
      <div>
        <Eyebrow>The privacy boundary</Eyebrow>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-[2.4rem]">
          What EquiVault knows versus what EquiVault reveals.
        </h2>
        <p className="mt-5 text-[0.95rem] leading-relaxed text-cream-300">
          Midnight lets a contract hold private inputs and still produce public, checkable outputs.
          EquiVault uses that to move exactly one thing across the boundary: the result.
        </p>
        <KnowsRevealsPanel className="mt-8" requested={40_000n} unit="shares" />
      </div>

      <div className="surface rounded-lg p-6 sm:p-7">
        <PrivacyFlow amount={40_000n} unit="shares" />
      </div>
    </div>
  </Section>
);

/* -------------------------------------------------------------------------- */
/* Use cases                                                                  */
/* -------------------------------------------------------------------------- */

const USE_CASES = [
  {
    title: 'IPO allocation',
    body: 'Oversubscribed offerings settled pro rata, without publishing the order book.',
  },
  {
    title: 'Private procurement',
    body: 'Sealed bids that can be shown to have been scored under the stated rules.',
  },
  {
    title: 'Scholarships',
    body: 'Awards allocated on declared need, without exposing any applicant’s circumstances.',
  },
  {
    title: 'Limited resources',
    body: 'Ticket drops, compute quotas, grant rounds — anything scarce and contested.',
  },
];

const UseCases = () => (
  <Section className="py-20 sm:py-24">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Eyebrow>Beyond equity</Eyebrow>
        <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-[2.4rem]">
          IPO allocation is just the clearest example.
        </h2>
      </div>
      <p className="max-w-sm text-[0.88rem] leading-relaxed text-cream-500">
        The contract underneath allocates <em>units of a scarce resource</em>. Equity is one
        instantiation of it.
      </p>
    </div>

    <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-cream-500/15 bg-cream-500/15 sm:grid-cols-2 lg:grid-cols-4">
      {USE_CASES.map((useCase) => (
        <div key={useCase.title} className="group bg-ink-900 p-6 transition-colors hover:bg-ink-850">
          <div className="h-px w-8 bg-gold-500/50 transition-all duration-300 group-hover:w-14" />
          <h3 className="mt-5 text-[1rem] font-semibold text-cream-50">{useCase.title}</h3>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-cream-300">{useCase.body}</p>
        </div>
      ))}
    </div>
  </Section>
);

/* -------------------------------------------------------------------------- */
/* Technology + CTA                                                           */
/* -------------------------------------------------------------------------- */

const TECH = [
  ['Compact', 'The contract is written in Midnight’s ZK smart contract language.'],
  ['Zero-knowledge proofs', 'Requests are proven valid without being disclosed.'],
  ['Commitments & nullifiers', 'Requests are bound; identities are reduced to one-way tags.'],
  ['Selective disclosure', 'Only the final allocation crosses into public view.'],
];

const Technology = () => (
  <Section className="py-20 sm:py-24">
    <div className="rule rounded-lg border p-8 sm:p-12">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <Eyebrow>Technology</Eyebrow>
          <h2 className="mt-4 text-[1.9rem] font-semibold tracking-[-0.02em] text-balance">
            Built on Midnight.
          </h2>
          <p className="mt-4 text-[0.9rem] leading-relaxed text-cream-300">
            Midnight is a privacy-first blockchain: contracts can verify correctness without
            revealing the sensitive inputs behind it, and disclose only what they choose.
          </p>
        </div>

        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {TECH.map(([term, description]) => (
            <div key={term}>
              <dt className="text-[0.92rem] font-medium text-gold-300">{term}</dt>
              <dd className="mt-1.5 text-[0.85rem] leading-relaxed text-cream-300">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  </Section>
);

const FinalCTA = () => (
  <Section className="pt-10 pb-24">
    <div className="relative overflow-hidden rounded-lg border border-gold-500/25 px-8 py-16 text-center sm:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(40rem 20rem at 50% 120%, rgba(245,166,35,0.16), transparent 70%)',
        }}
      />
      <h2 className="mx-auto max-w-2xl text-[2rem] leading-tight font-bold tracking-[-0.02em] text-balance sm:text-[2.6rem]">
        You should not have to reveal private information to prove a fair decision was made.
      </h2>
      <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink to="/offerings" size="lg">
          Enter EquiVault
        </ButtonLink>
        <ButtonLink to="/issue" size="lg" variant="secondary">
          Create an offering
        </ButtonLink>
      </div>
    </div>
  </Section>
);

export const Landing = () => (
  <>
    <Hero />
    <Problem />
    <HowItWorks />
    <InteractiveExample />
    <PrivacySection />
    <UseCases />
    <Technology />
    <FinalCTA />
  </>
);
