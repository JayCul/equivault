/**
 * Turns raw failures from the wallet, the proof server, the node and the
 * circuit assertions into something a person can act on.
 *
 * Rule of this module: never surface a stack trace or a contract assertion
 * string to a normal user, and never surface a value that was supposed to stay
 * private. The original error is preserved on `cause` for logs only.
 *
 * @module
 */

export type FailureKind =
  | 'wallet-missing'
  | 'wallet-disconnected'
  | 'wallet-rejected'
  | 'proof-server-unreachable'
  | 'insufficient-funds'
  | 'network-unavailable'
  | 'offering-not-open'
  | 'offering-not-closed'
  | 'offering-not-finalized'
  | 'deadline-passed'
  | 'deadline-not-passed'
  | 'already-subscribed'
  | 'already-claimed'
  | 'not-issuer'
  | 'request-out-of-range'
  | 'not-a-participant'
  | 'no-demand'
  | 'supply-exhausted'
  | 'unknown';

export type FriendlyFailure = {
  readonly kind: FailureKind;
  /** Short, human headline. */
  readonly title: string;
  /** One or two sentences explaining what happened and what to do next. */
  readonly detail: string;
  /** True when retrying the same action might succeed. */
  readonly retryable: boolean;
};

const FAILURES: Record<FailureKind, Omit<FriendlyFailure, 'kind'>> = {
  'wallet-missing': {
    title: 'No Midnight wallet found',
    detail:
      'Install the Lace wallet extension and switch it to a Midnight network, then reload this page.',
    retryable: false,
  },
  'wallet-disconnected': {
    title: 'Wallet disconnected',
    detail: 'Your wallet is no longer connected. Reconnect it to continue.',
    retryable: true,
  },
  'wallet-rejected': {
    title: 'Request declined',
    detail: 'You declined the request in your wallet. Nothing was submitted and nothing changed.',
    retryable: true,
  },
  'proof-server-unreachable': {
    title: 'Proof server unavailable',
    detail:
      'EquiVault could not reach your local proof server, so it could not build the zero-knowledge proof. Start it and try again.',
    retryable: true,
  },
  'insufficient-funds': {
    title: 'Not enough test funds',
    detail:
      'This transaction needs tDUST to pay network fees. Top up from the faucet in your wallet, then try again.',
    retryable: true,
  },
  'network-unavailable': {
    title: 'Network unavailable',
    detail: 'EquiVault could not reach the Midnight network. Check your connection and try again.',
    retryable: true,
  },
  'offering-not-open': {
    title: 'This offering is closed',
    detail: 'The subscription window has ended, so no new requests can be accepted.',
    retryable: false,
  },
  'offering-not-closed': {
    title: 'Offering still open',
    detail: 'An offering has to be closed before its allocation can be finalized.',
    retryable: false,
  },
  'offering-not-finalized': {
    title: 'Allocation not final yet',
    detail: 'The issuer has not finalized this allocation. Allocations can be claimed once they do.',
    retryable: false,
  },
  'deadline-passed': {
    title: 'Subscription deadline passed',
    detail: 'The window for this offering has closed. Your request was not submitted.',
    retryable: false,
  },
  'deadline-not-passed': {
    title: 'Too early to close',
    detail: 'This offering can only be closed by its issuer until the subscription deadline passes.',
    retryable: false,
  },
  'already-subscribed': {
    title: 'You have already subscribed',
    detail: 'Each participant can submit one request per offering. Your original request stands.',
    retryable: false,
  },
  'already-claimed': {
    title: 'Allocation already claimed',
    detail: 'You have already claimed your allocation for this offering.',
    retryable: false,
  },
  'not-issuer': {
    title: 'Only the issuer can do that',
    detail: 'This action is restricted to the account that created the offering.',
    retryable: false,
  },
  'request-out-of-range': {
    title: 'Request outside the allowed range',
    detail: 'Enter a quantity within the minimum and maximum published for this offering.',
    retryable: true,
  },
  'not-a-participant': {
    title: 'No request found for this offering',
    detail:
      'EquiVault could not find a sealed request for you here. Allocations can only be claimed from the browser profile that submitted the request.',
    retryable: false,
  },
  'no-demand': {
    title: 'No requests were received',
    detail: 'This offering closed without any subscriptions, so there is nothing to allocate.',
    retryable: false,
  },
  'supply-exhausted': {
    title: 'Allocation would exceed supply',
    detail: 'This claim was rejected because it would allocate more units than the offering holds.',
    retryable: false,
  },
  unknown: {
    title: 'Something went wrong',
    detail: 'EquiVault could not complete that action. Please try again.',
    retryable: true,
  },
};

/**
 * Ordered patterns. The contract assertion strings are matched first because
 * they are the most specific signal available.
 */
const PATTERNS: ReadonlyArray<readonly [RegExp, FailureKind]> = [
  [/offering is not open/i, 'offering-not-open'],
  [/offering is not closed/i, 'offering-not-closed'],
  [/allocation is not finalized/i, 'offering-not-finalized'],
  [/deadline has passed/i, 'deadline-passed'],
  [/deadline has not passed/i, 'deadline-not-passed'],
  [/already subscribed/i, 'already-subscribed'],
  [/allocation already claimed/i, 'already-claimed'],
  [/not the issuer/i, 'not-issuer'],
  [/below offering minimum|above offering maximum/i, 'request-out-of-range'],
  [/not in the (on-chain )?request set|merkle path does not open|sealed request in private state/i, 'not-a-participant'],
  [/received no demand|zero demand/i, 'no-demand'],
  [/would exceed supply/i, 'supply-exhausted'],
  [/user (rejected|declined)|rejected the request|denied by the user/i, 'wallet-rejected'],
  [/no (midnight )?wallet|lace not found|connector .*not (found|available)/i, 'wallet-missing'],
  [/wallet (is )?(not connected|disconnected)/i, 'wallet-disconnected'],
  [/proof server|prover.*(unreachable|refused)|ECONNREFUSED.*6300/i, 'proof-server-unreachable'],
  [/insufficient (funds|balance)|not enough (tdust|dust|funds)/i, 'insufficient-funds'],
  [/fetch failed|network ?error|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|indexer/i, 'network-unavailable'],
];

const messageOf = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`;
  }
  return typeof error === 'string' ? error : '';
};

/** Classifies an arbitrary thrown value into a user-facing failure. */
export const toFriendlyFailure = (error: unknown): FriendlyFailure => {
  const message = messageOf(error);
  const match = PATTERNS.find(([pattern]) => pattern.test(message));
  const kind: FailureKind = match ? match[1] : 'unknown';
  return { kind, ...FAILURES[kind] };
};

/** The catalogue, for tests and for the error-states documentation. */
export const failureCatalogue = FAILURES;
