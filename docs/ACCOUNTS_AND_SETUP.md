# Art Gallery Website — Accounts and Setup

**Rule of thumb:** you (the owner) create and own every account. Your AI assistant can guide you through each one, but you sign up and enter payment details yourself. Never share these passwords with the AI or anyone else.

**Tip:** create one dedicated email for the business first (for example `<yourname>art@gmail.com`) and use it for every account below. That keeps the business separate from your personal email.

## Accounts

| # | Account | Cost (check current pricing) | What it's for |
|---|---|---|---|
| 1 | **Business email** (Gmail) | Free | Sign-ups and customer emails |
| 2 | **GitHub** | Free (keep the repo public, or get GitHub Pro for a private repo with branch protection) | Stores the website code |
| 3 | **Claude Pro** (Claude Code) or **ChatGPT Plus** (Codex) | About $20/month | The AI that builds the site |
| 4 | **Cloudflare** | Free hosting; domain about $10–20/year at cost | Hosts the website and registers the domain |
| 5 | **Shopify** | Starter about $5/month (confirm the Buy Button is included), plus fees per sale | Cart, checkout, payments, orders |
| 6 | **Printful**, connected to Shopify | Free; you pay per order | Prints and ships the art |

## Setup order

1. **Business email.**
2. **GitHub account,** then ask your AI to run the first-time setup in `CLAUDE.md`.
3. **Cloudflare account:** sign up at cloudflare.com (free).
4. **Connect the site:** Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** (Connect to Git) → authorize GitHub → pick your repo.
   - Production branch: `main`
   - Build command: leave empty
   - Deploy command (if asked): `npx wrangler deploy`
   - The repo's `wrangler.jsonc` already tells Cloudflare to publish the `site/` folder.
   - Turn on preview deployments for non-production branches, so each pull request gets a preview link.
   - Cloudflare's menus change sometimes. If anything looks different, ask your AI to check Cloudflare's current docs.
5. **Domain:** Cloudflare dashboard → **Domain Registration** → **Register Domains** → buy your domain. Then open your site in Workers & Pages → **Settings** → **Domains & Routes** → **Add custom domain**. HTTPS is automatic.
6. **Shopify store:**
   - Add the **Buy Button** sales channel
   - Install **Printful** from the Shopify App Store
   - In Printful, upload your art, pick paper, frame, and size options, and sync them to Shopify
   - Set up payments, shipping, taxes, and your return policy
7. **Buy Button code:** in Shopify → Buy Button channel, create a button for each product and give the generated code to your AI.
8. **Content:** give your AI your artwork image files, titles, descriptions, and About-page text.

## How approving changes works

1. Your AI opens a pull request on GitHub and tells you it's ready.
2. Open the **preview link** Cloudflare posts on the pull request, and click around on your phone and computer.
3. Read the report in the pull request description.
4. If it's good, click **Merge pull request**. The live site updates in about a minute.
5. If something breaks, open the merged pull request and click **Revert**, then merge the undo.
