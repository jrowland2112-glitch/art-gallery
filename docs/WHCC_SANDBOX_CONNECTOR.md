# WHCC fulfillment connector

## Current safety status

This code is built but **not deployed, registered, or enabled**. It cannot affect the storefront by merely being merged.

- Test and Live use separate exact hostnames and separate API-key settings.
- `CONNECTOR_ENABLED` defaults to `false`.
- `WHCC_TEST_SUBMIT_ENABLED` and `WHCC_LIVE_SUBMIT_ENABLED` are separate submission switches and default to `false`.
- Live additionally requires an exact Shopify order ID in `WHCC_LIVE_ORDER_IDS`. Full rollout requires the separate `WHCC_LIVE_FULL_ROLLOUT_ENABLED` switch.
- No payment or card data enters this service. Shopify remains the checkout and payment system.
- Secrets belong in the hosting secret manager and local environment only. Never put them in chat, Git, a CSV, or a Wrangler configuration file.

Production-capable code does not authorize deployment or a billable order. WHCC must approve Live access, Joseph must review and approve the exact pull request, and the first Live order must be explicitly allowlisted.

## What it does

1. Shopify sends an `orders/paid` webhook.
2. The worker verifies Shopify's HMAC over the unmodified request body, verifies the store and topic, and deduplicates `X-Shopify-Webhook-Id` in D1.
3. It reads each Shopify variant's `rowland.whcc_mapping` metafield and the product's `rowland.source_object_key` metafield.
4. It confirms the prepared print file exists in the private R2 bucket and gives WHCC a signed seven-day download URL, matching WHCC's reprint-access guidance. The bucket remains private.
5. It builds the configured product in the selected WHCC environment, saves each returned ID before continuing, and polls rather than rebuilding.
6. It calls WHCC `submissions/calculate` and stops if validation fails, the currency is not USD, or the environment-specific total exceeds the configured limit.
7. With submission off, the job stops at `calculated`. Test submission uses its Test-only switch. Live requires its Live switch plus either the exact order allowlist or a separately enabled full rollout. Submission uses a stable idempotency key based on the Shopify order ID.
8. A signed endpoint records WHCC fulfillment events and updates the internal job state. Once the complete WHCC submission reports shipped, the reconciler can create the matching Shopify fulfillment with tracking and notify the customer. This behavior has its own `SHOPIFY_FULFILLMENT_SYNC_ENABLED` switch. Shopify cancellation stops a job that has not been submitted. After submission, cancellation is flagged for immediate WHCC action because WHCC has no hold period.

The worker records status and necessary shipping data in D1. Production retention and deletion rules must be chosen before any future Live launch.

## Files

- `connector/src/worker.mjs`: HTTP and scheduled-worker entry point.
- `connector/src/jobs.mjs`: durable build, poll, calculate, and gated submission flow.
- `connector/src/crypto.mjs`: Shopify, WHCC, and private-image signature verification.
- `connector/migrations/0001_initial.sql`: D1 idempotency and job state.
- `connector/wrangler.example.toml`: safe, disabled deployment template.
- `scripts/whcc-doctor.mjs`: read-only WHCC Test discovery and catalog check.

## Accounts and permissions still needed

Do not create or change these until Joseph approves the account/cost step:

1. A Cloudflare account with one private R2 bucket, one D1 database, and one Worker.
2. The existing Shopify app needs `read_orders`, `read_merchant_managed_fulfillment_orders`, and `write_merchant_managed_fulfillment_orders` in addition to its current product permissions. Releasing a new app version and approving the changed scopes is a Shopify account action.
3. The existing WHCC Test API key is stored as `WHCC_TEST_API_KEY`. A separately approved production deployment uses `WHCC_LIVE_API_KEY`.
4. Five hosting secrets per environment: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, the environment-specific WHCC key, a randomly generated `IMAGE_URL_SIGNING_SECRET`, and that environment's WHCC event-subscription signing secret.

Cloudflare's current limits and pricing must be rechecked immediately before account setup. The connector is designed to fit the free tiers during development, but no promise about future pricing is made.

## Read-only WHCC check

Save the Test key in the Windows user environment or another local secret store; never paste it into chat. Open a new PowerShell window, then run:

```powershell
npm run whcc:doctor
```

This calls only WHCC Test discovery and catalog `GET` endpoints. It writes a non-secret snapshot under `.bulk-upload/`, which Git ignores. It does not build, calculate, submit, or print anything.

The real catalog output must be used to replace the placeholder selection files in `bulk-upload/whcc/`. The values cannot be guessed from product names. Existing Mountain Light and Glade Creek Grist Mill variants also need real `rowland.whcc_mapping` values and private `source_object_key` values before an order is eligible.

## Test deployment sequence (not performed by this pull request)

1. Create R2 and D1 after Joseph approves any account or cost implications. The local importer may use the existing Wrangler login and `ORIGINALS_R2_BUCKET`, avoiding a separate R2 S3 key.
2. Copy `connector/wrangler.example.toml` to the ignored `connector/wrangler.toml`; enter only non-secret resource names and IDs.
3. Apply all migrations under `connector/migrations/` to D1.
4. Add secrets with `wrangler secret put`; never put secret values in files or command history.
5. Deploy with both switches still `false` and verify `/health` reports the WHCC Test origin.
6. Upload a horizontal and vertical full-resolution original to private R2 and write validated Test catalog mappings to Shopify metafields.
7. Add `read_orders`, release the Shopify app version, approve the scope, and create one `ORDERS_PAID` webhook pointing to `/webhooks/shopify/orders-paid`.
8. Enable `CONNECTOR_ENABLED` only. Send a signed fixture or controlled Shopify test order and verify the job stops at `calculated`.
9. Create a disabled WHCC Test event subscription, store its one-time signing secret, send its test event, and verify the signature and deduplication. Enable that subscription only after the test passes.
10. After Joseph reviews the calculation and proof, separately approve turning on `WHCC_TEST_SUBMIT_ENABLED` for one Test submission. WHCC says Test submissions print and bill nothing.

## Live cutover checklist

1. WHCC approves Live API access; Joseph creates the Live key directly in WHCC and stores it only as the `WHCC_LIVE_API_KEY` Cloudflare secret.
2. Merge the reviewed production-readiness pull request. Copy `wrangler.live.example.toml` to an ignored configuration and create a separate Live D1 database.
3. Deploy with `CONNECTOR_ENABLED=false`, `WHCC_LIVE_SUBMIT_ENABLED=false`, `WHCC_LIVE_FULL_ROLLOUT_ENABLED=false`, and an empty allowlist. Verify `/health` reports `environment: live` and no general submission authorization.
4. Register signed Shopify `orders/paid` and `orders/cancelled` webhooks and a disabled WHCC v2 event subscription. Send a WHCC synthetic test event, then enable the event subscription. Keep `SHOPIFY_FULFILLMENT_SYNC_ENABLED=false` until the fulfillment scopes are approved and a synthetic/replayed shipment fixture succeeds.
5. Confirm every active variant has a validated `rowland.whcc_mapping` and every product's private R2 source exists.
6. Disable the native WHCC Shopify app's automatic fulfillment and replace its managed shipping option with the store's equivalent Standard rate. Never leave both submission paths active.
7. Set `CONNECTOR_ENABLED=true` while Live submission remains off. Place the controlled Shopify order and review the WHCC calculation stored in D1.
8. With Joseph's explicit approval of that exact billable order, add only its numeric Shopify order ID to `WHCC_LIVE_ORDER_IDS` and turn on `WHCC_LIVE_SUBMIT_ENABLED`. Keep full rollout off.
9. Verify WHCC accepts the order, the image and selections are correct, and the event webhook is recorded. After it ships, verify Shopify receives the tracking fulfillment and customer notification. Clear the allowlist after the test.
10. Enable `WHCC_LIVE_FULL_ROLLOUT_ENABLED` only after the controlled order succeeds and Joseph explicitly authorizes general activation.

Run `npm run connector:audit` before every cutover. It is read-only and fails unless every active product has a private source key and the complete approved nine-variant mapping. The audit validates the Shopify references; the deployment health check and controlled calculation validate access to the private R2 objects.

## Failure and duplicate behavior

- A duplicate Shopify webhook ID returns success without rebuilding.
- WHCC build has no idempotency key. The connector marks a job `building` before calling it and will not automatically retry an ambiguous build. That deliberately requires reconciliation instead of risking duplicates.
- WHCC submission uses `shopify-order-<order id>` as its permanent idempotency key.
- A missing original, missing mapping, invalid address, invalid calculation, excessive order total, failed image download, or unknown status stops the job.
- A fulfillment file above 40 MB or outside WHCC's JPEG, PNG, and HEIC formats stops before build. Large TIFF masters should remain archived privately, with a full-resolution print-ready JPEG stored as the fulfillment object.
- A Shopify cancellation received before submission stops the job. A cancellation after submission changes the job to `cancellation_requested`; WHCC must be cancelled immediately while it is still eligible.
- The five-minute schedule resumes `pending` and `awaiting_poll` jobs. A `calculated` job resumes only when its environment-specific submission authorization is active. It never retries `building`, `failed`, `submitted`, or cancellation states.

Official references: [WHCC API](https://www.whcc.com/developer/docs/api/), [WHCC Quick Start](https://www.whcc.com/developer/docs/quick-start/), [WHCC event subscriptions](https://www.whcc.com/developer/docs/api/event-subscriptions/), [Shopify webhook verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), and [Shopify webhook subscriptions](https://shopify.dev/docs/apps/build/webhooks/subscribe).
