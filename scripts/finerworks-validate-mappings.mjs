#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createFinerworksClient } from '../connector/src/finerworks.mjs';

const SIZES = Object.freeze([
  { label: '12x18', width: 12, height: 18 },
  { label: '16x24', width: 16, height: 24 },
  { label: '24x36', width: 24, height: 36 },
]);

export function proposedBuilds() {
  return SIZES.flatMap(({ label, width, height }) => [
    {
      finish: 'Framed',
      size: label,
      build: {
        PrintProductTypeID: 5,
        MediaID: 7,
        MountingID: 8,
        Units: 0,
        PrintW: width,
        PrintH: height,
        SheetW: width,
        SheetH: height,
        FrameID: 96,
        FrameW: width + 5,
        FrameH: height + 5,
        MatID: 1,
        Mat1WindowW: width,
        Mat1WindowH: height,
        MatID2: 1,
        Mat2WindowW: width + 2.5,
        Mat2WindowH: height + 2.5,
        GlassID: 1,
        ColorCorrect: false,
      },
    },
    {
      finish: 'Metal',
      size: label,
      build: {
        PrintProductTypeID: 14,
        MediaID: 130,
        MountingID: 68,
        Units: 0,
        PrintW: width,
        PrintH: height,
        ColorCorrect: false,
      },
    },
    {
      finish: 'Gallery Wrap',
      size: label,
      build: {
        PrintProductTypeID: 1,
        MediaID: 46,
        MountingID: 29,
        CanvasAddOns: [1],
        Units: 0,
        PrintW: width,
        PrintH: height,
        ColorCorrect: false,
      },
    },
  ]);
}

function priceFor(prices, productCode) {
  return (prices || []).find((item) => String(item.product_code || item.product_sku).toLowerCase() === productCode.toLowerCase());
}

export async function validateFinerworksMappings({ env = process.env, fetchImpl = fetch, output = console } = {}) {
  const client = createFinerworksClient({
    webApiKey: env.FINERWORKS_WEB_API_KEY,
    appKey: env.FINERWORKS_APP_KEY,
    fetchImpl,
  });
  const results = [];
  for (const proposed of proposedBuilds()) {
    output.log(`Building FinerWorks Test code: ${proposed.finish} ${proposed.size}`);
    const response = await client.buildProductCode(proposed.build);
    const productCode = response?.product_code;
    if (!productCode || response?.status?.success === false || response?.details?.valid === false) {
      throw new Error(`${proposed.finish} ${proposed.size} was rejected: ${response?.status?.message || 'no product code returned'}`);
    }
    results.push({ ...proposed, productCode, details: response.details || null });
    output.log(`  Valid product code: ${productCode}`);
  }

  const productCodes = results.map((item) => item.productCode);
  const validationResponse = await client.validateProducts(productCodes);
  for (const result of results) {
    const validation = (validationResponse?.product_validations || [])
      .find((item) => String(item.product_code).toLowerCase() === result.productCode.toLowerCase());
    if (validation?.valid !== true) {
      throw new Error(`${result.finish} ${result.size} failed product validation: ${validation?.validation_message || 'missing validation result'}`);
    }
    result.validation = validation;
  }

  const pricingResponse = await client.prices(productCodes);
  for (const result of results) {
    const price = priceFor(pricingResponse?.prices, result.productCode);
    if (!price || !(Number(price.total_price) > 0) || price.info) {
      throw new Error(`${result.finish} ${result.size} did not return valid pricing: ${price?.info || 'missing price'}`);
    }
    result.price = price;
    output.log(`  ${result.finish} ${result.size}: $${Number(price.total_price).toFixed(2)}`);
  }

  const destination = path.resolve('.bulk-upload', 'finerworks-mapping-validation.json');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify({
    validatedAt: new Date().toISOString(),
    environment: 'FinerWorks Test; no order submitted',
    results,
  }, null, 2)}\n`, 'utf8');
  output.log(`Validated and priced ${results.length} FinerWorks product codes. No order was submitted.`);
  output.log(`Non-secret validation report: ${destination}`);
  return results;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  validateFinerworksMappings().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
