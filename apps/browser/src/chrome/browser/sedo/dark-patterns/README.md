# Dark-pattern blockers

Each blocker is a folder named for the pattern and the site:

```
dark-patterns/<pattern>/<site>/
```

The site folder holds the policy, a README of what that site hides, and a `proof/` folder of Playwright tests.

A pattern that is detected on any page, rather than on one site, uses the folder name `all-sites`.

- `recommendation-feed/youtube` — YouTube home feed and watch-page recommendations
- `short-form-video/all-sites` — vertical videos of 3 minutes or less, on every site
- `endless-scroll/all-sites` — feeds that load more as you scroll, limited to 0–5 loads, on every site
