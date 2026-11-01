import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const proofDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(proofDir, '..');
const browserRoot = path.resolve(siteDir, '../../../../../../..');
const blockScript = path.join(siteDir, 'block.js');
const label = 'Short-form video blocked';

type SelectorsFile = {
  pattern: string;
  site: string;
  strings: Record<string, string>;
  numbers: Record<string, number>;
  fonts: Record<string, string>;
};

type Metadata = [width: number, height: number, duration: number];

async function openFeed(page: Page, url = 'https://example.com/feed') {
  const html = fs.readFileSync(path.join(proofDir, 'fixtures', 'feed.html'), 'utf8');
  const host = new URL(url).hostname;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript({ path: blockScript });
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname === host) {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return;
    }
    await route.abort();
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const marker = (globalThis as { __sedoShortFormVideo?: { pattern?: string; site?: string } })
      .__sedoShortFormVideo;
    return marker?.pattern === 'short-form-video' && marker?.site === 'all-sites';
  });
}

async function load(page: Page, id: string, [width, height, duration]: Metadata) {
  await page.evaluate(
    ({ id, width, height, duration }) => {
      const video = document.getElementById(id) as HTMLVideoElement;
      (window as unknown as { setMetadata: (...args: unknown[]) => void }).setMetadata(
        video,
        width,
        height,
        duration,
      );
    },
    { id, width, height, duration },
  );
}

async function blocked(page: Page, id: string) {
  const video = page.locator(`#${id}`);
  await expect(video).toHaveAttribute('data-sedo-short-form', 'blocked');
  await expect(video).toHaveCSS('visibility', 'hidden');
}

async function kept(page: Page, id: string) {
  const video = page.locator(`#${id}`);
  await expect(video).not.toHaveAttribute('data-sedo-short-form', /.*/);
  await expect(video).toHaveCSS('visibility', 'visible');
}

function boxes(page: Page) {
  return page.locator('sedo-short-form-shield .box');
}

async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test.describe('short-form-video / all-sites', () => {
  test('compiled script matches selectors.json', () => {
    const selectors = JSON.parse(
      fs.readFileSync(path.join(siteDir, 'selectors.json'), 'utf8'),
    ) as SelectorsFile;
    const js = fs.readFileSync(blockScript, 'utf8');
    const inc = fs.readFileSync(path.join(siteDir, 'block_script.inc'), 'utf8');
    const constants = fs.readFileSync(path.join(siteDir, 'selectors.inc'), 'utf8');
    const header = fs.readFileSync(path.join(siteDir, 'short_form_video.h'), 'utf8');
    const registry = fs.readFileSync(
      path.join(browserRoot, 'src/chrome/browser/sedo/feed_blocker.cc'),
      'utf8',
    );
    const patch = fs.readFileSync(
      path.join(browserRoot, 'patches/extra/sedo/hook-short-form-video.patch'),
      'utf8',
    );
    const prefs = fs.readFileSync(
      path.join(browserRoot, 'src/chrome/browser/sedo/sedo_prefs.h'),
      'utf8',
    );
    const series = fs.readFileSync(path.join(browserRoot, 'patches/series'), 'utf8');

    expect(selectors.pattern).toBe('short-form-video');
    expect(selectors.site).toBe('all-sites');
    expect(js).toContain('pattern: "short-form-video"');
    expect(js).toContain('site: "all-sites"');
    expect(inc).toBe(`R"SEDOJS(${js})SEDOJS"\n`);
    expect(header).toContain('kPattern = "short-form-video"');
    expect(header).toContain('kSite = "all-sites"');
    expect(registry).toContain('ShortFormVideo::BlockScript()');
    expect(patch).toContain('dark-patterns/short-form-video/all-sites/short_form_video.cc');
    expect(patch).toContain('bool sedo_short_form_video = true;');
    expect(patch).toContain('sedo::prefs::kShortFormVideoBlocking');
    expect(prefs).toContain('"sedo.short_form_video_blocking"');
    expect(series).toContain('extra/sedo/hook-short-form-video.patch');

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

  for (const url of [
    'https://example.com/feed',
    'https://www.instagram.com/reels/',
    'https://www.tiktok.com/foryou',
    'https://www.youtube.com/shorts/sedo',
  ]) {
    test(`${new URL(url).hostname} blocks a vertical short video`, async ({ page }) => {
      await openFeed(page, url);
      await load(page, 'vertical-short', [1080, 1920, 30]);
      await blocked(page, 'vertical-short');
      await expect(boxes(page)).toHaveCount(1);
      await expect(page.getByText(label)).toBeVisible();
      await expect(page.locator('#masthead')).toBeVisible();
      await expect(page.locator('#caption')).toBeVisible();
    });
  }

  test('the black box covers the video and uses the JKWD font', async ({ page }) => {
    await openFeed(page);
    await load(page, 'vertical-short', [1080, 1920, 30]);
    await blocked(page, 'vertical-short');
    await settle(page);
    const box = boxes(page).first();
    await expect(box).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    const videoRect = await page.locator('#vertical-short').boundingBox();
    const boxRect = await box.boundingBox();
    expect(boxRect).not.toBeNull();
    expect(Math.abs(boxRect!.x - videoRect!.x)).toBeLessThan(1);
    expect(Math.abs(boxRect!.y - videoRect!.y)).toBeLessThan(1);
    expect(Math.abs(boxRect!.width - videoRect!.width)).toBeLessThan(1);
    expect(Math.abs(boxRect!.height - videoRect!.height)).toBeLessThan(1);
    const text = page.getByText(label);
    await expect(text).toHaveCSS('font-weight', '700');
    await expect(text).toHaveCSS('font-family', /^"Sedo Proxima Nova"/);
    await page.waitForFunction(() => document.fonts.check('700 16px "Sedo Proxima Nova"'));
    const loaded = await page.evaluate(() =>
      [...document.fonts].some(
        (face) => face.family.replaceAll('"', '') === 'Sedo Proxima Nova' && face.status === 'loaded',
      ),
    );
    expect(loaded).toBe(true);
  });

  test('a page under strict CSP still shows the box', async ({ page }) => {
    const html = fs
      .readFileSync(path.join(proofDir, 'fixtures', 'feed.html'), 'utf8')
      .replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="style-src 'none'; font-src 'none'">`);
    await page.addInitScript({ path: blockScript });
    await page.route('**/*', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
    );
    await page.goto('https://strict.example/', { waitUntil: 'load' });
    await page.evaluate(() => {
      const video = document.getElementById('vertical-short') as HTMLVideoElement;
      video.style.width = '180px';
      video.style.height = '320px';
      for (const [name, value] of Object.entries({
        readyState: 1,
        videoWidth: 720,
        videoHeight: 1280,
        duration: 20,
      })) {
        Object.defineProperty(video, name, { configurable: true, get: () => value });
      }
      video.dispatchEvent(new Event('loadedmetadata'));
    });
    await blocked(page, 'vertical-short');
    await expect(page.getByText(label)).toBeVisible();
    await expect(boxes(page).first()).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  });

  test('3 minutes is the longest short video', async ({ page }) => {
    await openFeed(page);
    await load(page, 'vertical-short', [720, 1280, 180]);
    await load(page, 'vertical-long', [720, 1280, 181]);
    await blocked(page, 'vertical-short');
    await kept(page, 'vertical-long');
  });

  test('a 4:5 portrait short is blocked', async ({ page }) => {
    await openFeed(page);
    await load(page, 'vertical-short', [1080, 1350, 45]);
    await blocked(page, 'vertical-short');
  });

  test('landscape, square, long, and live videos stay', async ({ page }) => {
    await openFeed(page);
    await load(page, 'landscape-short', [1920, 1080, 30]);
    await load(page, 'square-short', [1080, 1080, 30]);
    await load(page, 'vertical-long', [1080, 1920, 600]);
    await load(page, 'vertical-live', [1080, 1920, Infinity]);
    await settle(page);
    for (const id of ['landscape-short', 'square-short', 'vertical-long', 'vertical-live', 'unloaded']) {
      await kept(page, id);
    }
    await expect(boxes(page)).toHaveCount(0);
  });

  test('a portrait camera stream stays', async ({ page }) => {
    await openFeed(page);
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 320;
      const context = canvas.getContext('2d')!;
      const draw = () => {
        context.fillStyle = `hsl(${Date.now() % 360} 60% 50%)`;
        context.fillRect(0, 0, 180, 320);
        requestAnimationFrame(draw);
      };
      draw();
      const video = document.getElementById('camera') as HTMLVideoElement;
      video.srcObject = canvas.captureStream(30);
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    const size = await page.evaluate(() => {
      const video = document.getElementById('camera') as HTMLVideoElement;
      return [video.videoWidth, video.videoHeight, video.paused];
    });
    expect(size).toEqual([180, 320, false]);
    await kept(page, 'camera');
  });

  test('a blocked video is paused when the page plays it', async ({ page }) => {
    await openFeed(page);
    await load(page, 'vertical-short', [1080, 1920, 30]);
    await blocked(page, 'vertical-short');
    await page.evaluate(() => {
      const video = document.getElementById('vertical-short') as HTMLVideoElement;
      video.play().catch(() => {});
    });
    await expect
      .poll(() =>
        page.evaluate(() => (document.getElementById('vertical-short') as HTMLVideoElement).paused),
      )
      .toBe(true);
  });

  test('a short video inserted later is blocked', async ({ page }) => {
    await openFeed(page);
    await page.evaluate(() => {
      const video = document.createElement('video');
      video.id = 'late-short';
      video.width = 180;
      video.height = 320;
      document.querySelector('main')!.prepend(video);
    });
    await load(page, 'late-short', [1080, 1920, 15]);
    await blocked(page, 'late-short');
    await expect(boxes(page)).toHaveCount(1);
  });

  test('a short video inside a closed shadow root is blocked', async ({ page }) => {
    await openFeed(page);
    const paused = await page.evaluate(() => {
      const host = document.getElementById('host')!;
      const root = host.attachShadow({ mode: 'closed' });
      const video = document.createElement('video');
      video.width = 180;
      video.height = 320;
      root.append(video);
      return new Promise<string | null>((resolve) => {
        queueMicrotask(() => {
          (window as unknown as { setMetadata: (...args: unknown[]) => void }).setMetadata(
            video,
            1080,
            1920,
            25,
          );
          requestAnimationFrame(() => resolve(video.getAttribute('data-sedo-short-form')));
        });
      });
    });
    expect(paused).toBe('blocked');
    await expect(boxes(page)).toHaveCount(1);
  });

  test('a player that switches to a landscape video is released', async ({ page }) => {
    await openFeed(page);
    await load(page, 'vertical-short', [1080, 1920, 30]);
    await blocked(page, 'vertical-short');
    await load(page, 'vertical-short', [1920, 1080, 30]);
    await kept(page, 'vertical-short');
    await expect(boxes(page)).toHaveCount(0);
  });

  test('a removed video drops its box', async ({ page }) => {
    await openFeed(page);
    await load(page, 'vertical-short', [1080, 1920, 30]);
    await blocked(page, 'vertical-short');
    await expect(boxes(page)).toHaveCount(1);
    await page.evaluate(() => document.getElementById('vertical-short')!.remove());
    await expect(boxes(page)).toHaveCount(0);
  });

  test('the box is cut to its scrolling container', async ({ page }) => {
    await openFeed(page);
    await load(page, 'scrolled-short', [1080, 1920, 30]);
    await blocked(page, 'scrolled-short');
    await settle(page);
    const scroller = await page.locator('#scroller').boundingBox();
    const box = await boxes(page).first().boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(scroller!.y + 119);
    expect(box!.y + box!.height).toBeLessThanOrEqual(scroller!.y + scroller!.height + 0.5);
    expect(box!.height).toBeLessThan(100);
  });
});
