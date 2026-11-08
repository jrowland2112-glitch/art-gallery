# WHCC sandbox connector

## Current safety status

This code is built but **not deployed, registered, or enabled**. It cannot affect the storefront by merely being merged.

- WHCC's Test hostname is a code constant: `https://apis-stage.whcc.com`.
- `CONNECTOR_ENABLED` defaults to `false`.
- `WHCC_SANDBOX_SUBMIT_ENABLED` is a second, independent switch and defaults to `false`.
- There is no WHCC Live hostname or Live-key setting in the connector.
- No payment or card data enters this service. Shopify remains the checkout and payment system.
- Secrets belong in the hosting secret manager and local environment only. Never put them in chat, Git, a CSV, or a Wrangler configuration file.

Enabling WHCC Live later requires a separate `CLAUDE.md` change, pull request, review, and Joseph's explicit approval.

## What it does

1. Shopify sends an `orders/paid` webhook.
2. The worker verifies Shopify's HMAC over the unmodified request body, verifies the store and topic, and deduplicates `X-Shopify-Webhook-Id` in D1.
3. It reads each Shopify variant's `rowland.whcc_mapping` metafield and the product's `rowland.source_object_key` metafield.
4. It confirms the original exists in the private R2 bucket and gives WHCC a signed, short-lived download URL. The bucket remains private.
5. It builds the configured product on WHCC Test, saves each returned ID before continuing, and polls rather than rebuilding.
6. It calls WHCC `submissions/calculate` and stops if validation fails, the currency is not USD, or the sandbox total exceeds the configured limit.
7. With sandbox submission still off, the job stops at `calculated`. With the second switch on, it submits only to WHCC Test using a stable idempotency key based on the Shopify order ID.
8. A separate signed endpoint records WHCC Test fulfillment events. Updating Shopify fulfillment is intentionally deferred until those payloads have been observed and reviewed.

The worker records status and necessary shipping data in D1. Production retention and deletion rules must be chosen before any future Live launch.

## Files

- `connector/src/worker.mjs`: HTTP and scheduled-worker entry point.
- `connector/src/jobs.mjs`: durable build, poll, calculate, and sandbox-submit flow.
- `connector/src/crypto.mjs`: Shopify, WHCC, and private-image signature verification.
- `connector/migrations/0001_initial.sql`: D1 idempotency and job state.
- `connector/wrangler.example.toml`: safe, disabled deployment template.
- `scripts/whcc-doctor.mjs`: read-only WHCC Test discovery and catalog check.

## Accounts and permissions still needed

Do not create or change these until Joseph approves the account/cost step:

1. A Cloudflare account with one private R2 bucket, one D1 database, and one Worker.
2. The existing Shopify app needs `read_orders` in addition to its current product permissions. Releasing a new app version and approving the changed scope is a Shopify account action.
3. The existing WHCC **Test** API key is stored as `WHCC_SANDBOX_API_KEY`. Do not create or use a Live key.
4. Five hosting secrets: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `WHCC_SANDBOX_API_KEY`, a randomly generated `IMAGE_URL_SIGNING_SECRET`, and the WHCC event subscription signing secret.

Cloudflare's current limits and pricing must be rechecked immediately before account setup. The connector is designed to fit the free tiers during development, but no promise about future pricing is made.

## Read-only WHCC check

Save the Test key in the Windows user environment or another local secret store; never paste it into chat. Open a new PowerShell window, then run:

```powershell
npm run whcc:doctor
```

This calls only WHCC Test discovery and catalog `GET` endpoints. It writes a non-secret snapshot under `.bulk-upload/`, which Git ignores. It does not build, calculate, submit, or print anything.

The real catalog output must be used to replace the placeholder selection files in `bulk-upload/whcc/`. The values cannot be guessed from product names. Existing Mountain Light and Glade Creek Grist Mill variants also need real `rowland.whcc_mapping` values and private `source_object_key` values before an order is eligible.

## Deployment sequence (not performed yet)

1. Create R2 and D1 after Joseph approves any account or cost implications.
2. Copy `connector/wrangler.example.toml` to the ignored `connector/wrangler.toml`; enter only non-secret resource names and IDs.
3. Apply `connector/migrations/0001_initial.sql` to D1.
4. Add secrets with `wrangler secret put`; never put secret values in files or command history.
5. Deploy with both switches still `false` and verify `/health` reports the WHCC Test origin.
6. Upload a horizontal and vertical full-resolution original to private R2 and write validated Test catalog mappings to Shopify metafields.
7. Add `read_orders`, release the Shopify app version, approve the scope, and create one `ORDERS_PAID` webhook pointing to `/webhooks/shopify/orders-paid`.
8. Enable `CONNECTOR_ENABLED` only. Send a signed fixture or controlled Shopify test order and verify the job stops at `calculated`.
9. Create a disabled WHCC Test event subscription, store its one-time signing secret, send its test event, and verify the signature and deduplication. Enable that subscription only after the test passes.
10. After Joseph reviews the calculation and proof, separately approve turning on `WHCC_SANDBOX_SUBMIT_ENABLED` for one Test submission. WHCC says Test submissions print and bill nothing.

## Failure and duplicate behavior

- A duplicate Shopify webhook ID returns success without rebuilding.
- WHCC build has no idempotency key. The connector marks a job `building` before calling it and will not automatically retry an ambiguous build. That deliberately requires reconciliation instead of risking duplicates.
- WHCC submission uses `shopify-order-<order id>` as its permanent idempotency key.
- A missing original, missing mapping, invalid address, invalid calculation, excessive sandbox total, failed image download, or unknown status stops the job.
- A fulfillment file above 40 MB or outside WHCC's JPEG, PNG, and HEIC formats stops before build. Large TIFF masters should remain archived privately, with a full-resolution print-ready JPEG stored as the fulfillment object.
- The five-minute schedule resumes only `pending` and `awaiting_poll` jobs. It never retries `building`, `failed`, `calculated`, or `submitted` jobs.

Official references: [WHCC API](https://www.whcc.com/developer/docs/api/), [WHCC Quick Start](https://www.whcc.com/developer/docs/quick-start/), [WHCC event subscriptions](https://www.whcc.com/developer/docs/api/event-subscriptions/), [Shopify webhook verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), and [Shopify webhook subscriptions](https://shopify.dev/docs/apps/build/webhooks/subscribe).
