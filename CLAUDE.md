# Art Gallery Website — Rules for AI Assistants (Claude, Codex, and others)

These rules apply to every AI session (Claude Code, Codex, or any other assistant) working in this repository. Read this file completely before doing anything.

## Project identity

- **Owner and approver:** Joseph Rowland (GitHub: `jrowland2112-glitch`). The owner owns the artwork, the business, the Shopify store, every account, and the code, and is the only person who approves changes.
- **Helper:** Tristan Rowland (GitHub: `tjrowland3`) built the first version and may help if the owner asks. He has no approval authority after the handoff.
- **Shopify store:** `rowland-photography-0v8ydig1.myshopify.com` (live site: not yet).
- **Purpose:** a gallery of the owner's original photography and art where visitors browse pieces, read the blog, and buy prints.

Until the store is transferred, Tristan is the acting owner and the remaining placeholders above stay unfilled. After the handoff, fill them in (see `docs/AI_SETUP.md`).

### Current site content (built November 2026)

- **Homepage:** Photo slideshow ("Latest work": grist mill, Vermont, Long Island), Journal highlight (two Story cards linked to blog posts), Instagram call-out (@jrowland).
- **Header links** are theme blocks (Customize → Header): Shop → `/collections/all`, Blog → `/blogs/behind-the-lense`, About → `/pages/about`.
- **Blog:** "Behind the Lense" (`behind-the-lense`), with posts `vermont` and `long-island`. The default "News" blog is unused.
- **Pages:** About (template `page.about`) and Contact (template `page.contact`).
- **Photos** live in Shopify Files: `gristmill.jpg`, `vermont.jpg`, `longi_slandf.jpg`.
- **Not done yet:** products and the print vendor, payments, domain, and real text for the About page and blog posts.

### Theme editor and GitHub stay in sync

Once the owner connects this repo to Shopify (Online Store → Themes → Add theme → Connect from GitHub), every save in the theme editor becomes a commit on `main`, and every merge to `main` updates the theme. So **always `git pull` before starting work**, and never edit `templates/*.json`, `sections/*-group.json`, or `config/settings_data.json` from an old copy.

### Owner-requested editing workflow

- When the owner asks an assistant to edit the theme, make the change locally on a branch, run the required checks, upload or update an **unpublished** preview theme named `Preview: <branch>`, and give the owner the preview link. Routine theme work should not require opening Shopify Admin.
- The owner reviews the preview. Merge only after the owner explicitly approves that specific pull request and instructs the assistant to merge it. Only the owner publishes.
- The saved Shopify CLI login and `shopify.theme.toml` may identify the store, but never store a password, access token, secret, or live-theme target in the repository.
- Blog posts, page records, products, menus, Shopify Files, payments, and other admin-managed resources aren't managed by the theme CLI. Explain when a requested change requires Shopify Admin; never request an Admin API token or other secret as a workaround.

## How the site works

- **This repository is a Shopify theme** (Liquid, CSS, JavaScript) named "Gallery", built on Shopify's open-source Skeleton theme.
- **Everyday editing happens in Shopify, not in code.** In the Shopify admin, the owner uploads photos, adds, removes, and reorders sections (Online Store → Themes → Customize), edits the About page, writes blog posts, and manages products, prices, menus, and analytics.
- **Code changes are only for new kinds of sections or design changes** the theme editor can't already do.
- **Products and print options** (size, frame, mat, paper) come from the print vendor app (for example Prodigi or Lumaprints) as Shopify product options. The product page builds its option buttons and frame/mat preview from those options automatically. Never hard-code products or prices.
- **There is no custom backend, database, payment code, or customer login.** Shopify provides checkout, accounts, and analytics. Don't add a backend without the owner's explicit approval.

### Theme structure

| Folder | Contents |
|---|---|
| `layout/` | `theme.liquid`, the page shell |
| `sections/` | Editable sections: hero, featured prints, collections, photo gallery, image with text, text, blog posts, contact form, plus the page sections (product, collection, cart, …) |
| `snippets/` | Reusable pieces (`product-card`, `css-variables`, `meta-tags`) |
| `templates/` | Which sections each page type starts with (`index.json` = homepage, `page.about.json`, `page.contact.json`, …) |
| `assets/` | `base.css` (all styling), `theme.js` (option picker, frame preview, quantity) |
| `config/` | Global theme settings (fonts, colors, logo, social links) |

Every new section must have a `{% schema %}` with plain-English labels, sensible defaults, and a `presets` entry so the owner can add it from the theme editor.

## Hard rules

1. **Never publish a theme and never touch the live theme.** Preview with `shopify theme dev` or `shopify theme push --unpublished`. The owner publishes.
2. **Never push directly to `main`.** Every change goes through a pull request. An assistant may merge a specific pull request only after the owner explicitly approves that pull request and instructs the assistant to merge it. Otherwise, the owner merges it. Pull requests from Tristan also require the owner's explicit approval.
3. **Never sign up for accounts, enter payment details, or buy anything** for the owner. Explain what's needed and guide the owner through it.
4. **Never ask for, store, or commit passwords, API keys, admin tokens, `.env` files, or login cookies.**
5. **Don't change store settings, products, payments, shipping, taxes, or apps** in the Shopify admin unless the owner explicitly asks for that exact change.
6. **Never write custom payment, checkout, or card-handling code.**
7. **Never delete or rewrite git history** (no force-push, no rebasing shared branches).
8. **Only use artwork the owner has provided.** Don't add stock or AI-generated art presented as the owner's work.
9. **Don't overwrite the owner's theme-editor changes.** The editor saves to `templates/*.json`, `sections/*-group.json`, and `config/settings_data.json`. Run `shopify theme pull` before editing those files, and never push old copies over newer ones.

## Workflow for every change

1. Start from the latest `main`: `git checkout main` then `git pull --ff-only origin main`.
2. Create a branch named for the change, for example `add-testimonials-section`.
3. Keep **one logical change per branch**.
4. Run `shopify theme check`. It must report no errors.
5. Preview: `shopify theme push --unpublished --theme "Preview: <branch>"`, then share the preview link.
6. Commit, push the branch, and open a **pull request into `main`** with the report below.
7. **Stop.** Tell the owner it's ready. The owner reviews the preview and either merges the pull request or explicitly instructs the assistant to merge that specific pull request. Only the owner publishes.

## Testing before opening a pull request

- Check affected pages at **desktop width** and **phone width (about 390px)**.
- Click through: Home → Collection → Product → choose options → Add to cart → Cart → Checkout page. **Don't complete a real purchase.**
- On a product with Frame and Mat options, confirm the price, the preview, and Add to cart update for each choice.
- Open the theme editor (Customize) and confirm new or changed sections can be added, edited, and removed.
- Confirm there are no errors in the browser console.

## Pull request report (required)

1. **Change:** short name and branch.
2. **Purpose:** what this does and why.
3. **Files changed:** list.
4. **Testing:** what was checked, at which screen sizes, and the results.
5. **Shop impact:** does this touch the product page, cart, or checkout flow?
6. **Store changes the owner needs to make:** none, or exact steps.
7. **Rollback:** usually "revert this pull request and re-publish the previous theme".
8. **Preview link.**

End the description with exactly:

`STATUS: WAITING FOR OWNER APPROVAL — NOT MERGED`
