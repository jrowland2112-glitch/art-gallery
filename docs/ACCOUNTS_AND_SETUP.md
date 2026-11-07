# Art Gallery Website — Accounts and Setup

**Rule of thumb:** Tristan owns every account. The developer is invited into the ones he needs and never holds the master login. If he leaves, you remove his access and lose nothing.

**Tip:** create one dedicated email for the business first (for example `<galleryname>art@gmail.com`) and use it for every account below. That keeps the business separate from your personal email and easy to hand off or sell later.

## Accounts

| # | Account | Cost (check current pricing) | Who creates it | What the developer gets |
|---|---|---|---|---|
| 1 | **Business email** (Gmail or similar) | Free | Tristan | Nothing |
| 2 | **Domain** (Cloudflare Registrar, Namecheap, or Porkbun) | About $10–20/year | Tristan | Nothing |
| 3 | **GitHub** repo `tjrowland3/art-gallery` | Free if the repo is public; GitHub Pro (about $4/month) if private | Tristan | **Collaborator** (write access, but he can't merge to `main` once protection is on) |
| 4 | **Netlify** site connected to the repo | Free plan is fine to start | Tristan | Nothing. He sees Deploy Preview links on his pull requests |
| 5 | **Shopify** store | Starter or Basic plan (confirm the Buy Button is included), plus fees per sale | Tristan | Optional **staff account** limited to "Sales channels" so he can generate Buy Button code. Or you generate the code and send it to him |
| 6 | **Printful** (or Prodigi or Gelato), connected to Shopify | Free; you pay per order | Tristan | Nothing |
| 7 | **Claude** (Claude Code) | His own subscription | Developer | N/A, he uses his own |

He doesn't need any of your passwords. If his Claude ever asks for one, that's a red flag.

## Why the GitHub repo should be public (or on Pro)

GitHub only enforces "nobody merges to `main` without Tristan's approval" on **public repos or paid plans**. The site has no secrets in its code, so public is fine and free. If you want it private, upgrade to GitHub Pro.

## Setup order (Tristan)

1. **Create the business email.**
2. **Buy the domain.**
3. **Create the GitHub repo** `art-gallery` under `tjrowland3`. Add a `README.md` so `main` exists, and add the `CLAUDE.md` file to the repo root.
4. **Protect `main`:** repo → Settings → Branches (or Rules → Rulesets) → add a rule for `main`:
   - Require a pull request before merging
   - Require 1 approval
   - Require review from Code Owners
   - Block force pushes and deletions
5. **Add a CODEOWNERS file** at `.github/CODEOWNERS` containing:
   `* @tjrowland3`
6. **Invite the developer:** repo → Settings → Collaborators → add `<DEVELOPER GITHUB USERNAME>`.
7. **Create the Netlify site:** Add new site → Import from GitHub → pick the repo → production branch `main`. Make sure Deploy Previews are on (they are by default).
8. **Connect the domain** in Netlify → Domain management. Netlify sets up HTTPS automatically.
9. **Create the Shopify store,** then:
   - Add the **Buy Button** sales channel
   - Connect **Printful** from the Shopify App Store
   - Create products in Printful (upload art, pick paper and frame types and sizes) and sync them to Shopify
   - Set up payments (Shopify Payments), shipping, taxes, and your return policy
10. **Give the developer the Buy Button code** for each product, or a staff account limited to sales channels.
11. **Send the developer:** the repo link, `CLAUDE.md` (already in the repo), and your artwork image files with titles, descriptions, and any About-page text.

## What to send the developer

> Hey, the repo is `github.com/tjrowland3/art-gallery` and I've invited you as a collaborator. Read `CLAUDE.md` in the root first; your Claude reads it automatically too. Work on branches named `<yourname>/<change>`, open a pull request for each change, and check the Netlify preview link. I review and merge everything. Don't create any accounts or ask for logins; tell me what you need and I'll set it up.

## How reviewing works for you

1. You get a GitHub notification about a new pull request.
2. Open the **Deploy Preview** link and click around on your phone and computer.
3. Read the report in the pull request description.
4. If it's good, click **Approve**, then **Merge**. The live site updates in about a minute.
5. If something breaks, open the merged pull request and click **Revert**. That creates an undo pull request you can merge.
