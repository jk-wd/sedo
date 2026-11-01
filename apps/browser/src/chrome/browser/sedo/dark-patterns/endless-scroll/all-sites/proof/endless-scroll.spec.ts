import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const proofDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(proofDir, '..');
const browserRoot = path.resolve(siteDir, '../../../../../../..');
const blockScript = path.join(siteDir, 'block.js');
const limitLabel = 'Scroll limit reached';

type SelectorsFile = {
  pattern: string;
  site: string;
  strings: Record<string, string>;
  numbers: Record<string, number>;
  fonts: Record<string, string>;
};

async function openFeed(page: Page, mode: string, limit = 3, host = 'example.com') {
  const html = fs.readFileSync(path.join(proofDir, 'fixtures', 'feed.html'), 'utf8');
  const js = fs.readFileSync(blockScript, 'utf8');
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.addInitScript({ content: `${js}(${limit});` });
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname === host) {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return;
    }
    await route.abort();
  });
  await page.goto(`https://${host}/feed?mode=${mode}`, { waitUntil: 'load' });
  await page.waitForFunction(
    (expected) => {
      const marker = (globalThis as {
        __sedoEndlessScroll?: { pattern?: string; site?: string; limit?: number };
      }).__sedoEndlessScroll;
      return (
        marker?.pattern === 'endless-scroll' &&
        marker?.site === 'all-sites' &&
        marker?.limit === expected
      );
    },
    Math.min(5, Math.max(0, limit)),
  );
  await page.mouse.move(400, 500);
}

function label(page: Page) {
  return page.locator('sedo-endless-scroll-counter .label');
}

async function counterText(page: Page) {
  return (await label(page).count()) ? await label(page).textContent() : null;
}

// Turns the wheel one notch at a time until the counter shows expected.
async function scrollUntil(page: Page, expected: string) {
  for (let turn = 0; turn < 80; turn += 1) {
    if ((await counterText(page)) === expected) return;
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(120);
  }
  expect(await counterText(page)).toBe(expected);
}

async function scrollUntilCount(page: Page, count: number) {
  for (let turn = 0; turn < 80; turn += 1) {
    if (await page.locator('.item').count() >= count) return;
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(150);
  }
  expect(await page.locator('.item').count()).toBeGreaterThanOrEqual(count);
}

async function wheel(page: Page, turns: number) {
  for (let turn = 0; turn < turns; turn += 1) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(100);
  }
}

const scrollTop = (page: Page) => page.evaluate(() => document.scrollingElement!.scrollTop);

test.describe('endless-scroll / all-sites', () => {
  test('compiled script matches selectors.json', () => {
    const selectors = JSON.parse(
      fs.readFileSync(path.join(siteDir, 'selectors.json'), 'utf8'),
    ) as SelectorsFile;
    const js = fs.readFileSync(blockScript, 'utf8');
    const inc = fs.readFileSync(path.join(siteDir, 'block_script.inc'), 'utf8');
    const constants = fs.readFileSync(path.join(siteDir, 'selectors.inc'), 'utf8');
    const header = fs.readFileSync(path.join(siteDir, 'endless_scroll.h'), 'utf8');
    const source = fs.readFileSync(path.join(siteDir, 'endless_scroll.cc'), 'utf8');
    const registry = fs.readFileSync(
      path.join(browserRoot, 'src/chrome/browser/sedo/feed_blocker.cc'),
      'utf8',
    );
    const patch = fs.readFileSync(
      path.join(browserRoot, 'patches/extra/sedo/hook-endless-scroll.patch'),
      'utf8',
    );
    const prefs = fs.readFileSync(
      path.join(browserRoot, 'src/chrome/browser/sedo/sedo_prefs.h'),
      'utf8',
    );
    const series = fs.readFileSync(path.join(browserRoot, 'patches/series'), 'utf8');

    expect(selectors.pattern).toBe('endless-scroll');
    expect(selectors.site).toBe('all-sites');
    expect(js).toContain('pattern: "endless-scroll"');
    expect(js).toContain('site: "all-sites"');
    expect(js.trimEnd().endsWith('})')).toBe(true);
    expect(inc).toBe(`R"SEDOJS(${js})SEDOJS"\n`);
    expect(header).toContain('kPattern = "endless-scroll"');
    expect(header).toContain('kSite = "all-sites"');
    expect(source).toContain('std::to_string(ClampLimit(max_scrolls))');
    expect(registry).toContain('EndlessScroll::BlockScript(switches.endless_scroll_limit)');
    expect(patch).toContain('dark-patterns/endless-scroll/all-sites/endless_scroll.cc');
    expect(patch).toContain('bool sedo_endless_scroll = true;');
    expect(patch).toContain('int32 sedo_endless_scroll_limit = 3;');
    expect(prefs).toContain('"sedo.endless_scroll_limiting"');
    expect(prefs).toContain('"sedo.endless_scroll_limit"');
    expect(prefs).toContain(`kEndlessScrollDefaultLimit = ${selectors.numbers.kDefaultLimit};`);
    expect(prefs).toContain(`kEndlessScrollMaxLimit = ${selectors.numbers.kMaxLimit};`);
    expect(series).toContain('extra/sedo/hook-endless-scroll.patch');

    for (const [name, value] of Object.entries(selectors.strings)) {
      expect(constants).toContain(`constexpr std::string_view ${name} =`);
      expect(js).toContain(JSON.stringify(value));
    }
    for (const [name, value] of Object.entries(selectors.numbers)) {
      expect(constants).toContain(`constexpr double ${name} =`);
      expect(js).toContain(`= ${value};`);
    }
    for (const file of Object.values(selectors.fonts)) {
      expect(js).toContain(fs.readFileSync(path.join(siteDir, file)).toString('base64'));
    }
  });

  test('counts three loads, then holds the feed at its end', async ({ page }) => {
    await openFeed(page, 'window');
    expect(await counterText(page)).toBeNull();
    await scrollUntil(page, 'Scrolled 1');
    await expect(page.locator('sedo-endless-scroll-counter .dot.used')).toHaveCount(1);
    await expect(page.locator('sedo-endless-scroll-counter .dot')).toHaveCount(3);
    await scrollUntil(page, 'Scrolled 2');
    await scrollUntil(page, 'Scrolled 3');
    await scrollUntil(page, limitLabel);

    await wheel(page, 10);
    const held = await scrollTop(page);
    await wheel(page, 6);
    expect(await scrollTop(page)).toBeLessThanOrEqual(held + 1);
    const hidden = await page.evaluate(() => {
      const root = document.scrollingElement!;
      return root.scrollHeight - root.scrollTop - root.clientHeight;
    });
    expect(hidden).toBeGreaterThan(1500);
    await expect(page.locator('#masthead')).toBeAttached();
  });

  test('scrolling back up still works at the limit', async ({ page }) => {
    await openFeed(page, 'window', 0);
    await scrollUntil(page, limitLabel);
    await wheel(page, 4);
    const held = await scrollTop(page);
    await page.mouse.wheel(0, -900);
    await expect.poll(() => scrollTop(page)).toBeLessThan(held);
  });

  test('a limit of 0 holds the first load', async ({ page }) => {
    await openFeed(page, 'window', 0);
    await scrollUntil(page, limitLabel);
    await expect(page.locator('sedo-endless-scroll-counter .dot')).toHaveCount(0);
    const items = await page.locator('.item').count();
    expect(items).toBeGreaterThan(12);
    await wheel(page, 8);
    const held = await scrollTop(page);
    const lastVisible = await page.evaluate(
      (top) => top + document.scrollingElement!.clientHeight,
      held,
    );
    // Only the first 12 items (300px + 16px each, after the 48px header) can be reached.
    expect(lastVisible).toBeLessThanOrEqual(48 + 12 * 316 + 1);
  });

  test('a limit of 5 allows five loads', async ({ page }) => {
    await openFeed(page, 'window', 5);
    for (let count = 1; count <= 5; count += 1) {
      await scrollUntil(page, `Scrolled ${count}`);
    }
    await scrollUntil(page, limitLabel);
    await expect(page.locator('sedo-endless-scroll-counter .dot.used')).toHaveCount(5);
  });

  test('a feed inside a scrolling container is counted and held', async ({ page }) => {
    await openFeed(page, 'inner', 1);
    await scrollUntil(page, 'Scrolled 1');
    await scrollUntil(page, limitLabel);
    await wheel(page, 8);
    const held = await page.evaluate(() => document.getElementById('scroller')!.scrollTop);
    await wheel(page, 4);
    expect(await page.evaluate(() => document.getElementById('scroller')!.scrollTop)).toBeLessThanOrEqual(
      held + 1,
    );
  });

  test('a scrolling panel keeps its wheel at the limit', async ({ page }) => {
    await openFeed(page, 'window', 0);
    await scrollUntil(page, limitLabel);
    await page.mouse.move(1000, 150);
    await page.mouse.wheel(0, 300);
    await expect
      .poll(() => page.evaluate(() => document.getElementById('panel')!.scrollTop))
      .toBeGreaterThan(0);
  });

  test('the counter uses the JKWD font', async ({ page }) => {
    await openFeed(page, 'window');
    await scrollUntil(page, 'Scrolled 1');
    await expect(label(page)).toHaveCSS('font-family', /^"Sedo Proxima Nova"/);
    await expect(label(page)).toHaveCSS('font-weight', '700');
    await page.waitForFunction(() => document.fonts.check('700 15px "Sedo Proxima Nova"'));
    await expect(page.locator('sedo-endless-scroll-counter [role="status"]')).toBeVisible();
  });

  test('a "Load more" button is not endless scroll', async ({ page }) => {
    await openFeed(page, 'button');
    for (let round = 0; round < 3; round += 1) {
      await wheel(page, 6);
      await page.locator('#more').click();
      await page.waitForTimeout(300);
    }
    expect(await page.locator('.item').count()).toBe(42);
    await wheel(page, 4);
    await page.waitForTimeout(400);
    expect(await counterText(page)).toBeNull();
  });

  test('a page that does not grow shows no counter', async ({ page }) => {
    await openFeed(page, 'static');
    await wheel(page, 10);
    await page.waitForTimeout(400);
    expect(await counterText(page)).toBeNull();
  });

  test('a prefetched next page counts before the end', async ({ page }) => {
    await openFeed(page, 'prefetch');
    expect(await counterText(page)).toBeNull();
    await scrollUntil(page, 'Scrolled 1');
    await scrollUntil(page, 'Scrolled 2');
    await scrollUntil(page, 'Scrolled 3');
    await scrollUntil(page, limitLabel);
    await wheel(page, 8);
    const held = await scrollTop(page);
    await wheel(page, 4);
    expect(await scrollTop(page)).toBeLessThanOrEqual(held + 1);
  });

  test('a prefetched next page over XHR counts the same way', async ({ page }) => {
    await openFeed(page, 'prefetch-xhr');
    await scrollUntil(page, 'Scrolled 1');
  });

  test('the first request to a path does not count', async ({ page }) => {
    await openFeed(page, 'prefetch-cold');
    await scrollUntilCount(page, 30);
    await page.waitForTimeout(400);
    expect(await counterText(page)).toBeNull();
    await scrollUntilCount(page, 40);
    await expect.poll(() => counterText(page)).toBe('Scrolled 1');
  });

  test('repeating the same request is not endless scroll', async ({ page }) => {
    await openFeed(page, 'same-url');
    await scrollUntilCount(page, 40);
    await page.waitForTimeout(400);
    expect(await counterText(page)).toBeNull();
  });

  test('a "Load more" fetch is not endless scroll', async ({ page }) => {
    await openFeed(page, 'fetch-button');
    await page.locator('#more').waitFor();
    for (let round = 0; round < 3; round += 1) {
      await wheel(page, 4);
      await page.locator('#more').click();
      await page.waitForTimeout(300);
    }
    expect(await page.locator('.item').count()).toBe(50);
    expect(await counterText(page)).toBeNull();
  });

  test('small live updates are not endless scroll', async ({ page }) => {
    await openFeed(page, 'ticker');
    await wheel(page, 6);
    for (let second = 0; second < 5; second += 1) {
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(800);
    }
    expect(await page.locator('.tick').count()).toBeGreaterThan(3);
    expect(await counterText(page)).toBeNull();
  });

  test('a new page in the same tab starts a new count', async ({ page }) => {
    await openFeed(page, 'window', 0);
    await scrollUntil(page, limitLabel);
    await page.evaluate(() => history.pushState({}, '', '/other'));
    await page.mouse.wheel(0, 900);
    await expect(page.locator('sedo-endless-scroll-counter')).toHaveCount(0);
    const before = await scrollTop(page);
    await wheel(page, 4);
    expect(await scrollTop(page)).toBeGreaterThan(before);
  });

  for (const host of ['www.instagram.com', 'x.com', 'www.reddit.com']) {
    test(`${host} is counted the same way`, async ({ page }) => {
      await openFeed(page, 'window', 3, host);
      await scrollUntil(page, 'Scrolled 1');
    });
  }
});
