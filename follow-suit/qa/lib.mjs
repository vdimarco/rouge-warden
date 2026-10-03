// Shared parts of the browser checks: the server, the browser, phone pages, layout measures and results.
//
// BASE_URL      check a deployed copy instead of serving dist/
// CHROMIUM_PATH use a Chromium binary that Playwright did not install
// CHROMIUM_ARGS extra launch flags, separated by spaces

import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const HERE = fileURLToPath(new URL('.', import.meta.url));
export const OUT = join(HERE, 'out');
export const DIST = join(HERE, '..', 'dist');
mkdirSync(OUT, { recursive: true });

export const PHONES = [
  [390, 844],
  [375, 667],
  [360, 740],
  [430, 932],
];

/** Serves dist/ unless BASE_URL is set, and launches Chromium. */
export async function startSession() {
  let server = null;
  let base = process.env.BASE_URL;
  if (!base) {
    const { preview } = await import('vite');
    server = await preview({ root: join(HERE, '..'), logLevel: 'silent', preview: { host: '127.0.0.1', port: 4180 } });
    base = server.resolvedUrls.local[0];
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: (process.env.CHROMIUM_ARGS ?? '').split(' ').filter(Boolean),
  });
  const errors = [];
  const results = [];

  return {
    base: base.replace(/\/?$/, '/'),
    browser,
    errors,

    /** A page with a phone-sized screen and touch input. */
    async phone(width = 390, height = 844, options = {}) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        ...options,
      });
      const page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`${width}x${height}: ${message.text()}`);
      });
      page.on('pageerror', (error) => errors.push(`${width}x${height}: ${error.message}`));
      return page;
    },

    async check(name, run) {
      try {
        await run();
        results.push({ name, ok: true });
        console.log(`ok    ${name}`);
      } catch (error) {
        results.push({ name, ok: false });
        console.log(`FAIL  ${name}\n      ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n      ')}`);
      }
    },

    /** Closes everything and returns the number of failed checks. */
    async finish() {
      await browser.close();
      await server?.close();
      const failed = results.filter((result) => !result.ok);
      console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots: ${OUT}`);
      return failed.length;
    },
  };
}

export async function shot(page, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

/** Buttons under 44 by 44 px, and the page size against the screen. */
export async function measureLayout(page) {
  return page.evaluate(() => {
    const small = [...document.querySelectorAll('button, input')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30), w: r.width, h: r.height };
      })
      .filter((b) => b.w < 44 || b.h < 44);
    return {
      small,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerWidth,
      innerHeight,
    };
  });
}

/** Fails when a tap target is small or the page is wider or taller than the screen. */
export async function expectGoodLayout(page, label) {
  const layout = await measureLayout(page);
  const problems = [];
  if (layout.small.length > 0) problems.push(`small targets: ${JSON.stringify(layout.small)}`);
  if (layout.scrollWidth > layout.innerWidth) problems.push(`page is ${layout.scrollWidth} px wide`);
  if (layout.scrollHeight > layout.innerHeight) problems.push(`page is ${layout.scrollHeight} px tall`);
  if (problems.length > 0) throw new Error(`${label} at ${layout.innerWidth}x${layout.innerHeight}: ${problems.join('; ')}`);
}

/** Every file in dist/. */
export function distFiles(dir = DIST) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? distFiles(path) : [path];
  });
}
