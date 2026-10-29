import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Route } from '@playwright/test';

// Serves the demo's CDN files locally, so a slow CDN can't stall a test. The A-Frame script comes
// from the aframe dev dependency, whose version must match the demo's script tag. The label font is
// downloaded once and served from disk after that.

const AFRAME_SCRIPT = /^https:\/\/aframe\.io\/releases\/([^/]+)\/aframe\.min\.js$/u;
const CDN_FILE = /^https:\/\/cdn\.aframe\.io\//u;
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

const serveAframeFromPackage = (page: Page) => page.route(AFRAME_SCRIPT, async (route) => {
  const [, version] = AFRAME_SCRIPT.exec(route.request().url()) ?? [];
  const path = `node_modules/aframe/dist/aframe-v${String(version)}.min.js`;
  if (!existsSync(path)) throw new Error(`The demo loads A-Frame ${String(version)}; install the same aframe version.`);
  await route.fulfill({ path });
});

// The file name keeps the URL's extension, which is what fulfill reads the content type from. A-Frame
// fetches the font from another origin, so the response has to allow it.
const serveCdnFilesFromCache = (page: Page) => page.route(CDN_FILE, async (route) => {
  const path = join(CACHE_DIR, route.request().url().replace(/[^\w.-]+/gu, '_'));
  if (!existsSync(path)) await fetchToCache(route, path);
  await route.fulfill({ path, headers: { 'access-control-allow-origin': '*' } });
});

const serveCdnLocally = async (page: Page) => {
  await serveAframeFromPackage(page);
  await serveCdnFilesFromCache(page);
};

export { serveCdnLocally };
