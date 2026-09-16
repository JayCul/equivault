/**
 * Real wallet and provider wiring for Midnight.
 *
 * Nothing in this file is simulated. It discovers an injected Midnight wallet
 * (Lace), connects to it, and assembles the provider set the Midnight SDK needs
 * to build, prove, balance and submit transactions.
 *
 * The private state provider is backed by IndexedDB rather than memory on
 * purpose: a participant's commitment opening is what lets them claim their
 * allocation later. Losing it on a page reload would mean losing the claim.
 *
 * @module
 */

import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import type { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  Binding,
  type FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import type { EquiVaultCircuitKeys, EquiVaultProviders } from '@equivault/api';
import type { EquiVaultPrivateState } from '@equivault/contract';
import { passwordProviderFor } from './privateStorage';

/** The connector API major version this build speaks. */
const COMPATIBLE_CONNECTOR_API_VERSION = 4;

export type WalletInfo = {
  readonly name: string;
  readonly icon: string;
  readonly rdns: string;
  readonly apiVersion: string;
};

export type ConnectedWallet = {
  readonly info: WalletInfo;
  readonly api: ConnectedAPI;
  readonly shieldedAddress: string;
};

const majorVersion = (version: string): number => Number.parseInt(version.split('.')[0] ?? '', 10);

/** All injected wallets that speak a compatible connector version. */
export const discoverWallets = (): InitialAPI[] => {
  const injected = (window as { midnight?: Record<string, unknown> }).midnight;
  if (!injected) {
    return [];
  }
  return Object.values(injected).filter((candidate): candidate is InitialAPI => {
    if (!candidate || typeof candidate !== 'object') return false;
    const wallet = candidate as Partial<InitialAPI>;
    return (
      typeof wallet.apiVersion === 'string' &&
      typeof wallet.connect === 'function' &&
      majorVersion(wallet.apiVersion) === COMPATIBLE_CONNECTOR_API_VERSION
    );
  });
};

/**
 * Waits briefly for a wallet extension to inject itself, then connects.
 *
 * Extensions inject asynchronously, so a single synchronous check on page load
 * produces a spurious "no wallet found".
 */
export const connectWallet = async (
  networkId: NetworkId,
  timeoutMs = 3_000,
): Promise<ConnectedWallet> => {
  const deadline = Date.now() + timeoutMs;
  let wallets = discoverWallets();

  while (wallets.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    wallets = discoverWallets();
  }

  const wallet = wallets[0];
  if (!wallet) {
    throw new Error(
      'No Midnight wallet found. Install the Lace extension and reload this page.',
    );
  }

  const api = await wallet.connect(networkId);
  const { shieldedAddress } = await api.getShieldedAddresses();

  return {
    info: {
      name: wallet.name,
      icon: wallet.icon,
      rdns: wallet.rdns,
      apiVersion: wallet.apiVersion,
    },
    api,
    shieldedAddress,
  };
};

/**
 * Assembles the Midnight provider set from a connected wallet.
 *
 * The ZK configuration (prover keys and circuit IR) is served from this app's
 * own origin, so proving happens against the exact artifacts this build was
 * compiled with.
 */
export const buildProviders = async (wallet: ConnectedWallet): Promise<EquiVaultProviders> => {
  const config = await wallet.api.getConfiguration();

  if (!config.proverServerUri) {
    throw new Error(
      'Your wallet has no proof server configured. Set it to http://localhost:6300 in the wallet settings.',
    );
  }

  const zkConfigProvider = new FetchZkConfigProvider<EquiVaultCircuitKeys>(
    window.location.origin,
    fetch.bind(window),
  );

  const shieldedAddresses = await wallet.api.getShieldedAddresses();

  // Scoped per wallet account so two accounts in one browser stay separate.
  const accountId = shieldedAddresses.shieldedCoinPublicKey;

  return {
    // IndexedDB-backed and encrypted at rest, so the commitment opening
    // survives a reload. See `privateStorage.ts` for exactly what the
    // encryption does and does not protect against.
    privateStateProvider: levelPrivateStateProvider<'equiVaultPrivateState', EquiVaultPrivateState>({
      privateStateStoreName: 'equivault-private-state',
      accountId,
      privateStoragePasswordProvider: passwordProviderFor(accountId),
    }),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const balanced = await wallet.api.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          'signature',
          'proof',
          'binding',
          fromHex(balanced.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await wallet.api.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  } as EquiVaultProviders;
};
