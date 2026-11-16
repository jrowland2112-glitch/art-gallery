# FinerWorks Live connector readiness

The Live connector uses a separate Cloudflare Worker, D1 database, app key, and deployment configuration from Test. A successful read-only credential check does not enable order submission.

## Required safety state for the initial deployment

- `CONNECTOR_ENABLED=false`
- `FINERWORKS_ENVIRONMENT=live`
- `FINERWORKS_LIVE_SUBMIT_ENABLED=false`
- `FINERWORKS_LIVE_FULL_ROLLOUT_ENABLED=false`
- `FINERWORKS_LIVE_ORDER_IDS` empty
- `FINERWORKS_LIVE_PAYMENT_METHOD` empty
- `FINERWORKS_LIVE_STATUS_POLL_ENABLED=false`
- no Shopify webhooks registered to the Live Worker

Live submission requires the connector, Live submission gate, account-default billing acknowledgement, and either an exact Shopify order-ID allowlist match or a separately approved full rollout. The first Live order must use the exact allowlist; it is real and billable.

The production shipping code is `SD` (Standard). FinerWorks shipping charges vary by product and destination; Joseph observed a $30.40 Standard quote to ZIP 11733 on November 15, 2026. That quote is a planning benchmark, not a universal rate.

## Controlled activation sequence

1. Review and merge the production-readiness pull request.
2. Create a separate `rowland-finerworks-live-state` D1 database and apply `migrations-finerworks`.
3. Copy `wrangler.finerworks.live.example.toml` to an ignored local deployment config and insert the D1 ID and Worker URL.
4. Install the Shopify credentials, FinerWorks web API key, Live app key, asset signing secret, and status-webhook token as Cloudflare secrets.
5. Deploy with every switch off and verify `/health` reports Live, disabled, and no unlisted-order authorization.
6. Do not register Shopify webhooks until the exact controlled Live order is approved.
7. For the first order, set only its numeric Shopify order ID in `FINERWORKS_LIVE_ORDER_IDS`, acknowledge `account_default`, then explicitly enable the connector and Live submit gate.
8. Confirm FinerWorks acceptance and status before considering wider rollout.

No API payment card data is stored or handled. With `account_default`, FinerWorks bills the default payment method already maintained in the account.
