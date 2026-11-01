# Endless scroll

Pattern: `endless-scroll`. Site: `all-sites`.

This limiter runs on every http(s) page and frame while the start-page switch is on. It does not know any site. It watches scrolling, and the page requests that repeat while you scroll.

## Detected

A feed is endless in either of two ways. One load is one scroll.

A load at the end is counted when all of these hold:

- You scrolled toward the end (wheel, touch, keys, or the scroll bar) of the page or of a scrolling container at least 200 px tall.
- You were within 2 screens of its end.
- Within 4 seconds, the page added new items next to items of the same kind, and the content grew by at least half a screen in one burst.
- You did not click just before. A "Load more" button is pagination you asked for.

A prefetched load is counted when all of these hold:

- You scrolled toward the end of that same scroller. You do not have to be near it. Unsplash fetches the next page about 4 screens up.
- A fetch or XHR repeats a pathname already seen on this page, with a different query or body (`page`, `cursor`, `offset`, `after`). The first time that pathname is requested does not count. A request made on load, before any scroll, does not count. Images, scripts, styles, and fonts do not count.
- Within 2 seconds the scroller grows by at least one screen.
- You did not click just before.

The first load shows a counter at the bottom of the window: "Scrolled 1", "Scrolled 2", "Scrolled 3", with one dot per allowed scroll.

## Limit

The start page sets the limit from 0 to 5 loads; 3 is the default. The load after the limit is held back: the feed stops where it ended before that load, and the counter reads "Scroll limit reached". Scrolling down past that point does nothing. Scrolling up works. A scrolling panel or dialog over the feed keeps its own wheel. With a limit of 0, the first load is held back.

The count starts again on a new page: another path in the same tab, or a reload.

## Not counted

- A page that does not grow, such as an article
- Images loading in (no new items)
- The first request to a pathname
- The same request repeated, such as a poll
- A "Load more" button, including one that fetches the next page
- Small live updates, such as a ticker or a chat message

## Switch

The start page shows Endless scroll limit, on by default, with the 0 to 5 choice. It writes the profile prefs `sedo.endless_scroll_limiting` and `sedo.endless_scroll_limit` (`chrome/browser/sedo/sedo_prefs.h`). `RendererUpdater` sends them to every renderer as `DynamicParams.sedo_endless_scroll` and `sedo_endless_scroll_limit`. When the switch is off, the renderer does not inject this script. A change applies to a page the next time it loads.

## Files

- `selectors.json` — the labels, the default and highest limit, and the detection thresholds. This is the list to edit.
- `block.template.js` — the page script. It is a function; the browser calls it with the limit, as `(3);`.
- `label-font.woff2` — Proxima Nova Bold cut to printable ASCII, the same file as `short-form-video/all-sites`.
- `endless_scroll.h` / `.cc` — clamps the limit and returns the script with that call.
- `block.js`, `block_script.inc`, `selectors.inc` — generated. `pnpm browser:proof` rewrites them.
- `proof/` — Playwright tests and an HTML fixture.

`feed_blocker.cc` registers this pattern. `patches/extra/sedo/hook-endless-scroll.patch` compiles it into the renderer, registers the prefs, and adds the fields to `DynamicParams`. It applies after `hook-short-form-video.patch`.

## Proof

The tests in `proof/endless-scroll.spec.ts` load a fixture feed that adds 10 items when you near its end, and turn the mouse wheel. They check:

- the counter goes 1, 2, 3, then the 4th load is held and the page stops scrolling down
- limits of 0 and 5; scrolling up works at the limit
- a feed inside a scrolling container; a panel keeps its wheel at the limit
- the counter uses the embedded JKWD font
- a "Load more" button, a static page, and a slow ticker show no counter
- a feed that fetches `/napi/photos?page=2`, then `page=3`, while still more than 2 screens from the end, counts each growth of at least one screen
- the same feed loaded with XHR counts as a scroll
- the first request to a pathname does not count; the second one does
- repeating one URL does not count, and a "Load more" button that fetches does not count
- a new path in the same tab starts a new count
- the same behaviour on Instagram, X, and Reddit hosts

```sh
pnpm browser:proof
```

## Live check with the developer

When a live feed is not counted, or a page that is not a feed is, the developer logs the agent in and the agent only reads, as in the YouTube README. The thresholds in `selectors.json`, this README, and the proof tests change together.
