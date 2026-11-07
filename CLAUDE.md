# Art Gallery Website — Rules for AI Assistants (Claude, Codex, and others)

These rules apply to every AI session (Claude Code, Codex, or any other assistant) working in this repository. Read this file completely before doing anything.

## Project identity

- **Owner and approver:** <OWNER NAME> (GitHub: `<OWNER GITHUB USERNAME>`). The owner owns the artwork, the business, every account, and the code, and is the only person who approves changes.
- **Helper:** Tristan Rowland (GitHub: `tjrowland3`) set up this starter project and may help if the owner asks. He has no approval authority.
- **Repository:** `<OWNER GITHUB USERNAME>/<REPO NAME>`.
- **Live site:** `https://<CUSTOM DOMAIN>` (hosted on Netlify).
- **Purpose:** a gallery of the owner's original artwork where visitors can browse pieces and buy prints.

## First-time setup (do this once, then delete this section)

If any `<PLACEHOLDER>` values above are still unfilled, the project hasn't been set up yet. With the owner:

1. Ask for the owner's name, GitHub username, the repo name they want, and the domain (or "not yet").
2. Fill in the placeholders in this file, `README.md`, and `.github/CODEOWNERS`.
3. Protect the `main` branch on GitHub (with the owner's permission, via `gh api`):
   - Require a pull request before merging (0 required approvals, since the owner merges their own pull requests)
   - Require status checks `secret-scan` and `site-check` to pass
   - Block force pushes and branch deletion
4. Turn on secret scanning and push protection in the repo settings.
5. Commit these setup changes on a branch, open a pull request, and have the owner merge it.

## How the site works

- **Frontend:** a static website (HTML, CSS, JavaScript) in `site/`, deployed by Netlify from the `main` branch.
- **Shop:** Shopify **Buy Button** embeds. Shopify handles the cart, checkout, payment, tax, and order emails.
- **Printing and shipping:** Printful (or a similar print-on-demand service) is connected to Shopify and fulfills orders automatically.
- **There is no custom backend, database, payment code, or customer login.** Don't add one without the owner's explicit approval.
- Products, prices, and sizes are managed by the owner in the Shopify admin, never in this code.

## Hard rules

1. **Never push directly to `main` and never merge pull requests.** Every change goes through a pull request, and the owner reviews and merges it.
2. **Never sign up for accounts, enter payment details, or buy anything** for the owner. Explain what's needed and guide the owner through doing it.
3. **Never ask for, store, or commit passwords, secret API keys, admin tokens, `.env` files, or login cookies.**
   - Allowed in code: the Shopify **Storefront access token** and store domain used by the Buy Button. They're designed to be public.
   - Never allowed: Shopify Admin API tokens, Printful API keys, Netlify tokens, or any key labeled "secret", "admin", or "private".
4. **Don't change settings in Shopify, Printful, Netlify, or the domain registrar** unless the owner explicitly asks for that exact change.
5. **Never write custom payment, checkout, or card-handling code.** All purchasing goes through Shopify.
6. **Never delete or rewrite git history** (no force-push, no rebasing shared branches).
7. **Only use artwork images the owner has provided.** Don't add stock or AI-generated art presented as the owner's work.

## Workflow for every change

1. Start from the latest `main`: `git checkout main` then `git pull --ff-only origin main`.
2. Create a branch named for the change, for example `artwork-page-layout`.
3. Keep **one logical change per branch**.
4. Commit with clear messages, then push the branch: `git push -u origin <branch>`.
5. Open a **pull request into `main`** with the report below in the description.
6. Netlify posts a **Deploy Preview** link on the pull request. Check the change there.
7. **Stop.** Tell the owner it's ready and share the preview link. The owner merges when happy.

## Testing before opening a pull request

- Check every affected page at **desktop width** and **phone width (about 390px)**.
- Click through navigation: Home → Gallery → Artwork page → Shop.
- Confirm Shopify Buy Buttons load, open the cart, and reach the Shopify checkout page. **Don't complete a real purchase.**
- Confirm images load and aren't huge (compress them; aim for under about 500 KB each).
- Confirm there are no errors in the browser console.
- Confirm no secrets are in the diff.

## Pull request report (required)

Every pull request description must include:

1. **Change:** short name and branch.
2. **Purpose:** what this does and why.
3. **Files changed:** list.
4. **Testing:** what was checked, at which screen sizes, and the results.
5. **Shop impact:** does this touch the Shopify buttons or checkout flow? (yes/no, with details)
6. **Account or settings changes the owner needs to make:** none, or a list with exact steps.
7. **Rollback:** how to undo it (usually "revert this pull request").
8. **Deploy Preview link.**

End the description with exactly:

`STATUS: WAITING FOR OWNER APPROVAL — NOT MERGED`

## Site content guidelines

- The artwork is the focus. Use a clean, minimal design that doesn't compete with the art.
- Every artwork image needs descriptive `alt` text.
- Pages: Home, Gallery, individual Artwork pages (with a "Buy Print" button), Shop, About, Contact.
- Use the owner's own wording for visitor-facing text. Mark any placeholder text clearly as `TODO`.
