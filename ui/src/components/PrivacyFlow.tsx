/**
 * The privacy visualization.
 *
 * Shows what leaves the participant's device and what the chain actually sees.
 * The numbers are live: pass a real requested quantity and it will show the
 * genuine boundary for that value, including the fact that the amount stops at
 * the device edge while the commitment and nullifier continue on.
 */

import { useEffect, useState } from 'react';
import { formatQuantity, truncateHex } from '../lib/format';
import { cx, LockIcon, EyeIcon } from './ui';

type Stage = {
  readonly id: string;
  readonly title: string;
  readonly side: 'private' | 'boundary' | 'public';
  readonly value: (amount: bigint, unit: string) => string;
  readonly detail: string;
};

const STAGES: readonly Stage[] = [
  {
    id: 'you',
    title: 'You',
    side: 'private',
    value: () => 'Your device',
    detail:
      'Your secret key and your requested quantity are generated and stored here. Neither is ever transmitted.',
  },
  {
    id: 'request',
    title: 'Your request',
    side: 'private',
    value: (amount, unit) => `${formatQuantity(amount)} ${unit}`,
    detail:
      'The quantity you actually want. This is the value everyone else would normally see in an allocation process.',
  },
  {
    id: 'seal',
    title: 'Sealed commitment',
    side: 'boundary',
    value: () => 'commit(amount, opening)',
    detail:
      'A hiding, binding commitment. It pins your request down so you cannot change it later, while revealing nothing about the amount - not even its rough size.',
  },
  {
    id: 'proof',
    title: 'Zero-knowledge proof',
    side: 'boundary',
    value: () => 'proof(range, uniqueness)',
    detail:
      'A proof that your request is within the published limits and that you have not already subscribed. The proof convinces without disclosing.',
  },
  {
    id: 'ledger',
    title: 'What the chain stores',
    side: 'public',
    value: () => 'commitment + nullifier',
    detail:
      'The ledger records a 32-byte commitment and a one-way nullifier. Neither can be reversed into your quantity or your identity.',
  },
  {
    id: 'allocation',
    title: 'Verifiable allocation',
    side: 'public',
    value: () => 'rule applied, result public',
    detail:
      'Anyone can recompute the allocation rule against the published aggregates and confirm the result - without ever learning a single participant request.',
  },
];

const SIDE_STYLES: Record<Stage['side'], string> = {
  private: 'border-gold-500/40 bg-gold-500/[0.06]',
  boundary: 'border-cream-500/25 bg-ink-800/60',
  public: 'border-verify-400/30 bg-verify-400/[0.05]',
};

export const PrivacyFlow = ({
  amount,
  unit = 'shares',
  autoplay = true,
  className,
}: {
  amount: bigint;
  unit?: string;
  autoplay?: boolean;
  className?: string;
}) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % STAGES.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [autoplay]);

  const stage = STAGES[active]!;

  return (
    <div className={cx('flex flex-col gap-5', className)}>
      <ol className="flex flex-col gap-2">
        {STAGES.map((item, index) => {
          const isActive = index === active;
          const crossesBoundary = item.id === 'ledger';

          return (
            <li key={item.id}>
              {crossesBoundary ? (
                <div className="my-2 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/50 to-gold-500/50" />
                  <span className="eyebrow text-gold-400">Privacy boundary</span>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/50 to-gold-500/50" />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={isActive}
                className={cx(
                  'flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-all duration-300',
                  SIDE_STYLES[item.side],
                  isActive ? 'scale-[1.01] opacity-100' : 'opacity-55 hover:opacity-85',
                )}
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                    item.side === 'public'
                      ? 'border-verify-400/40 text-verify-400'
                      : 'border-gold-500/40 text-gold-400',
                  )}
                >
                  {item.side === 'public' ? <EyeIcon /> : <LockIcon />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[0.82rem] font-medium text-cream-100">{item.title}</span>
                  <span className="tnum block truncate text-[0.78rem] text-cream-500">
                    {item.value(amount, unit)}
                  </span>
                </span>

                {item.side === 'private' ? (
                  <span className="shrink-0 text-[0.68rem] tracking-wide text-gold-400/80 uppercase">
                    stays local
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      <p
        className="min-h-[3.5rem] rounded-md border border-cream-500/15 bg-ink-900/70 px-4 py-3 text-[0.85rem] leading-relaxed text-cream-300"
        aria-live="polite"
      >
        {stage.detail}
      </p>
    </div>
  );
};

/**
 * The compact "what we know vs what we reveal" pairing used on the landing page
 * and on each offering.
 */
export const KnowsRevealsPanel = ({
  requested,
  unit,
  commitment,
  className,
}: {
  requested?: bigint;
  unit: string;
  commitment?: string;
  className?: string;
}) => (
  <div className={cx('grid gap-4 sm:grid-cols-2', className)}>
    <div className="rounded-lg border border-gold-500/30 bg-gold-500/[0.05] p-5">
      <p className="eyebrow flex items-center gap-2 text-gold-400">
        <LockIcon /> Stays private
      </p>
      <ul className="mt-3 space-y-2 text-[0.85rem] text-cream-300">
        <li className="flex items-baseline justify-between gap-3">
          <span>Your requested quantity</span>
          <span className="tnum text-cream-500">
            {requested !== undefined ? `${formatQuantity(requested)} ${unit}` : 'hidden'}
          </span>
        </li>
        <li>Your wallet identity</li>
        <li>Your commitment opening</li>
        <li>Which committed request is yours</li>
      </ul>
    </div>

    <div className="rounded-lg border border-verify-400/25 bg-verify-400/[0.04] p-5">
      <p className="eyebrow flex items-center gap-2 text-verify-400">
        <EyeIcon /> Becomes public
      </p>
      <ul className="mt-3 space-y-2 text-[0.85rem] text-cream-300">
        <li className="flex items-baseline justify-between gap-3">
          <span>A hiding commitment</span>
          <span className="tnum text-cream-500">
            {commitment ? truncateHex(commitment) : '32 bytes'}
          </span>
        </li>
        <li>Aggregate demand across everyone</li>
        <li>The published allocation rule</li>
        <li>The final, checkable result</li>
      </ul>
    </div>
  </div>
);
