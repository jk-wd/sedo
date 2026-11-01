---
name: dark-pattern-blockers
description: >
  Adjust and prove Sedo dark-pattern blockers for a pattern and a site, including
  recommendation-feed on YouTube. Use when editing a blocker, a site README, the
  proof folder, Playwright coverage of a blocked surface, or when a developer
  logs the agent into a social platform to see what a blocker should change.
---

# Dark-pattern blockers

## Layout

```
apps/browser/src/chrome/browser/sedo/dark-patterns/<pattern>/<site>/
  README.md
  selectors.json
  block.template.js
  proof/
```

`recommendation-feed/youtube` blocks the YouTube recommendation feed. Read the site README before editing. The folder names are the pattern and the site.

Generated next to the template, and committed: `block.js`, `block_script.inc`, `selectors.inc`. Edit `selectors.json` and `block.template.js`, then run the proof command, which regenerates them.

`feed_blocker.cc` is the registry. `patches/extra/sedo/hook-feed-blocker.patch` compiles the site sources into the renderer.

## Add a site

1. Create `dark-patterns/<pattern>/<site>/` with `selectors.json`, `block.template.js`, `README.md`, and `proof/`.
2. Set `pattern` and `site` in `selectors.json` to those folder names.
3. Add a C++ policy class and call it from `feed_blocker.cc`.
4. Add the `.cc` and `.h` to `hook-feed-blocker.patch`.
5. Describe the blocked surfaces in the site README.
6. Add a Playwright spec that shows each blocked surface is gone and playback, search, and direct navigation stay.
7. Run `pnpm browser:proof`.

## Proof

From the repo root:

```sh
pnpm --filter @sedo/browser exec playwright install chromium
pnpm browser:proof
```

The spec injects `block.js` into local HTML fixtures. It does not log into the site.

## Live check, with the developer

Use a live site when the fixtures do not show a surface that still needs a decision. The developer logs the agent in. The developer types the password and completes any second factor. The agent waits until the developer says the session is ready.

The agent only reads. Navigate around. Do not write.

- Open links and URLs the developer asked for. Scroll and look.
- Do not add friends, follow, subscribe, like, comment, post, share, message, or upload.
- Do not delete, remove, hide, block, or edit anything, including settings, history, and the account.
- Do not type into the site. Do not ask for, type, or store credentials, cookies, or session data.

Tell the developer which surfaces should be blocked and which should stay. Change the blocker only after the developer agrees, then update the site README and the proof tests.
