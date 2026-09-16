/**
 * The single source of truth for which Midnight network this app targets.
 *
 * `setNetworkId` is Midnight SDK global mutable state (see
 * `@midnight-ntwrk/midnight-js-network-id`) that MUST be set before any
 * wallet or contract operation - `deployContract`, `findDeployedContract`,
 * and address encoding/parsing all call `getNetworkId()` internally and throw
 * if it was never set. Setting it as a side effect of importing this module
 * means every other module can just import `NETWORK_ID` and be guaranteed the
 * SDK is already configured, rather than relying on call order.
 */
import { setNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID ?? 'preprod') as NetworkId;

setNetworkId(NETWORK_ID);
