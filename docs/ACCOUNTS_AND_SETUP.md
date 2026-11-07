# Art Gallery Website — Accounts and Setup

**Rule of thumb:** you (the owner) create and own every account. Claude can guide you through each one, but you sign up and enter payment details yourself. Never share these passwords with Claude or anyone else.

**Tip:** create one dedicated email for the business first (for example `<yourname>art@gmail.com`) and use it for every account below. That keeps the business separate from your personal email.

## Accounts

| # | Account | Cost (check current pricing) | What it's for |
|---|---|---|---|
| 1 | **Business email** (Gmail or similar) | Free | Sign-ups and customer emails |
| 2 | **GitHub** | Free (keep the repo public, or get GitHub Pro for a private repo with branch protection) | Stores the website code |
| 3 | **Claude Code** | Your Claude subscription | Builds the site |
| 4 | **Netlify** | Free plan to start | Hosts the website |
| 5 | **Domain** (Cloudflare Registrar, Namecheap, or Porkbun) | About $10–20/year | Your web address |
| 6 | **Shopify** | Starter or Basic plan (confirm the Buy Button is included), plus fees per sale | Cart, checkout, payments, orders |
| 7 | **Printful** (or Prodigi or Gelato), connected to Shopify | Free; you pay per order | Prints and ships the art |

## Setup order

1. **Business email.**
2. **GitHub account,** then ask Claude to run the first-time setup in `CLAUDE.md`.
3. **Netlify:** sign up with GitHub → Add new site → Import from GitHub → pick your repo → production branch `main`. Deploy Previews are on by default.
4. **Domain:** buy it, then connect it in Netlify → Domain management. HTTPS is automatic.
5. **Shopify store:**
   - Add the **Buy Button** sales channel
   - Install **Printful** from the Shopify App Store
   - In Printful, upload your art, pick paper, frame, and size options, and sync them to Shopify
   - Set up payments, shipping, taxes, and your return policy
6. **Buy Button code:** in Shopify → Buy Button channel, create a button for each product and give the generated code to Claude.
7. **Content:** give Claude your artwork image files, titles, descriptions, and About-page text.

## How approving changes works

1. Claude opens a pull request on GitHub and tells you it's ready.
2. Open the **Deploy Preview** link and click around on your phone and computer.
3. Read the report in the pull request description.
4. If it's good, click **Merge pull request**. The live site updates in about a minute.
5. If something breaks, open the merged pull request and click **Revert**, then merge the undo.
