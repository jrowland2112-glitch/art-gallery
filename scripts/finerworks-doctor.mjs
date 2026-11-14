#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createFinerworksClient } from '../connector/src/finerworks.mjs';

function matchingFrames(collections) {
  return (collections || []).flatMap((collection) => (collection.frames || []).map((frame) => ({
    collectionId: collection.id,
    collectionName: collection.name,
    ...frame,
  }))).filter((frame) => /alto black\s*-\s*thin/i.test(frame.name || ''));
}

export async function inspectFinerworksTest({ env = process.env, fetchImpl = fetch, output = console } = {}) {
  const client = createFinerworksClient({
    webApiKey: env.FINERWORKS_WEB_API_KEY,
    appKey: env.FINERWORKS_APP_KEY,
    fetchImpl,
  });

  const credentials = await client.testCredentials();
  if (credentials?.status?.success !== true) throw new Error('FinerWorks did not accept the supplied credentials.');
  const [collectionsResponse, matsResponse, glazingResponse, productTypesResponse] = await Promise.all([
    client.frameCollections(),
    client.mats(),
    client.glazing(),
    client.productTypes(),
  ]);
  const collectionIndex = collectionsResponse?.collections || [];
  const collections = [];
  for (const collection of collectionIndex) {
    const details = await client.frameCollections({ id: collection.id });
    const returned = (details?.collections || []).find((item) => item.id === collection.id);
    collections.push(returned || collection);
  }
  const mats = matsResponse?.mats || [];
  const glazing = glazingResponse?.glazing || [];
  const productTypes = Array.isArray(productTypesResponse) ? productTypesResponse : productTypesResponse?.product_types || [];
  const mediaIds = [...new Set(productTypes.flatMap((item) => item.media_ids || []))];
  const mediaTypesResponse = await client.mediaTypes(mediaIds);
  const mediaTypes = Array.isArray(mediaTypesResponse) ? mediaTypesResponse : mediaTypesResponse?.media_types || [];
  const styleIds = [...new Set(mediaTypes.flatMap((item) => item.style_ids || []))];
  const styleTypesResponse = await client.styleTypes(styleIds);
  const styleTypes = Array.isArray(styleTypesResponse) ? styleTypesResponse : styleTypesResponse?.style_types || [];
  const frameMatches = matchingFrames(collections);
  const matMatches = mats.filter((mat) => /snow white/i.test(`${mat.name} ${mat.color}`));
  const glazingMatches = glazing.filter((item) => /clear|acrylic/i.test(`${item.name} ${item.description}`));

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    environment: 'FinerWorks test credentials; discovery calls only',
    credentialsAccepted: true,
    catalog: { collections, mats, glazing, productTypes, mediaTypes, styleTypes },
    requestedConfigurationMatches: { frames: frameMatches, mats: matMatches, glazing: glazingMatches },
  };
  const destination = path.resolve('.bulk-upload', 'finerworks-test-catalog.json');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  output.log('FinerWorks credentials accepted.');
  output.log('Only read-only catalog endpoints were called; no product or order was created.');
  output.log(`Frame collections: ${collections.length}; matching Alto Black - Thin frames: ${frameMatches.length}`);
  for (const frame of frameMatches) output.log(`  Frame ${frame.id}: ${frame.name} (${frame.collectionName})`);
  output.log(`Snow White mat matches: ${matMatches.length}`);
  for (const mat of matMatches) output.log(`  Mat ${mat.id}: ${mat.name}; core ${mat.core_color || 'not specified'}`);
  output.log(`Clear/acrylic glazing matches: ${glazingMatches.length}`);
  for (const item of glazingMatches) output.log(`  Glazing ${item.id}: ${item.name}`);
  output.log(`Product types: ${productTypes.length}; media: ${mediaTypes.length}; mounting styles: ${styleTypes.length}`);
  output.log(`Non-secret catalog snapshot: ${destination}`);
  return snapshot;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  inspectFinerworksTest().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
