/**
 * The live backend: a real offering, deployed on Midnight.
 *
 * Wraps `EquiVaultAPI` in the same `OfferingSession` interface Demo Mode
 * implements, so every screen works identically against either one.
 *
 * @module
 */

import {
  EquiVaultAPI,
  type CreateOfferingParams,
  type EquiVaultDerivedState,
  type EquiVaultProviders,
} from '@equivault/api';
import type { Subscription } from 'rxjs';
import {
  LIVE_CAPABILITIES,
  type OfferingSession,
  StateStore,
} from './session';

export class LiveOfferingSession implements OfferingSession {
  readonly mode = 'live' as const;
  readonly capabilities = LIVE_CAPABILITIES;
  readonly address: string;

  private readonly store: StateStore<EquiVaultDerivedState>;
  private readonly subscription: Subscription;

  private constructor(
    private readonly api: EquiVaultAPI,
    initial: EquiVaultDerivedState,
  ) {
    this.address = api.contractAddress;
    this.store = new StateStore(initial);
    this.subscription = api.state$.subscribe({
      next: (state) => this.store.set(state),
    });
  }

  /** Resolves once the first state snapshot has arrived from the indexer. */
  private static async fromApi(api: EquiVaultAPI): Promise<LiveOfferingSession> {
    const initial = await new Promise<EquiVaultDerivedState>((resolve, reject) => {
      const sub = api.state$.subscribe({
        next: (state) => {
          resolve(state);
          sub.unsubscribe();
        },
        error: reject,
      });
    });
    return new LiveOfferingSession(api, initial);
  }

  static async deploy(
    providers: EquiVaultProviders,
    params: CreateOfferingParams,
  ): Promise<LiveOfferingSession> {
    return LiveOfferingSession.fromApi(await EquiVaultAPI.deploy(providers, params));
  }

  static async join(
    providers: EquiVaultProviders,
    contractAddress: string,
  ): Promise<LiveOfferingSession> {
    return LiveOfferingSession.fromApi(await EquiVaultAPI.join(providers, contractAddress));
  }

  getState(): EquiVaultDerivedState {
    return this.store.get();
  }

  subscribe(listener: (state: EquiVaultDerivedState) => void): () => void {
    return this.store.subscribe(listener);
  }

  submitRequest(amount: bigint): Promise<void> {
    return this.api.submitRequest(amount);
  }

  closeSubscription(): Promise<void> {
    return this.api.closeSubscription();
  }

  finalizeAllocation(): Promise<void> {
    return this.api.finalizeAllocation();
  }

  claimAllocation(): Promise<bigint> {
    return this.api.claimAllocation();
  }

  dispose(): void {
    this.subscription.unsubscribe();
  }
}
