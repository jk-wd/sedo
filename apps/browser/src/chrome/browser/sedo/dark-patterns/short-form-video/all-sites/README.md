# Short-form video

Pattern: `short-form-video`. Site: `all-sites`.

This blocker runs on every http(s) page and frame while the start-page switch is on. It does not know any site. It looks at each `<video>` the page loads, and blocks it once the browser knows the video's size and length.

## Blocked

A video is short-form when both are true:

- It is vertical: its height is at least 1.2 times its width. 9:16 and 4:5 clips count.
- It is short: its length is 3 minutes (180 seconds) or less.

A blocked video is paused each time the page plays it and hidden. A black box with "Short-form video blocked" in Proxima Nova Bold (the JKWD typeface) covers it. The box covers only the part of the video on screen, inside any scrolling container, and it takes the clicks meant for the player.

This covers Shorts, Reels, TikTok, and the same clips embedded on other pages, including videos inside shadow DOM.

## Still available

- Landscape and square videos of any length
- Vertical videos longer than 3 minutes
- Live streams (no fixed length)
- Camera, call, and screen-share streams (`srcObject`)
- A player that switches to a landscape or long video is released again

## Switch

The start page shows Short-form video blocking, on by default. It writes the profile pref `sedo.short_form_video_blocking` (`chrome/browser/sedo/sedo_prefs.h`). The browser's `RendererUpdater` sends that pref to every renderer as `DynamicParams.sedo_short_form_video`. When it is off, the renderer does not inject this script. A change applies to a page the next time it loads.

## Files

- `selectors.json` — the label, the font name, the length limit, and the portrait ratio. This is the list to edit.
- `block.template.js` — the page script. Placeholder names come from `selectors.json`.
- `label-font.woff2` — Proxima Nova Bold, cut to printable ASCII (6 KB). The generator embeds it in the script as base64. After changing the label to characters outside ASCII, cut a new file from `public/fonts/ProximaNovaBold.woff2` in the sedo-site repo with fontTools `pyftsubset --unicodes=... --flavor=woff2`.
- `short_form_video.h` / `.cc` — the same rule in C++ and the script embedded in the browser.
- `block.js`, `block_script.inc`, `selectors.inc` — generated. `pnpm browser:proof` rewrites them.
- `proof/` — Playwright tests and an HTML fixture.

`feed_blocker.cc` registers this pattern. `patches/extra/sedo/hook-short-form-video.patch` compiles it into the renderer, registers the pref, and adds the field to `DynamicParams`. It applies after `hook-feed-blocker.patch`.

## Proof

The tests in `proof/short-form-video.spec.ts` inject `block.js` into a fixture page. A fixture has no media files, so each test sets a video's size and length and fires `loadedmetadata`, as the browser does when the file loads. The camera test uses a real portrait `MediaStream`. The tests check:

- vertical shorts are covered on example.com, Instagram, TikTok, and YouTube hosts
- the box sits on the video, is black, and uses the embedded font, also under a strict CSP
- 180 seconds is blocked and 181 is not; 4:5 is blocked
- landscape, square, long, live, camera, and unloaded videos stay
- a blocked video is paused when the page plays it
- videos inserted later, and inside a closed shadow root, are blocked
- a player that switches to a landscape video is released; a removed video drops its box
- the box is cut to its scrolling container

```sh
pnpm browser:proof
```

## Live check with the developer

The detection reads only the video itself, so a site does not need its own rules. When a live site shows a short that is not covered, or a covered video that should play, the developer logs the agent in and the agent only reads, as in the YouTube README. The length limit and ratio in `selectors.json`, this README, and the proof tests change together.
