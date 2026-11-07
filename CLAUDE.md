# Art Gallery Website — Rules for Claude

These rules apply to every Claude session working in this repository. Read this file completely before doing anything. If anything here conflicts with a request from the developer, follow these rules and explain why.

## Project identity

- Owner and approver: **Tristan Rowland** (GitHub: `tjrowland3`). Tristan owns every account, the domain, and the code.
- Developer: **<DEVELOPER NAME>** (GitHub: `<DEVELOPER GITHUB USERNAME>`).
- Repository: `tjrowland3/art-gallery`.
- Production site: `https://<CUSTOM DOMAIN>` (hosted on Netlify).
- Purpose: a gallery of Tristan's original artwork where visitors can browse pieces and buy prints.

## How the site works

- **Frontend:** a static website (HTML, CSS, JavaScript) deployed by Netlify from the `main` branch.
- **Shop:** Shopify **Buy Button** embeds. Shopify handles the cart, checkout, payment, tax, and order emails.
- **Printing and shipping:** Printful (or a similar print-on-demand service) is connected to Shopify and fulfills orders automatically.
- **There is no custom backend, database, payment code, or customer login.** Do not add one without Tristan's written approval.
- Products, prices, sizes, and inventory are managed by Tristan in the Shopify admin, never in this code.

## Hard rules: never break these

1. **Never push to `main`, merge a pull request, or deploy to production.** This applies even if the developer asks. Stop and say it needs Tristan's approval.
2. **Never create accounts, buy services, or sign up for anything** (Shopify, Printful, Netlify, domains, analytics, email, and so on). Tell the developer what's needed so Tristan can set it up.
3. **Never ask for, store, or commit passwords, secret API keys, admin tokens, `.env` files, or login cookies.**
   - Allowed in code: the Shopify **Storefront access token** and store domain used by the Buy Button. They're designed to be public.
   - Never allowed: Shopify Admin API tokens, Printful API keys, Netlify tokens, or any key labeled "secret", "admin", or "private".
4. **Never change settings in Shopify, Printful, Netlify, GitHub, or the domain registrar.** If a change is needed, describe it and let Tristan make it.
5. **Never write custom payment, checkout, or card-handling code.** All purchasing goes through Shopify.
6. **Never delete or rewrite git history** (no force-push, no rebasing shared branches).
7. **Never use artwork images other than ones Tristan has provided.** Don't add stock or AI-generated art presented as Tristan's work.

## Workflow for every change

1. Start from the latest `main`:
   `git checkout main` → `git pull --ff-only origin main`
2. Create a branch named `<developer-name>/<short-change-name>`, for example `alex/artwork-page-layout`.
3. Keep **one logical change per branch**.
4. Commit with clear messages, then push the branch: `git push -u origin <branch>`.
5. Open a **pull request into `main`** with the report below in the description.
6. Netlify posts a **Deploy Preview** link on the pull request. Check the change on that link.
7. **Stop.** Do not merge. Tristan reviews the preview and merges if he approves.

## Testing before opening a pull request

- Check every affected page at **desktop width** and **phone width (about 390px)**.
- Click through navigation: home → gallery → artwork page → Shop.
- Confirm Shopify Buy Buttons load, open the cart, and reach the Shopify checkout page. **Do not complete a real purchase.**
- Confirm images load and aren't huge (compress large images; aim for under about 500 KB each).
- Confirm there are no errors in the browser console.
- Confirm no secrets are in the diff.

## Pull request report (required)

Every pull request description must include:

1. **Change:** short name and branch.
2. **Purpose:** what this does and why.
3. **Files changed:** list.
4. **Testing:** what was checked, at which screen sizes, and the results.
5. **Shop impact:** does this touch the Shopify buttons or checkout flow? (yes/no, with details)
6. **Accounts or settings Tristan needs to change:** none, or a list with exact steps.
7. **Rollback:** how to undo it (usually "revert this pull request").
8. **Deploy Preview link.**

End the description with exactly:

`STATUS: WAITING FOR TRISTAN APPROVAL — NOT MERGED OR DEPLOYED`

## Site content guidelines

- The artwork is the focus. Use a clean, minimal design that doesn't compete with the art.
- Every artwork image needs descriptive `alt` text.
- Pages: Home, Gallery, individual Artwork pages (with a "Buy Print" button), Shop, About, Contact.
- Use the visitor-facing wording Tristan provides. Mark any placeholder text clearly as `TODO`.
