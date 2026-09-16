/**
 * Application state: which backend is active, wallet connection, and the set of
 * offerings currently loaded.
 *
 * @module
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { toFriendlyFailure, type CreateOfferingParams, type FriendlyFailure, type EquiVaultProviders } from '@equivault/api';
import { DemoWorld, type DemoOfferingSession } from '../lib/demo';
import { LiveOfferingSession } from '../lib/live';
import type { OfferingSession } from '../lib/session';
import { buildProviders, connectWallet, type ConnectedWallet } from '../lib/wallet';
import { NETWORK_ID } from '../lib/network';
import { listKnownOfferings, rememberOffering } from '../lib/offeringRegistry';

export type Mode = 'demo' | 'live';

export type WalletStatus =
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'connected'; readonly wallet: ConnectedWallet }
  | { readonly kind: 'failed'; readonly failure: FriendlyFailure };

type AppState = {
  readonly mode: Mode;
  readonly setMode: (mode: Mode) => void;

  readonly networkId: typeof NETWORK_ID;

  readonly wallet: WalletStatus;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;

  /** Offerings to show in the browse view. */
  readonly sessions: readonly OfferingSession[];
  readonly loading: boolean;
  /** True while previously created/joined live offerings are being reconnected after a wallet connect. */
  readonly restoringSessions: boolean;
  readonly loadError?: FriendlyFailure;

  readonly getSession: (address: string) => OfferingSession | undefined;
  readonly joinOffering: (address: string) => Promise<OfferingSession>;
  readonly createOffering: (params: CreateOfferingParams) => Promise<OfferingSession>;
  readonly resetDemo: () => Promise<void>;
};

const AppContext = createContext<AppState | undefined>(undefined);

const envMode = (): Mode =>
  (import.meta.env.VITE_DEMO_MODE ?? 'true') === 'false' ? 'live' : 'demo';

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<Mode>(envMode);
  const [wallet, setWallet] = useState<WalletStatus>({ kind: 'disconnected' });
  const [providers, setProviders] = useState<EquiVaultProviders | undefined>();
  const [demoSessions, setDemoSessions] = useState<readonly DemoOfferingSession[]>([]);
  const [liveSessions, setLiveSessions] = useState<readonly OfferingSession[]>([]);
  const [restoringSessions, setRestoringSessions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<FriendlyFailure | undefined>();

  // Demo offerings are built once and reused across the whole app.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    DemoWorld.load()
      .then((world) => {
        if (!cancelled) {
          setDemoSessions(world.sessions);
          setLoadError(undefined);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(toFriendlyFailure(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setWallet({ kind: 'connecting' });
    try {
      const connected = await connectWallet(NETWORK_ID);
      const built = await buildProviders(connected);
      setProviders(built);
      setWallet({ kind: 'connected', wallet: connected });
      setMode('live');

      // Reconnect every offering this browser has previously created or
      // joined on this network. Without this, an offering becomes invisible
      // in the UI the moment the tab reloads, even though it is still live on
      // chain - only its address (remembered in localStorage) survives a
      // reload, so it has to be re-fetched through the real providers.
      const knownAddresses = listKnownOfferings(NETWORK_ID);
      if (knownAddresses.length > 0) {
        setRestoringSessions(true);
        const results = await Promise.allSettled(
          knownAddresses.map((address) => LiveOfferingSession.join(built, address)),
        );
        const restored = results
          .filter((result): result is PromiseFulfilledResult<LiveOfferingSession> => result.status === 'fulfilled')
          .map((result) => result.value);
        setLiveSessions((current) => {
          const existing = new Set(current.map((session) => session.address));
          return [...current, ...restored.filter((session) => !existing.has(session.address))];
        });
        setRestoringSessions(false);
      }
    } catch (error: unknown) {
      setWallet({ kind: 'failed', failure: toFriendlyFailure(error) });
    }
  }, []);

  const disconnect = useCallback(() => {
    setProviders(undefined);
    setWallet({ kind: 'disconnected' });
    setLiveSessions([]);
    setRestoringSessions(false);
    setMode('demo');
  }, []);

  const sessions = mode === 'demo' ? demoSessions : liveSessions;

  const getSession = useCallback(
    (address: string): OfferingSession | undefined =>
      [...demoSessions, ...liveSessions].find((session) => session.address === address),
    [demoSessions, liveSessions],
  );

  const requireProviders = useCallback((): EquiVaultProviders => {
    if (!providers) {
      throw new Error('Wallet is not connected');
    }
    return providers;
  }, [providers]);

  const joinOffering = useCallback(
    async (address: string): Promise<OfferingSession> => {
      const existing = getSession(address);
      if (existing) return existing;

      const session = await LiveOfferingSession.join(requireProviders(), address);
      setLiveSessions((current) => [...current, session]);
      rememberOffering(NETWORK_ID, session.address);
      return session;
    },
    [getSession, requireProviders],
  );

  const createOffering = useCallback(
    async (params: CreateOfferingParams): Promise<OfferingSession> => {
      const session = await LiveOfferingSession.deploy(requireProviders(), params);
      setLiveSessions((current) => [...current, session]);
      rememberOffering(NETWORK_ID, session.address);
      return session;
    },
    [requireProviders],
  );

  const resetDemo = useCallback(async () => {
    setLoading(true);
    try {
      const world = await DemoWorld.reset();
      setDemoSessions(world.sessions);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AppState>(
    () => ({
      mode,
      setMode,
      networkId: NETWORK_ID,
      wallet,
      connect,
      disconnect,
      sessions,
      loading,
      restoringSessions,
      loadError,
      getSession,
      joinOffering,
      createOffering,
      resetDemo,
    }),
    [
      mode,
      wallet,
      connect,
      disconnect,
      sessions,
      loading,
      restoringSessions,
      loadError,
      getSession,
      joinOffering,
      createOffering,
      resetDemo,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppState => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside <AppProvider>');
  }
  return context;
};

/** Subscribes to one offering's derived state. */
export const useOfferingState = (session: OfferingSession | undefined) => {
  const [state, setState] = useState(() => session?.getState());

  useEffect(() => {
    if (!session) {
      setState(undefined);
      return;
    }
    return session.subscribe(setState);
  }, [session]);

  return state;
};
