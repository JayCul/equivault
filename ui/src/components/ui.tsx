/**
 * Shared primitives. Deliberately few: strong typography and whitespace do most
 * of the work, so there is no card component that wraps every stray fact.
 */

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

// --- buttons ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-gold-500 to-gold-400 text-ink-950 hover:from-gold-400 hover:to-gold-300 hover:shadow-[0_0_28px_-8px_rgba(245,166,35,0.6)] active:translate-y-px',
  secondary:
    'border border-cream-500/25 bg-ink-800/60 text-cream-100 hover:border-gold-500/50 hover:bg-ink-700/70',
  ghost: 'text-cream-300 hover:bg-ink-800/70 hover:text-cream-50',
  danger: 'border border-danger-400/35 bg-danger-400/10 text-danger-400 hover:bg-danger-400/20',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[0.8rem]',
  md: 'h-10 px-4 text-[0.875rem]',
  lg: 'h-12 px-6 text-[0.95rem]',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
  >
    {loading ? <Spinner /> : null}
    {children}
  </button>
);

export const ButtonLink = ({
  to,
  variant = 'primary',
  size = 'md',
  children,
  className,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}) => (
  <Link
    to={to}
    className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
  >
    {children}
  </Link>
);

export const Spinner = ({ className }: { className?: string }) => (
  <svg
    className={cx('h-4 w-4 animate-spin', className)}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// --- form controls -----------------------------------------------------------

/**
 * A styled native `<select>`. Used anywhere the set of valid values is closed
 * (a unit, a duration preset, an allocation method) rather than free text -
 * closed choices cannot be mistyped and never need a validation message.
 */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: ReadonlyArray<{ value: string; label: string }>;
};

export const Select = ({ options, className, ...rest }: SelectProps) => (
  <div className="relative">
    <select
      {...rest}
      className={cx(
        'tnum w-full appearance-none rounded-md border border-cream-500/20 bg-ink-900 px-3.5 py-2.5 pr-9 text-[0.9rem] text-cream-50 outline-none transition-colors focus:border-gold-500/60',
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <svg
      className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-cream-500"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

/**
 * Restricts typed input to digits only (plus an optional leading `-`), so a
 * quantity field cannot hold letters or symbols at all - not just on submit,
 * but as the character is typed. Pair with a `NumericField` error message for
 * range checks that must happen after parsing (e.g. "must be positive").
 */
export const sanitizeDigits = (raw: string): string => raw.replace(/[^0-9]/g, '');

/** Same idea, allowing one decimal point - for prices and other fractional inputs. */
export const sanitizeDecimal = (raw: string): string => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

// --- layout ----------------------------------------------------------------

export const Section = ({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLElement>) => (
  <section {...rest} className={cx('mx-auto w-full max-w-6xl px-5 sm:px-8', className)}>
    {children}
  </section>
);

export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cx('eyebrow', className)}>{children}</p>
);

export const Surface = ({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) => (
  <div {...rest} className={cx('surface rounded-lg', className)}>
    {children}
  </div>
);

// --- data display ----------------------------------------------------------

/**
 * A single figure with its label. Used instead of a card so a page of numbers
 * reads like a term sheet rather than a dashboard.
 */
export const Stat = ({
  label,
  value,
  hint,
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
  className?: string;
}) => (
  <div className={cx('flex flex-col gap-1', className)}>
    <span className="eyebrow">{label}</span>
    <span
      className={cx(
        'tnum text-2xl font-semibold tracking-tight sm:text-[1.75rem]',
        accent ? 'text-gradient-gold' : 'text-cream-50',
      )}
    >
      {value}
    </span>
    {hint ? <span className="text-[0.8rem] text-cream-500">{hint}</span> : null}
  </div>
);

export const Divider = ({ className }: { className?: string }) => (
  <hr className={cx('rule border-t', className)} />
);

// --- status ----------------------------------------------------------------

export type PillTone = 'neutral' | 'gold' | 'verify' | 'warn' | 'danger';

const PILL_TONES: Record<PillTone, string> = {
  neutral: 'border-cream-500/25 text-cream-300',
  gold: 'border-gold-500/40 text-gold-300 bg-gold-500/8',
  verify: 'border-verify-400/35 text-verify-400 bg-verify-400/8',
  warn: 'border-warn-400/35 text-warn-400 bg-warn-400/8',
  danger: 'border-danger-400/35 text-danger-400 bg-danger-400/8',
};

export const Pill = ({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium tracking-wide',
      PILL_TONES[tone],
      className,
    )}
  >
    {children}
  </span>
);

/**
 * The private/public marker used throughout the product. It exists so a reader
 * can tell, at a glance, which side of the privacy boundary a value sits on.
 */
export const Visibility = ({ kind }: { kind: 'private' | 'public' }) =>
  kind === 'private' ? (
    <Pill tone="gold">
      <LockIcon /> Private
    </Pill>
  ) : (
    <Pill tone="neutral">
      <EyeIcon /> Public
    </Pill>
  );

export const LockIcon = ({ className }: { className?: string }) => (
  <svg
    className={cx('h-3 w-3', className)}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </svg>
);

export const EyeIcon = ({ className }: { className?: string }) => (
  <svg
    className={cx('h-3 w-3', className)}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4Z" />
    <circle cx="8" cy="8" r="1.8" />
  </svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={cx('h-4 w-4', className)}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m3 8.5 3.5 3.5L13 5" />
  </svg>
);

export const CrossIcon = ({ className }: { className?: string }) => (
  <svg
    className={cx('h-4 w-4', className)}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
);

// --- feedback --------------------------------------------------------------

export const Callout = ({
  tone = 'neutral',
  title,
  children,
  action,
}: {
  tone?: PillTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) => {
  const border: Record<PillTone, string> = {
    neutral: 'border-cream-500/20',
    gold: 'border-gold-500/35',
    verify: 'border-verify-400/30',
    warn: 'border-warn-400/35',
    danger: 'border-danger-400/35',
  };
  return (
    <div className={cx('rounded-lg border bg-ink-850/60 p-4', border[tone])} role="status">
      <p className="text-[0.9rem] font-semibold text-cream-50">{title}</p>
      {children ? <div className="mt-1 text-[0.85rem] text-cream-300">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
};

export const EmptyState = ({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="rule flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
    <p className="text-[1.05rem] font-medium text-cream-100">{title}</p>
    {children ? <p className="max-w-md text-[0.875rem] text-cream-500">{children}</p> : null}
    {action}
  </div>
);
