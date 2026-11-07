# Guide 2: Setting up Joseph's AI (Claude Code or Codex)

**Who this is for:** Joseph, and Tristan helping him, plus the AI itself.
**When:** after Guide 3, once Joseph owns the store and the GitHub repo.

## What Joseph needs first

- A computer with **VS Code** (free, code.visualstudio.com)
- **Claude Code** (with Claude Pro) or **Codex** (with ChatGPT Plus), installed in VS Code
- His **GitHub** login and his **Shopify** login

## Starter prompt

Joseph opens an empty folder in VS Code, starts Claude Code or Codex, and pastes this:

```
I'm Joseph Rowland. I own the Rowland Photography website: a custom Shopify theme for my photography, with a shop, blog, and About page. My friend Tristan built the first version, and it has been transferred to me. I approve all changes myself.

Please help me set up, one step at a time. Check with me before anything that costs money, needs a login, or changes the live store:

1. Check whether git, Node.js, the GitHub CLI (gh), and the Shopify CLI are installed. If not, walk me through installing them. Then help me log in with `gh auth login`.

2. Clone my repository: `gh repo clone <MY GITHUB USERNAME>/art-gallery`, and work inside that folder.

3. Read CLAUDE.md, AGENTS.md, README.md, and everything in the docs/ folder completely. CLAUDE.md contains the rules for this project. Follow them in this session and every future session.

4. Fill in the remaining placeholders in CLAUDE.md with me: my GitHub username, my store address, and my domain (or "not yet"). Do it on a branch, open a pull request, and let me merge it.

5. Summarize the rules back to me in a few short bullet points, including how I approve changes.

6. Go through docs/ACCOUNTS_AND_SETUP.md with me and tell me which steps I still need to do (payments, print vendor, domain, launch checklist), in order.

7. Show me how to preview a change safely (`shopify theme dev` or an unpublished theme) before anything goes live.

Don't change anything on the site until I say go.
```

## Notes for the AI

- **Theme edits can be handled for Joseph:** when Joseph asks for a theme design, section, photo-setting, or theme-text change, make it locally on a branch and give him an unpublished preview link. Blog posts, page records, products, menus, Shopify Files, payments, and other admin-managed resources still require the **Shopify admin**; explain those limits without requesting passwords or API tokens.
- **Code changes are for new section types or design changes only.** Always use a branch, a preview, and a pull request. Joseph either merges it himself or explicitly approves that specific pull request and instructs the assistant to merge it.
- **If GitHub is connected to the store** (Guide 3, step 4), editor saves land on `main` as commits. Run `git pull` before every task.
- **Never ask for passwords or secret keys.** If store data must be changed through the API, Joseph creates the access himself and keeps the key out of the repo.
