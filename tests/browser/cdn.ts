import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Route } from '@playwright/test';

// The demo loads A-Frame, its textures and A-Frame's label font from A-Frame's CDNs. One stalled
// request would hang the page, so each file is downloaded once, with a timeout and retries, and
// served from disk after that.

const CDN = /^https:\/\/(?:cdn\.)?aframe\.io\//u;
const CACHE_DIR = 'node_modules/.cache/demoCdn';
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_ATTEMPTS = 3;

const fetchBody = async (route: Route) => {
  const response = await route.fetch({ timeout: FETCH_TIMEOUT_MS });
  if (!response.ok()) throw new Error(`${route.request().url()} answered ${String(response.status())}.`);
  return response.body();
};

const fetchWithRetries = async (route: Route, attemptsLeft = FETCH_ATTEMPTS): Promise<Buffer> => {
  try {
    return await fetchBody(route);
  } catch (error) {
    if (attemptsLeft <= 1) throw error;
    return fetchWithRetries(route, attemptsLeft - 1);
  }
};

const fetchToCache = async (route: Route, path: string) => {
  const body = await fetchWithRetries(route);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path, body);
};

// The file name keeps the URL's extension, which is what fulfill reads the content type from. The
// textures load with crossorigin="anonymous", so the response has to allow it.
const serveCdnFromCache = (page: Page) => page.route(CDN, async (route) => {
  const path = join(CACHE_DIR, route.request().url().replace(/[^\w.-]+/gu, '_'));
  if (!existsSync(path)) await fetchToCache(route, path);
  await route.fulfill({ path, headers: { 'access-control-allow-origin': '*' } });
});

export { serveCdnFromCache };
