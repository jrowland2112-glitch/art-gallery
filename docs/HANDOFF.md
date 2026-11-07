# Guide 3: Transferring everything to Joseph

**Who this is for:** Tristan.
**Goal:** Joseph owns the Shopify store and the code, and Tristan has no leftover access or keys.
Shopify and GitHub change their screens often. If a button has moved, look for the same words nearby.

## Step 0: Before you start

- [ ] Joseph has a **business email** and a **GitHub username** (Guide 1, steps 1–2).
- [ ] The site looks the way you want. It can still be edited after the transfer.
- [ ] The code is merged into `main` on GitHub. Claude did this on November 7, 2026.

## Step 1: Remove Tristan's helper access (5 min)

These were only for building the site. Don't hand them over.

1. **Uninstall the helper app:** in the store, **Settings → Apps**, then **Claude helper** → **⋯** → **Uninstall**.
2. **Delete the key file** on Tristan's computer: `C:\Users\tjrow\shopify-app.txt`
3. Optional: in the Shopify **Dev Dashboard**, delete the **Claude helper** app.
4. **Shopify CLI login:** run `shopify auth logout` on Tristan's computer.

## Step 2: Transfer the Shopify store (10 min)

1. Go to **partners.shopify.com** (or the **Dev Dashboard**), then **Stores**.
2. Find **Rowland Photography** (`rowland-photography-0v8ydig1.myshopify.com`).
3. Click **⋯** or **Actions** → **Transfer ownership**.
4. Enter **Joseph's email** and confirm.
5. **Joseph** gets an email from Shopify. He clicks it, creates his login, and **picks a plan**. The store is fully his from then on.
6. **After the transfer:**
   - Tristan may keep "collaborator" access. Joseph can remove it in **Settings → Users** if he wants.
   - Joseph should **change the storefront password** (Online Store → Preferences) to one only he knows, or remove it at launch.

## Step 3: Transfer the GitHub code (5 min)

1. On GitHub, open **github.com/tjrowland3/art-gallery → Settings → General**.
2. Untick **Template repository** at the top.
3. Scroll to **Danger Zone → Transfer ownership**.
4. Enter Joseph's GitHub username, type the repo name to confirm, and click **Transfer**.
5. **Joseph** accepts the email from GitHub. The repo becomes `<his-username>/art-gallery`.
6. The "nobody merges without approval" rules carry over, and Joseph is now the admin.
7. Optional: Joseph can add Tristan back as a **collaborator** (Settings → Collaborators) if he wants help later.

## Step 4: Connect GitHub to the store (Joseph, 5 min)

This keeps the code and the theme editor in sync automatically.

1. In Shopify: **Online Store → Themes → Add theme → Connect from GitHub**.
2. Sign in to GitHub, pick **art-gallery**, branch **main**.
3. Shopify creates a theme from `main`.
   - Use **Customize** to check it looks the same as the current one: photos, blog cards, Instagram.
   - Then **Publish** it.
   - The old "Gallery (draft)" theme can be deleted afterwards.
4. From now on:
   - Theme editor saves are committed to GitHub automatically.
   - Merged pull requests update the store.

## Step 5: Keep Tristan on as a helper (optional, Joseph decides)

Joseph stays the owner and approves everything. Tristan can still prepare changes.

1. **Shopify:** check **Settings → Users**.
   - If Tristan isn't listed as a collaborator, Joseph adds him (collaborator, or a staff account with Tristan's email).
   - Give him **Themes** and **Content** permissions only. No payments or payouts.
2. **GitHub:** in the repo, **Settings → Collaborators → Add people → `tjrowland3`**.
3. **How changes flow:**
   - Tristan (or his AI) makes a change on a branch and previews it on an **unpublished** theme.
   - He opens a pull request, and **Joseph merges it**.
   - Because GitHub is connected, the merge updates the store.
4. Joseph can remove either access at any time.

## Step 6: Hand Joseph the guides

- **Guide 1** (`docs/ACCOUNTS_AND_SETUP.md`): payments, print vendor, domain, launch checklist
- **Guide 2** (`docs/AI_SETUP.md`): set up his own Claude/Codex, including the starter prompt
- **Editing guide** (`docs/EDITING_GUIDE.md`): change photos and text without code

## If something goes wrong

- **Transfer email didn't arrive:** check spam, then resend from the Partner dashboard.
- **Theme looks different after connecting GitHub:** the old theme still exists in Online Store → Themes. Re-publish it, then ask Joseph's AI to compare.
- **Need to undo a code change:** on GitHub, open the merged pull request and click **Revert**.
