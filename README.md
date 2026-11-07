# Art Gallery

The website for <OWNER NAME>'s original artwork, where visitors can browse pieces and buy prints.

- **Site files:** `site/` (plain HTML, CSS and JavaScript, hosted on Cloudflare)
- **Shop:** Shopify Buy Button embeds; Printful prints and ships orders
- **Rules for Claude:** [`CLAUDE.md`](CLAUDE.md), which you must read first. It includes the first-time setup steps
- **Accounts and setup:** [`docs/ACCOUNTS_AND_SETUP.md`](docs/ACCOUNTS_AND_SETUP.md)

## Developer quick start

1. Create your own copy: `gh repo create <REPO NAME> --public --template tjrowland3/art-gallery --clone`
2. Open the folder in VS Code and start Claude Code. It reads `CLAUDE.md` automatically.
3. Create a branch: `git checkout -b <change-name>`
4. To preview locally, open `site/index.html` in a browser, or run `npx wrangler dev`.
5. Push your branch and open a pull request. Cloudflare adds a preview link.
6. The owner reviews the preview and merges. Claude never pushes to `main`.
