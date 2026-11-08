# Bulk photo upload and WHCC fulfillment plan

Status: **research and design only**. This document does not create products, upload photographs, add a backend, or submit an order.

## Goal

Joseph should be able to place full-resolution photographs in one folder, maintain one reusable price sheet, and run one command. The command will validate the files, store the originals safely, make optimized storefront images, and create **Draft** Shopify products with `Finish` and `Size` options. A later order connector will send paid orders to WHCC without setting up each photograph in the WHCC app.

The proposed commands are illustrative until the implementation is approved:

```powershell
npm run photos:check -- --folder .\incoming --prices .\prices.csv
npm run photos:upload -- --folder .\incoming --prices .\prices.csv --draft
```

The first command never writes to Shopify or WHCC. The second will be deliberately limited to Draft Shopify products in the first implementation.

## Research conclusions

### Which WHCC API is available

WHCC now recommends its current **WHCC API** for new integrations. It uses a Test host at `https://apis-stage.whcc.com/api`, a Live host at `https://apis.whcc.com/api`, bearer API keys, and the version header `WHCC-API-Version: 2026-10`. The older Editor API and Order Submit API remain supported for existing integrations but are not recommended for new work.

The statement “I have WHCC API access” is not enough to prove which credential was issued. No credential or account record exists in this repository, and checking the actual key requires a local authenticated request. We will identify it safely before implementation:

1. Joseph checks the label under WHCC **Connected Accounts → API access**. A current `Test` key is the expected credential.
2. A future local `photos:doctor` command reads `WHCC_SANDBOX_API_KEY` from the local environment and calls `GET /v1/discovery` on the Test host.
3. The command prints only the environment, granted scope names, and permitted method/path pairs. It never prints or saves the key.
4. It confirms access to catalog, configured-product, calculate, submission, fulfillment, and event-subscription routes.
5. If discovery returns `403`, or the account has only legacy credentials, contact `integrations@whcc.com` for current API access rather than starting a new legacy integration.

WHCC enables Test API access for every account and permits up to 10 Test keys and 10 Live keys. Live access has a separate approval process. WHCC currently requires at least one Test-key order submission and a recent paid order in the account before Live access is approved.

Relevant WHCC documentation:

- [Current API reference and discovery](https://www.whcc.com/developer/docs/api/)
- [Quick Start](https://www.whcc.com/developer/docs/quick-start/)
- [API key security](https://www.whcc.com/developer/docs/api/api-key-security/)
- [Frequently asked questions and Live-access requirements](https://www.whcc.com/developer/docs/faq/)
- [Legacy APIs](https://www.whcc.com/developer/docs/legacy/order-submit-api/)

### What WHCC can automate

The WHCC catalog is the source of truth. Each product returned by `GET /v1/catalog/products` has a `completion` value:

- `api`: the connector can configure, price, and order the product without opening the WHCC editor.
- `editor`: a person must finish it in the WHCC editor, so it cannot meet the “no per-photo work” requirement.

WHCC specifically lists Metal Prints, Framed Prints, and Gallery Wraps among the single-image wall-art products supported through the current API. We must still use the catalog references and configuration IDs returned to Joseph's account rather than hard-coding names. The API flow is:

1. Discover the key's routes.
2. Read the current catalog and product configuration fields.
3. Build a configured product with a short-lived image URL and catalog selection IDs.
4. Poll until the configured product is ready.
5. Call `submissions/calculate` to validate selections, address, shipping, and current WHCC cost without placing an order.
6. On the Test host only, submit with an idempotency key.
7. Receive fulfillment changes through WHCC event subscriptions rather than continually polling.

A Live submission has no hold-for-review step: it is a real, immediately billable order. That is why Live submission remains disabled until Joseph separately approves it.

### How Shopify products should be created

Use the versioned Shopify **GraphQL Admin API**, not the legacy REST product endpoints. For each photograph, `productSet` can create or synchronize the product, its two options, variants, prices, media, SKUs, and metafields. `productVariantsBulkCreate` is available when only variants need to be added. Shopify documents both operations for external catalog synchronization and bulk product work.

For the expected early catalog size, direct asynchronous `productSet` calls with controlled concurrency will be simpler and give clearer per-photo errors. If a run grows to hundreds or thousands of photographs, the same normalized records can be written as JSONL and sent through `stagedUploadsCreate` plus `bulkOperationRunMutation`.

Every new product will initially have:

- status `DRAFT` and no sales-channel publication;
- option 1 named `Finish` (`Framed`, `Metal`, `Gallery Wrap`);
- option 2 named `Size` (for example `12x18`, `16x24`, `24x36`);
- one variant for each allowed finish/size row in the price sheet;
- the retail price from the price sheet and a deterministic SKU;
- an optimized display image and useful alt text;
- private fulfillment metadata that maps the product and variant to the original file and WHCC configuration IDs.

The first implementation should use normal GraphQL mutations, then switch to Shopify's asynchronous bulk-import mechanism only when measurements show it is needed. This keeps errors understandable while preserving a path to large imports.

Relevant Shopify documentation:

- [`productSet` for external catalog synchronization](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productSet)
- [`productVariantsBulkCreate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productVariantsBulkCreate)
- [GraphQL bulk imports with JSONL](https://shopify.dev/docs/apps/build/apis/graphql-admin/bulk-operations/imports)
- [`stagedUploadsCreate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate)
- [Shopify app authentication](https://shopify.dev/docs/apps/build/authentication-authorization)

## Where the photographs should live

Do **not** use Shopify product media as the archive or fulfillment source. Shopify should receive a color-managed, web-sized derivative for fast storefront display. WHCC should receive the full-resolution original from private object storage.

Recommended storage: a private Cloudflare R2 bucket, with bucket versioning enabled if available for the chosen account. R2 is a good fit because it is S3-compatible, has no Internet egress fee, and can issue short-lived signed URLs. An AWS S3 or Backblaze B2 private bucket can be substituted without changing the architecture.

Each source file is stored once under an immutable key such as:

```text
originals/<sha256>/<normalized-filename>.jpg
```

The system records the object key, SHA-256 checksum, pixel dimensions, color profile, and upload timestamp. It does not store a public permanent URL. The order connector creates a short-lived signed read URL only when building a WHCC configured product. Shopify receives a separate derivative, for example sRGB JPEG at a maximum 2400–3000 pixels on the long edge.

This makes the local drop folder an inbox, not the only copy. Automatic fulfillment cannot reliably depend on Joseph's computer being powered on when an order arrives.

## Proposed input format

One reusable `prices.csv` applies to every photograph in the folder:

```csv
finish,size,retail_price,whcc_product_ref,whcc_selections_file,enabled
Framed,12x18,225.00,framed-print,whcc/framed-12x18.json,true
Metal,12x18,200.00,metal-print,whcc/metal-12x18.json,true
Gallery Wrap,12x18,195.00,gallery-wrap,whcc/gallery-wrap-12x18.json,true
```

The `whcc_selections_file` contains non-secret catalog selection IDs discovered from WHCC, such as surface, size, frame moulding, and mounting choices. These configuration files may be committed because they contain product choices, not credentials. The validator will reject a selection that no longer appears in the current WHCC catalog.

Photo titles are derived from filenames (`Glade_Creek_Grist_Mill.jpg` becomes “Glade Creek Grist Mill”). Optional non-secret overrides can live in `photos.csv`:

```csv
filename,title,alt_text,tags,description
Glade_Creek_Grist_Mill.jpg,Glade Creek Grist Mill,Glade Creek Grist Mill in autumn,"West Virginia,Autumn",Is a photograph worth a 20-hour drive?
```

If `photos.csv` is absent, safe defaults are used. This keeps the normal workflow to a folder plus the reusable price sheet while allowing better descriptions when desired.

## End-to-end design

```text
Full-resolution folder + prices.csv
                |
                v
        Local validation / dry run
        - file type, dimensions, profile
        - aspect ratio and print resolution
        - price and WHCC catalog mapping
                |
         explicit upload command
                |
       +--------+----------------+
       |                         |
       v                         v
Private original storage   Shopify display derivative
       |                         |
       |                 Draft product + variants
       |                 + fulfillment metafields
       |                         |
       +-----------+-------------+
                   |
             paid Shopify order
                   |
         server-side connector (later)
                   |
        WHCC Test: build -> calculate -> submit
                   |
       WHCC events -> Shopify fulfillment status
```

### Product creator (phase 2A, after plan approval)

The local command will:

1. Read the folder, prices, optional photo metadata, and cached WHCC catalog.
2. Validate JPEG/TIFF support, dimensions, aspect ratio, effective DPI, embedded profile, duplicate filenames, retail prices, and every WHCC selection.
3. Produce a dry-run report and require a separate write command.
4. Upload originals to private storage and create storefront derivatives.
5. Create or update Draft products by a stable external ID, never by title alone.
6. Set `Finish` and `Size` variants and retail prices.
7. Store only non-secret fulfillment mappings in Shopify metafields.
8. Save a local, gitignored run manifest so retries resume safely rather than duplicate products.
9. Print links to the Draft products for Joseph's review. It will not activate or publish them.

Proposed metafields include:

| Level | Key | Purpose |
|---|---|---|
| Product | `rowland.source_object_key` | Private original's object key, not a URL |
| Product | `rowland.source_sha256` | Detect replacement or corruption |
| Product | `rowland.source_dimensions` | Validate print resolution later |
| Variant | `rowland.whcc_product_ref` | WHCC catalog product reference |
| Variant | `rowland.whcc_selections` | Selected non-secret WHCC configuration IDs |
| Variant | `rowland.mapping_version` | Makes catalog migrations auditable |

### Order connector (phase 2B, separate approval required)

This is a small backend and conflicts with the current `CLAUDE.md` rule that the project has no custom backend. **Before any connector code, hosting, account setup, or rule change, Joseph must explicitly approve changing that rule.** The rule change and connector will use a separate pull request.

After approval, the connector will:

1. Receive Shopify `ORDERS_PAID` webhooks over HTTPS.
2. Verify Shopify's HMAC signature and deduplicate `X-Shopify-Webhook-Id` before doing work.
3. Read the ordered variant's WHCC mapping and the product's private object key.
4. Create a short-lived signed image URL.
5. Build WHCC configured products using current catalog IDs.
6. Call WHCC calculate and compare the result with guardrails before submission.
7. Submit only to the WHCC Test host while `WHCC_MODE=test`.
8. Use a deterministic idempotency key based on Shopify order and line-item IDs.
9. Store the WHCC submission ID and state without storing credentials or permanent image URLs.
10. Receive WHCC fulfillment events and update Shopify fulfillment/tracking only after that later behavior is separately reviewed.

The first connector release will have two independent safety controls: the WHCC hostname must equal the Test hostname, and `WHCC_LIVE_SUBMIT_ENABLED` must remain false. Merely adding a production key will not enable Live ordering.

## Accounts, permissions, and secrets Joseph will create

Joseph creates and owns each account or credential. No password, access token, private key, or secret is pasted into chat or committed to Git.

| Item | When needed | Minimum access / use | Storage |
|---|---|---|---|
| WHCC Test API key | Product mapping and all testing | Current WHCC API on the Test host | Local OS credential store, then hosting secret manager |
| WHCC Live API key | Only after sandbox acceptance and explicit go-live approval | Current WHCC API on Live | Production secret manager only |
| Shopify app | Phase 2A | `write_products`; add `read_orders` and webhook access only for phase 2B | Shopify-managed installation; app secret in secret manager |
| Shopify client ID and secret | Phase 2 | Server-to-server client-credentials flow for Joseph's store | Environment/secret manager; never theme code |
| Private object-storage bucket | Phase 2A | Read/write only to the originals bucket | Storage-scoped token in local/hosting secret manager |
| Backend hosting account | Phase 2B, after approval | HTTPS endpoint, secrets, logs, durable idempotency state | Provider account owned by Joseph |

Use separate Test and Live environments, credentials, storage prefixes, and deployment variables. A `.env.example` may list variable **names only**. Actual `.env` files stay gitignored and untracked.

## Rough cost

These are planning estimates, not purchase authorization. Check current pricing before Joseph creates or upgrades anything.

| Component | Expected small-shop cost | Notes |
|---|---:|---|
| Shopify Admin API | No separate per-call fee | Uses Joseph's existing Shopify plan; normal API and plan limits apply. |
| WHCC Test API | $0 for test submissions | WHCC states that Test orders produce nothing and bill nothing. |
| WHCC Live | Product + shipping + applicable tax per order | No separate API fee is published in the reviewed docs; confirm with WHCC before launch. |
| Cloudflare R2 originals | Often $0 initially; then about $0.015/GB-month | Current Standard tier includes 10 GB-month and operation allowances, with no egress charge. At 100 MB per original, 100 photos are about 10 GB. |
| Small connector hosting | Likely $0–$10/month at low volume | Cloudflare Workers has a free request tier; a paid plan or durable database may be needed as volume/reliability requirements grow. |
| Domain/email | No new cost from this project | Existing site services remain unchanged. |

Official current storage pricing: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/). Hosting pricing: [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

No paid account, plan, storage, or service will be created without Joseph's prior approval.

## Testing without printing or billing a real order

Testing proceeds in gates. A later gate cannot silently enable the next one.

### Gate 1: read-only checks

- Run `photos:doctor` with a WHCC Test key and print only redacted discovery results.
- Read the Test catalog and confirm that the chosen framed, metal, and gallery-wrap products are `completion: "api"`.
- Validate selection IDs and image requirements.
- Run the local product import in dry-run mode with no network writes.

### Gate 2: Shopify Draft products

- Create two Draft products: one horizontal and one vertical photograph.
- Confirm titles, images, Finish/Size combinations, prices, SKUs, metafields, and duplicate-safe reruns.
- Confirm the products are not published to any sales channel.
- Delete/recreate only the test Drafts if rollback testing is needed; never alter active products.

### Gate 3: WHCC Test build and calculate

- Use fixture orders and short-lived URLs for the two test originals.
- Build configured products on `apis-stage.whcc.com`.
- Poll previews and verify crop, bleed, orientation, effective resolution, and selected finish/size.
- Run `submissions/calculate`; compare WHCC cost and shipping with expected guardrails.
- Do not submit yet.

### Gate 4: WHCC Test submission

- Submit one Test order with a Test key and deterministic idempotency key.
- Replay the same Shopify webhook and prove no second submission is created.
- Test multiple line items, a failed image, an invalid address, cancellation, and delayed events.
- Confirm WHCC states that nothing is printed or billed in Test.

### Gate 5: controlled Shopify end-to-end test

- Keep the Shopify products as Drafts or on a non-public test path.
- Exercise the connector with a signed test payload first.
- A Shopify test payment or payment-setting change requires Joseph's separate approval before it is attempted.

### Gate 6: Live readiness review

Live remains disabled until Joseph reviews logs, mappings, sample previews, error handling, cost guardrails, cancellation behavior, and a written go-live checklist, then explicitly says to enable WHCC Live. A first real order should use a low-cost test product shipped to Joseph and requires a separate approval because it costs money and prints a real item.

## Safety and operating controls

- **Draft by default:** importer cannot create Active products in its first release.
- **Test by default:** connector refuses the Live WHCC hostname unless a separately reviewed configuration enables it.
- **Idempotency:** stable photo IDs prevent duplicate products; stable order keys prevent duplicate WHCC submissions.
- **Cost guardrail:** stop if WHCC's calculated wholesale total differs from the configured expected range.
- **Resolution guardrail:** stop a line item whose effective DPI, crop, or aspect ratio is unsafe for the selected size.
- **Catalog guardrail:** refresh and validate WHCC IDs; never map by display names alone.
- **Secret isolation:** no credentials in the theme, browser, repository, command output, screenshots, or logs.
- **Private originals:** permanent public image URLs are prohibited; signed URLs expire quickly.
- **Audit trail:** record source checksum, mapping version, Shopify IDs, webhook ID, WHCC submission ID, and timestamps.
- **Manual recovery:** failed orders enter an actionable error state and never loop into repeated submissions.
- **Kill switch:** one configuration flag stops all WHCC submissions without taking the storefront offline.

## Principal risks

| Risk | Mitigation |
|---|---|
| A WHCC product requires the editor | Offer only catalog items marked `completion: "api"`; fail validation otherwise. |
| Wrong crop, bleed, color, or resolution | Validate pixels/profile/aspect before upload and inspect WHCC Test previews for horizontal and vertical samples. |
| Duplicate billable order | Verify webhook IDs, use durable processing state, and send WHCC's required idempotency key. |
| Test credentials accidentally point to Live | Separate secrets and deployments; hard-block the Live host until an explicit reviewed release. |
| WHCC catalog selections change | Cache for reporting but revalidate against the catalog; version mappings and stop safely on mismatch. |
| Wholesale cost changes | Calculate immediately before submission and enforce absolute/percentage guardrails. |
| Original is lost or replaced | Immutable object keys, SHA-256 checksums, private storage, versioning, and a separate backup policy. |
| Signed URL leaks | Short expiry, random object keys, no URL logging, and private bucket policy. |
| Webhooks arrive twice or out of order | HMAC verification, delivery deduplication, idempotent state transitions, and event timestamps. |
| Customer edits/cancels after payment | Define a short processing policy and cancellation workflow before Live; WHCC Live has no hold-for-review step. |
| Backend outage | Durable queue/retry state, monitoring, and a manual resend tool that preserves idempotency. |
| Shopify/WHCC account compromise | Least-privilege scopes, secret manager, rotation procedure, and separate Test/Live credentials. |

## Delivery sequence and approval gates

1. **This PR:** research and plan only.
2. **After Joseph approves this plan:** build the local validator and Draft-only bulk product creator. No connector and no Active products.
3. **After Draft importer acceptance:** ask Joseph explicitly for permission to change the “no custom backend” rule in `CLAUDE.md`.
4. **Only after that permission:** build the connector against Shopify test inputs and the WHCC Test host.
5. **After sandbox acceptance:** prepare a separate Live-readiness plan and pull request. Do not enable Live submission until Joseph explicitly says to go live.

## Decisions to make before implementation

The recommended defaults are shown in parentheses:

1. Private original storage provider (**Cloudflare R2**).
2. Initial universal finishes and sizes (**Framed, Metal, Gallery Wrap; 12x18, 16x24, 24x36**, subject to WHCC catalog validation).
3. Whether the reusable price sheet is global for all photos (**yes**, with optional per-photo overrides later).
4. Storefront derivative policy (**sRGB JPEG, maximum 3000 px long edge, no watermark**).
5. Whether TIFF originals are accepted or converted locally (**accept JPEG first; add TIFF only after testing**).
6. Connector hosting and durable state provider (**decide only after backend permission**).

## Definition of success

- A folder containing horizontal and vertical originals passes a read-only validation command.
- One approved write command creates correctly priced Shopify Draft products with exactly `Finish` and `Size` options.
- Rerunning the same command creates no duplicates.
- Full-resolution files remain private and storefront pages use optimized derivatives.
- A paid-order fixture produces correctly configured WHCC Test products and one idempotent Test submission.
- No manual WHCC editor step is needed for supported `completion: "api"` products.
- No real WHCC order is submitted until Joseph explicitly approves Live operation.
