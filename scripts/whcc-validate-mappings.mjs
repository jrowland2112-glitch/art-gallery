#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { readPriceSheet } from './lib/catalog.mjs';
import { createWhccSandboxClient } from '../connector/src/whcc.mjs';

const TEST_IMAGE = 'https://whcc-platform-test-assets.s3.us-east-2.amazonaws.com/0dd4751480afa9ec95e01c04acdd376f_2509_3357.jpg';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function verifySummary(mapping, summary) {
  const descriptions = Object.fromEntries((summary || []).map((entry) => [entry.id, String(entry.description || '')]));
  const builtSize = descriptions.size?.replaceAll('×', 'x').replaceAll(' ', '');
  if (builtSize !== mapping.size) throw new Error(`${mapping.finish} ${mapping.size} built as ${descriptions.size || 'an unknown size'}.`);
  const expected = mapping.finish === 'Framed'
    ? { moulding: /black/i, mat: /2/, mat_color: /white/i, acrylic: /standard/i }
    : mapping.finish === 'Metal'
      ? { surface: /white high gloss/i, display_options: /float mount/i }
      : { canvas_type: /premium fine art/i, depth: /1 1\/2|1½/i, protection: /semi-gloss/i };
  const combined = Object.values(descriptions).join(' | ');
  for (const [id, pattern] of Object.entries(expected)) {
    const value = descriptions[id] || (id === 'mat_color' ? combined : '');
    if (!pattern.test(value)) {
      throw new Error(`${mapping.finish} ${mapping.size} did not preserve the requested ${id} selection.`);
    }
  }
}

export async function validateMappings({
  prices = path.resolve('bulk-upload', 'prices.standard.csv'),
  env = process.env,
  fetchImpl = fetch,
  output = console,
} = {}) {
  const mappings = await readPriceSheet(prices);
  const client = createWhccSandboxClient({ apiKey: env.WHCC_TEST_API_KEY || env.WHCC_SANDBOX_API_KEY, fetchImpl });
  const results = [];

  for (const mapping of mappings) {
    output.log(`Building WHCC Test preview: ${mapping.finish} ${mapping.size}`);
    const built = await client.build([{
      productId: mapping.whccProductRef,
      selections: { ...mapping.whccSelections, quantity: 1 },
      images: [{ url: TEST_IMAGE }],
    }]);
    const builtItem = built?.items?.[0];
    const configuredProductId = builtItem?.configuredProductId;
    if (!configuredProductId) throw new Error(`WHCC did not return an ID for ${mapping.finish} ${mapping.size}.`);

    let item;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (attempt > 0) await wait(Math.min(5000 + attempt * 1000, 15000));
      const poll = await client.poll([configuredProductId]);
      item = poll?.items?.find((entry) => entry.configuredProductId === configuredProductId);
      if (!item) throw new Error(`WHCC omitted ${configuredProductId} while validating ${mapping.finish} ${mapping.size}.`);
      if (item.status !== 'processing') break;
    }
    if (item?.status !== 'ready') {
      throw new Error(`${mapping.finish} ${mapping.size} ended with WHCC Test status ${item?.status || 'unknown'}.`);
    }
    output.log(`  WHCC selections: ${(builtItem.selectionsSummary || []).map((entry) => `${entry.id}=${entry.description}`).join('; ')}`);
    verifySummary(mapping, builtItem.selectionsSummary);
    results.push({
      finish: mapping.finish,
      size: mapping.size,
      productRef: mapping.whccProductRef,
      configuredProductId,
      status: item.status,
      selectionsSummary: builtItem.selectionsSummary || [],
      placementProof: builtItem.links?.placementProof || null,
    });
    output.log(`  Ready: ${configuredProductId}`);
  }

  const destination = path.resolve('.bulk-upload', 'whcc-mapping-validation.json');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify({ validatedAt: new Date().toISOString(), environment: 'WHCC Test', results }, null, 2)}\n`, 'utf8');
  output.log(`Validated ${results.length} mappings. No order was submitted.`);
  output.log(`Non-secret validation report: ${destination}`);
  return results;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  validateMappings().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
