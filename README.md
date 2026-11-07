# Gallery — Shopify theme

A custom Shopify theme for selling fine art and photography prints, with a blog, an About page, and a contact page. Everything visitors see can be edited in the Shopify theme editor, with no code needed.

- **Rules for AI assistants:** [`CLAUDE.md`](CLAUDE.md) (Codex reads [`AGENTS.md`](AGENTS.md), which points to it)
- **Guide 1, accounts and setup:** [`docs/ACCOUNTS_AND_SETUP.md`](docs/ACCOUNTS_AND_SETUP.md)
- **Guide 2, AI assistant setup and starter prompt:** [`docs/AI_SETUP.md`](docs/AI_SETUP.md)
- **Guide 3, transferring the store and code to the owner:** [`docs/HANDOFF.md`](docs/HANDOFF.md)
- **Editing the site without code:** [`docs/EDITING_GUIDE.md`](docs/EDITING_GUIDE.md)

## Developer quick start

1. Install [Shopify CLI](https://shopify.dev/docs/api/shopify-cli): `npm install -g @shopify/cli`
2. Clone this repo and open it in VS Code.
3. Live local preview: `shopify theme dev --store <store>.myshopify.com`
4. Check for errors: `shopify theme check`
5. Share a preview: `shopify theme push --unpublished --theme "Preview: <change>"`
6. Open a pull request. Only the owner merges and publishes.

Built on Shopify's [Skeleton theme](https://github.com/Shopify/skeleton-theme). See `LICENSE-SHOPIFY-SKELETON.md`.
