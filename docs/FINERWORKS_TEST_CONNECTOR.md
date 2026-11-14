# FinerWorks Test connector

This is an isolated Cloudflare Worker for validating the FinerWorks order flow. The reviewed Worker was deployed in a fully disabled state on November 14, 2026. It has no registered Shopify webhooks and does not change the storefront.

## Safety state

- The Worker rejects any environment other than `test`.
- `CONNECTOR_ENABLED`, `FINERWORKS_TEST_SUBMIT_ENABLED`, and status polling default to `false`.
- Every FinerWorks order is overwritten with `test_mode: true`.
- Validation and submission use FinerWorks' documented `xxxx` test payment token.
- Only the nine product codes in `bulk-upload/finerworks/mappings.json` are accepted.
- The FinerWorks mapping is a separate `rowland.finerworks_mapping` variant metafield. WHCC mappings are never interpreted as FinerWorks mappings.
- A D1 compare-and-set claims a validated job before its single submission attempt. An ambiguous response becomes `submission_unknown` and is never retried automatically.
- Test order status is polled from FinerWorks. The provider webhook is authenticated with an unguessable URL token and treated only as a status hint.

## Before a controlled Test deployment

1. Create a separate D1 database and copy `connector/wrangler.finerworks.example.toml` to a local, ignored deployment config containing its ID and Worker URL.
2. Apply `connector/migrations-finerworks` to that database.
3. Add the Shopify client credentials, the FinerWorks web API key, the **Test** app key, an image signing secret, and a distinct status-webhook token as Worker secrets.
4. Dry-run `npm run products:map-finerworks -- --handle <product-handle>` for the controlled products, then explicitly apply with the same arguments plus `--apply`. This writes only `rowland.finerworks_mapping`; it does not remove the existing WHCC metafield.
5. Deploy with all switches off and verify `/health`.
6. Enable the connector only after the existing WHCC Shopify paid-order webhook is removed or disabled. Register only the FinerWorks Test webhook endpoints.
7. Run one expressly approved Test order. First leave submission off to inspect the saved validation/quote. Then enable Test submission for that controlled run.

No FinerWorks Live app key belongs in this Worker. A future Live connector requires a separate review, configuration, database, limits, and owner approval.
