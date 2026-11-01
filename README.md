# Sedo

pnpm monorepo for the Sedo browser. The marketing site and design files live in the [sedo-site](https://github.com/jk-wd/sedo-site) repository.

```
apps/browser   Sedo browser (Ungoogled Chromium, patches, and build scripts)
apps/start     Start page shown when the browser opens (Vite and React)
```

## Setup

```sh
pnpm install
```

## Browser

The browser app compiles Ungoogled Chromium on macOS. Source and build output stay in `apps/browser/build/` and are not committed.

```sh
pnpm browser:download
pnpm browser:build
pnpm browser:open
```

`pnpm browser:build` copies the start page into the app before signing. A new tab and startup open `chrome://sedo/`. Preview the page on its own:

```sh
pnpm start:dev
pnpm start:build
```

The start page has a Recommendation blocking switch and a Customize control for YouTube. Both on blocks YouTube recommendations. Turning either one off leaves that feed in place. A second switch, Short-form video blocking, covers vertical videos of 3 minutes or less on every site with a black box. A third, Endless scroll limit, counts each time a feed loads more as you scroll and holds it after 0 to 5 loads (3 by default).

Dark-pattern blockers are grouped by pattern and site:

```
apps/browser/src/chrome/browser/sedo/dark-patterns/recommendation-feed/youtube/
apps/browser/src/chrome/browser/sedo/dark-patterns/short-form-video/all-sites/
apps/browser/src/chrome/browser/sedo/dark-patterns/endless-scroll/all-sites/
```

Each folder's README lists what it blocks. Playwright proof:

```sh
pnpm --filter @sedo/browser exec playwright install chromium
pnpm browser:proof
```
