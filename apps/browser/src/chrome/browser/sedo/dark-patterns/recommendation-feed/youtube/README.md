# YouTube recommendation feed

Pattern: `recommendation-feed`. Site: `youtube`.

This blocker runs on `youtube.com`, `www.youtube.com`, and `m.youtube.com`. It removes recommendation surfaces as the page inserts them. The open video keeps playing.

## Blocked

**Home** (`/` on desktop and mobile)

- The home grid of recommended videos
- Shelves and sections on the home page
- The Shorts shelf on the home page
- Home rows that keep loading as you scroll

**Watch** (`/watch` and `/live`)

- The related column beside the player
- Suggested videos, mixes, recommended playlists, and autoplay in that column
- Related chips and the column's "load more" row
- On mobile, the related rows under the player

## Still available

- The player and the video that is open
- The title and description
- Comments
- The playlist queue that is already playing, including its rows
- Search, search results, and the masthead
- The guide and mini guide
- Channel pages, including a channel's own videos
- Embeds (`/embed/`)
- Other YouTube hosts, including `music.youtube.com` and `studio.youtube.com`

## Files

- `selectors.json` — hosts and the selectors above. This is the list to edit.
- `block.template.js` — the page script. Placeholder names come from `selectors.json`.
- `youtube_recommendation_feed.h` / `.cc` — host check and the script embedded in the browser.
- `block.js`, `block_script.inc`, `selectors.inc` — generated. `pnpm browser:proof` rewrites them.
- `proof/` — Playwright tests and HTML fixtures for the surfaces above.

`feed_blocker.cc` registers this site. `patches/extra/sedo/hook-feed-blocker.patch` compiles it into the renderer.

## Proof

The tests in `proof/recommendation-feed.spec.ts` load local fixtures, inject `block.js`, and check each blocked surface is gone while playback, search, channels, embeds, and other hosts stay.

From the repo root, once per machine:

```sh
pnpm --filter @sedo/browser exec playwright install chromium
```

Then:

```sh
pnpm browser:proof
```

## Start page

Sedo opens on the start page. Recommendation blocking is on, including YouTube. Customize turns YouTube off on its own. Off leaves the home feed and the watch-page recommendations in place.

## Live check with the developer

When a fixture does not show a surface that still needs a decision, the developer logs the agent into YouTube. The developer types the password and completes any second factor. The agent waits until the developer says the session is ready.

On YouTube the agent only reads. It navigates and looks. It does not add friends, subscribe, post, or delete anything. It reports what should be blocked and what should stay. The developer decides the adjustment, then the selector list, this README, and the proof tests are updated together.
