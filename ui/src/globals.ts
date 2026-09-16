/**
 * Browser shims required by the Midnight SDK.
 *
 * Several SDK dependencies assume a Node-ish global environment. These two
 * shims are the minimum needed; they are imported before anything else.
 */
import { Buffer } from 'buffer';

// Some third-party libraries branch on `process.env.NODE_ENV` in the browser.
// @ts-expect-error - deliberately minimal process shim.
globalThis.process ??= { env: { NODE_ENV: import.meta.env.MODE } };

globalThis.Buffer ??= Buffer;
