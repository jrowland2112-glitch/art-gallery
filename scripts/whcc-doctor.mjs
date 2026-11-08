#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createWhccSandboxClient } from '../connector/src/whcc.mjs';

export async function inspectWhccSandbox({ env = process.env, fetchImpl = fetch, output = console } = {}) {
  const client = createWhccSandboxClient({ apiKey: env.WHCC_SANDBOX_API_KEY, fetchImpl });
  const discovery = await client.discovery();
  const catalogProducts = [];
  let cursor;
  do {
    const page = await client.catalog(cursor);
    catalogProducts.push(...(page?.products || []));
    cursor = page?.nextCursor;
  } while (cursor);
  const products = catalogProducts.filter((product) => product.completion === 'api');
  const wallArt = products.filter((product) => /frame|metal|gallery|wrap/i.test(`${product.ref} ${product.name}`));
  const details = [];
  for (const product of wallArt) details.push(await client.product(product.ref));

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    environment: 'WHCC Test',
    discovery,
    products: details,
  };
  const destination = path.resolve('.bulk-upload', 'whcc-sandbox-catalog.json');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  output.log('WHCC Test connection succeeded.');
  output.log(`API-completable products: ${products.length}`);
  for (const product of wallArt) output.log(`  ${product.ref}: ${product.name}`);
  output.log(`Non-secret catalog snapshot: ${destination}`);
  return snapshot;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  inspectWhccSandbox().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
