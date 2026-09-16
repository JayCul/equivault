#!/usr/bin/env node
/**
 * Hashes the locally compiled verifier keys into a manifest the UI ships.
 *
 * A reader can then compare the circuits deployed at any offering address
 * against the circuits in this repository, and see for themselves that the
 * offering runs the source they just read.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const keysDir = join(root, 'contract', 'src', 'managed', 'equivault', 'keys');
const outFile = join(root, 'ui', 'src', 'generated', 'circuit-manifest.json');

let entries;
try {
  entries = readdirSync(keysDir);
} catch {
  console.error(`No compiled circuits at ${keysDir}. Run "npm run compact" first.`);
  process.exit(1);
}

const circuits = {};
for (const name of entries.filter((f) => f.endsWith('.verifier')).sort()) {
  const circuit = name.replace(/\.verifier$/, '');
  circuits[circuit] = createHash('sha256').update(readFileSync(join(keysDir, name))).digest('hex');
}

const source = readFileSync(join(root, 'contract', 'src', 'equivault.compact'));
const manifest = {
  generatedFrom: 'contract/src/equivault.compact',
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  circuits,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${Object.keys(circuits).length} circuit fingerprints to ${outFile}`);
