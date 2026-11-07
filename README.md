# Art Gallery

The website for Tristan Rowland's original artwork, where visitors can browse pieces and buy prints.

- **Site files:** `site/` (plain HTML, CSS and JavaScript, deployed by Netlify)
- **Shop:** Shopify Buy Button embeds; Printful prints and ships orders
- **Rules for Claude and developers:** [`CLAUDE.md`](CLAUDE.md), which you must read first
- **Accounts and setup:** [`docs/ACCOUNTS_AND_SETUP.md`](docs/ACCOUNTS_AND_SETUP.md)

## Developer quick start

1. `git clone https://github.com/tjrowland3/art-gallery.git`
2. Open the folder in VS Code and start Claude Code. It reads `CLAUDE.md` automatically.
3. Create a branch: `git checkout -b <yourname>/<change-name>`
4. To preview locally, open `site/index.html` in a browser, or run `npx serve site`.
5. Push your branch and open a pull request. Netlify adds a Deploy Preview link.
6. Wait for Tristan to review and merge. Never push to `main`.
