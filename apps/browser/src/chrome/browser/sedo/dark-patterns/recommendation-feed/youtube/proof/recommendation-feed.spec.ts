import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const proofDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(proofDir, '..');
const browserRoot = path.resolve(siteDir, '../../../../../../..');
const blockScript = path.join(siteDir, 'block.js');

type SelectorsFile = {
  pattern: string;
  site: string;
  arrays: Record<string, string[]>;
  strings: Record<string, string>;
};

async function openFixture(
  page: Page,
  url: string,
  fixture: string,
  mode: 'active' | 'skip',
) {
  const html = fs.readFileSync(path.join(proofDir, 'fixtures', fixture), 'utf8');
  const host = new URL(url).hostname;
  await page.addInitScript({ path: blockScript });
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname === host) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: html,
      });
      return;
    }
    await route.abort();
  });
  await page.goto(url, { waitUntil: 'load' });
  if (mode === 'active') {
    await page.waitForFunction(() => {
      const marker = (globalThis as {
        __sedoFeedBlocker?: { pattern?: string; site?: string };
      }).__sedoFeedBlocker;
      return marker?.pattern === 'recommendation-feed' && marker?.site === 'youtube';
    });
  } else {
    await page.waitForFunction(
      (hostname) =>
        (globalThis as { __sedoFeedBlockerSkipped?: string }).__sedoFeedBlockerSkipped ===
        hostname,
      host,
    );
  }
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 150)));
}

async function gone(page: Page, id: string) {
  await expect(page.locator(`#${id}`)).toHaveCount(0);
}

async function stays(page: Page, id: string) {
  await expect(page.locator(`#${id}`)).toBeVisible();
}

test.describe('recommendation-feed / youtube', () => {
  test('compiled script matches selectors.json', () => {
    const selectors = JSON.parse(
      fs.readFileSync(path.join(siteDir, 'selectors.json'), 'utf8'),
    ) as SelectorsFile;
    const js = fs.readFileSync(blockScript, 'utf8');
    const inc = fs.readFileSync(path.join(siteDir, 'block_script.inc'), 'utf8');
    const constants = fs.readFileSync(path.join(siteDir, 'selectors.inc'), 'utf8');
    const header = fs.readFileSync(
      path.join(siteDir, 'youtube_recommendation_feed.h'),
      'utf8',
    );
    const registry = fs.readFileSync(path.join(browserRoot, 'src/chrome/browser/sedo/feed_blocker.cc'), 'utf8');
    const patch = fs.readFileSync(
      path.join(browserRoot, 'patches/extra/sedo/hook-feed-blocker.patch'),
      'utf8',
    );

    expect(selectors.pattern).toBe('recommendation-feed');
    expect(selectors.site).toBe('youtube');
    expect(js).toContain('pattern: "recommendation-feed"');
    expect(js).toContain('site: "youtube"');
    expect(inc).toBe(`R"SEDOJS(${js})SEDOJS"\n`);
    expect(header).toContain('kPattern = "recommendation-feed"');
    expect(header).toContain('kSite = "youtube"');
    expect(registry).toContain('YouTubeRecommendationFeed::BlockScript()');
    expect(patch).toContain(
      'dark-patterns/recommendation-feed/youtube/youtube_recommendation_feed.cc',
    );

    for (const [name, values] of Object.entries(selectors.arrays)) {
      expect(constants).toContain(`constexpr std::string_view ${name}[]`);
      for (const value of values) {
        expect(js).toContain(JSON.stringify(value));
        expect(constants).toContain(`"${value}"`);
      }
    }
    for (const [name, value] of Object.entries(selectors.strings)) {
      expect(constants).toContain(`constexpr std::string_view ${name} =`);
      expect(js).toContain(JSON.stringify(value));
      expect(constants).toContain(`"${value}"`);
    }
  });

  test('home feed is removed and chrome stays', async ({ page }) => {
    await openFixture(page, 'https://www.youtube.com/', 'home.html', 'active');
    for (const id of [
      'home-grid',
      'home-shelf',
      'home-section',
      'home-reels',
      'home-item',
      'home-lockup',
      'home-continuation',
    ]) {
      await gone(page, id);
    }
    for (const id of ['masthead', 'search', 'searchbox', 'mini-guide', 'guide']) {
      await stays(page, id);
    }
  });

  test('a turned-off YouTube switch leaves the home feed', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'sedo-recommendation-feed-youtube',
        value: '0',
        url: 'https://www.youtube.com/',
      },
    ]);
    await openFixture(page, 'https://www.youtube.com/', 'home.html', 'skip');
    await stays(page, 'home-grid');
    await stays(page, 'home-shelf');
    await stays(page, 'masthead');
  });

  test('youtube.com home feed is removed', async ({ page }) => {
    await openFixture(page, 'https://youtube.com/', 'home.html', 'active');
    await gone(page, 'home-grid');
    await stays(page, 'masthead');
    await stays(page, 'searchbox');
  });

  test('a home recommendation inserted later is removed', async ({ page }) => {
    await openFixture(page, 'https://www.youtube.com/', 'home.html', 'active');
    await page.evaluate(() => {
      const primary = document.querySelector('#primary');
      const node = document.createElement('ytd-rich-item-renderer');
      node.id = 'late-item';
      node.textContent = 'Late';
      primary?.appendChild(node);
    });
    await gone(page, 'late-item');
    await stays(page, 'masthead');
  });

  test('yt-navigate-finish removes a new home grid', async ({ page }) => {
    await openFixture(page, 'https://www.youtube.com/', 'home.html', 'active');
    await page.evaluate(() => {
      const browse = document.querySelector('ytd-browse');
      const node = document.createElement('ytd-rich-grid-renderer');
      node.id = 'spa-grid';
      node.textContent = 'Late grid';
      browse?.appendChild(node);
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await gone(page, 'spa-grid');
    await stays(page, 'guide');
  });

  for (const urlPath of ['/watch?v=sedo', '/live/sedo']) {
    test(`${urlPath} removes recommendations and keeps playback`, async ({ page }) => {
      await openFixture(page, `https://www.youtube.com${urlPath}`, 'watch.html', 'active');
      for (const id of [
        'related',
        'related-video',
        'related-lockup',
        'secondary-compact',
        'related-radio',
        'related-playlist',
        'related-autoplay',
        'related-chips',
        'related-more',
      ]) {
        await gone(page, id);
      }
      for (const id of ['movie_player', 'player', 'metadata', 'comments', 'queue', 'queue-item', 'masthead', 'searchbox']) {
        await stays(page, id);
      }
    });
  }

  for (const urlPath of ['/@sedo', '/channel/UCsedo']) {
    test(`${urlPath} keeps the channel grid`, async ({ page }) => {
      await openFixture(page, `https://www.youtube.com${urlPath}`, 'channel.html', 'active');
      await stays(page, 'channel-grid');
      await stays(page, 'channel-lockup');
      await stays(page, 'channel-continuation');
      await stays(page, 'searchbox');
    });
  }

  test('search results stay', async ({ page }) => {
    await openFixture(
      page,
      'https://www.youtube.com/results?search_query=sedo',
      'search.html',
      'active',
    );
    await stays(page, 'search-grid');
    await stays(page, 'search-result');
    await stays(page, 'searchbox');
    await stays(page, 'masthead');
  });

  test('mobile home shelves are removed', async ({ page }) => {
    await openFixture(page, 'https://m.youtube.com/', 'mobile-home.html', 'active');
    for (const id of ['m-item', 'm-section', 'm-reels', 'm-video']) {
      await gone(page, id);
    }
    await stays(page, 'mobile-browse');
    await stays(page, 'search');
  });

  test('mobile watch removes related rows and keeps the player', async ({ page }) => {
    await openFixture(page, 'https://m.youtube.com/watch?v=sedo', 'mobile-watch.html', 'active');
    for (const id of ['m-related', 'm-compact', 'm-rich', 'm-reels']) {
      await gone(page, id);
    }
    await stays(page, 'watch-next');
    await stays(page, 'm-player');
  });

  test('embed keeps its markup', async ({ page }) => {
    await openFixture(page, 'https://www.youtube.com/embed/sedo', 'embed.html', 'active');
    await stays(page, 'movie_player');
    await stays(page, 'embed-related');
  });

  for (const host of ['music.youtube.com', 'studio.youtube.com', 'example.com', 'www.youtube.com.evil']) {
    test(`${host} keeps the home feed`, async ({ page }) => {
      await openFixture(page, `https://${host}/`, 'home.html', 'skip');
      await stays(page, 'home-grid');
      await stays(page, 'home-shelf');
      await stays(page, 'masthead');
    });
  }
});
