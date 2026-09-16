#!/usr/bin/env node
/**
 * Copies the compiled prover keys and circuit IR next to the UI, so
 * `FetchZkConfigProvider` can load them from the app's own origin. This is what
 * makes the browser prove against the exact artifacts this build compiled.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const managed = join(root, 'contract', 'src', 'managed', 'equivault');
const target = join(root, 'ui', 'public');

if (!existsSync(managed)) {
  console.error('No compiled circuits found. Run "npm run compact" first.');
  process.exit(1);
}

for (const folder of ['keys', 'zkir']) {
  const from = join(managed, folder);
  const to = join(target, folder);
  if (!existsSync(from)) continue;
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`Copied ${folder} -> ui/public/${folder}`);
}
