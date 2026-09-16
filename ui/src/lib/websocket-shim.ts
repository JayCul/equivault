/**
 * `isomorphic-ws` resolves to a browser shim whose named `WebSocket` export the
 * bundler cannot statically see, which turns into a build warning and a runtime
 * `undefined`. In a browser there is a perfectly good global, so use it.
 */
const BrowserWebSocket = globalThis.WebSocket;

export { BrowserWebSocket as WebSocket };
export default BrowserWebSocket;
