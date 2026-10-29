import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Mesh, PlaneGeometry } from 'three';
import type { Entity } from '../../src/types/aframe';
import { COLLIDABLE } from '../../src/utils/surfaceClasses';
import { serveCdnLocally } from './cdn';

// Loads example/index.html in headless Chromium and checks the demo the way a person walking it would,
// by reading scene state instead of pixels: headless WebGL and fonts render differently.
// Functions passed to page.evaluate run in the page, so they can only use what they are given.

type Point = [number, number, number];

declare global {
  interface Window { buildCount: number }
}

const DEMO = '/example/index.html';

const openDemo = async (page: Page) => {
  await serveCdnLocally(page);
  await page.addInitScript(() => {
    window.buildCount = 0;
    document.addEventListener('room-building-complete', () => {
      window.buildCount++;
    });
  });
  await page.goto(DEMO);
  await page.waitForFunction(() => window.buildCount > 0);
};

// Resolves after the given number of animation frames, so A-Frame has ticked and rendered.
const nextFrames = (page: Page, count: number) => page.evaluate(frames => new Promise<void>((resolve) => {
  let left = frames;
  const step = () => {
    left--;
    if (left > 0) requestAnimationFrame(step);
    else resolve();
  };
  requestAnimationFrame(step);
}), count);

// Label text is laid out once its font arrives from the CDN, after the first build. Until then a
// text plane's height is NaN.
const untilLabelsLaidOut = async (page: Page) => {
  await page.waitForFunction(() => [...document.querySelectorAll<Entity>('[check-marker] a-entity[text]')]
    .every((textEl) => {
      const plane = textEl.getObject3D('mesh') as Mesh<PlaneGeometry> | undefined;
      return Number.isFinite(plane?.geometry.parameters.height);
    }));
  await nextFrames(page, 2);
};

// Clicks the demo sphere with this label. The cursor's own raycast is too timing-dependent headless,
// so this emits the click the cursor would.
const clickCheck = (page: Page, label: string) => page.evaluate((text) => {
  const markerEl = [...document.querySelectorAll<Entity>('[check-marker]')]
    .find((el) => {
      const marker = el.components['check-marker'] as { data: { label: string } } | undefined;
      return marker?.data.label === text;
    });
  if (!markerEl) throw new Error(`No check labeled "${text}".`);
  markerEl.querySelector<Entity>('a-sphere')?.emit('click');
}, label);

const clickCheckAndRebuild = async (page: Page, label: string) => {
  const builds = await page.evaluate(() => window.buildCount);
  await clickCheck(page, label);
  await page.waitForFunction(before => window.buildCount > before, builds);
};

// How far a level ray travels before it meets a wall, or null if it meets none.
const wallDistance = (page: Page, { from, toward }: { from: Point; toward: Point }) => page.evaluate(
  ({ origin, direction, className }) => {
    const walls = [...document.querySelectorAll<Entity>(`.${className}`)]
      .flatMap(el => Object.values(el.object3DMap).filter(object => object instanceof THREE.Mesh));
    const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize());
    return ray.intersectObjects(walls, false)[0]?.distance ?? null;
  },
  { origin: from, direction: toward, className: COLLIDABLE }
);

// The meshes under each element the selector matches, children's included.
const meshCounts = (page: Page, selector: string) => page.evaluate(
  elSelector => [...document.querySelectorAll<Entity>(elSelector)].map((el) => {
    let count = 0;
    el.object3D.traverse((object) => {
      if (object instanceof THREE.Mesh) count++;
    });
    return { id: el.id, count };
  }),
  selector
);

const floorVertexCount = (page: Page, roomId: string) => page.evaluate((id) => {
  const floor = document.querySelector<Entity>(`#${id} a-floor`)?.getObject3D('floor') as Mesh | undefined;
  return floor?.geometry.attributes.position?.count;
}, roomId);

const isVisible = (page: Page, id: string) => page.evaluate(
  elId => (document.getElementById(elId) as Entity).object3D.visible,
  id
);

const movePlayer = async (page: Page, to: Point) => {
  await page.evaluate((point) => {
    (document.getElementById('player') as Entity).object3D.position.set(...point);
  }, to);
  await nextFrames(page, 2);
};

const playerPosition = (page: Page) => page.evaluate(
  () => (document.getElementById('player') as Entity).object3D.position.toArray()
);

test('loads with only the console errors the demo makes on purpose', async ({ page }) => {
  const errors: string[] = [];
  const pageErrors: Error[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error));

  await openDemo(page);
  await untilLabelsLaidOut(page);

  expect(pageErrors).toEqual([]);
  expect(errors).toEqual([
    expect.stringContaining('#brokenRoom was not built: it needs at least 3 walls.'),
    expect.stringContaining('#typoPortal was not built: from matches no element.'),
    expect.stringContaining('#typoPortal was not built: to matches no element.')
  ]);
});

test('builds every room but the broken one', async ({ page }) => {
  await openDemo(page);

  const rooms = await meshCounts(page, 'a-room');

  expect(rooms.filter(room => room.count === 0).map(room => room.id)).toEqual(['brokenRoom']);
});

test('builds every portal that has surfaces', async ({ page }) => {
  await openDemo(page);

  const portals = await meshCounts(page, 'a-portal:has(> *)');

  expect(portals.length).toBeGreaterThan(0);
  expect(portals.filter(portal => portal.count === 0)).toEqual([]);
});

test.describe('the hidden store', () => {
  test('is built but hidden', async ({ page }) => {
    await openDemo(page);

    const [store] = await meshCounts(page, '#store');

    expect(store?.count).toBeGreaterThan(0);
    expect(await isVisible(page, 'store')).toBe(false);
  });

  test('stays hidden after a rebuild', async ({ page }) => {
    await openDemo(page);

    await clickCheckAndRebuild(page, 'Rebuild the hidden store. It should stay hidden.');

    expect(await isVisible(page, 'store')).toBe(false);
  });

  test('shows and hides with its toggle', async ({ page }) => {
    await openDemo(page);

    await clickCheck(page, 'Show the hidden store');
    const shown = await isVisible(page, 'store');
    await clickCheck(page, 'Show the hidden store');
    const hiddenAgain = await isVisible(page, 'store');

    expect([shown, hiddenAgain]).toEqual([true, false]);
  });
});

test('rebuilds the annex as a triangle without its corner wall, and square with it', async ({ page }) => {
  const label = 'Remove the annex\'s back-left wall';
  await openDemo(page);

  await clickCheckAndRebuild(page, label);
  const withoutWall = await floorVertexCount(page, 'annex');
  await clickCheckAndRebuild(page, label);
  const withWall = await floorVertexCount(page, 'annex');

  expect([withoutWall, withWall]).toEqual([3, 4]);
});

test.describe('the kiosk door', () => {
  const KIOSK = [-17, 1, 11.5] satisfies Point;
  const ANNEX = [-21.5, 1, 11.5] satisfies Point;
  const EAST = [1, 0, 0] satisfies Point;
  const WEST = [-1, 0, 0] satisfies Point;

  test('starts open into the annex', async ({ page }) => {
    await openDemo(page);

    // Through the door, across the annex, to its west wall.
    expect(await wallDistance(page, { from: KIOSK, toward: WEST })).toBeCloseTo(6);
  });

  test('moves to the shed and closes both walls it left', async ({ page }) => {
    await openDemo(page);

    await clickCheckAndRebuild(page, 'Move the kiosk door to the shed');

    expect(await wallDistance(page, { from: KIOSK, toward: WEST })).toBeCloseTo(1);
    expect(await wallDistance(page, { from: ANNEX, toward: EAST })).toBeCloseTo(1.5);
    // Through the new door, across the shed, to its east wall.
    expect(await wallDistance(page, { from: KIOSK, toward: EAST })).toBeCloseTo(7);
  });
});

test('opens and closes the doorway from the pink room to the blue room', async ({ page }) => {
  const label = 'Open doorway to blue room';
  const ray = { from: [-1, 1, -4.5], toward: [1, 0, 0] } satisfies { from: Point; toward: Point };
  await openDemo(page);

  const closed = await wallDistance(page, ray);
  await clickCheckAndRebuild(page, label);
  const opened = await wallDistance(page, ray);
  await clickCheckAndRebuild(page, label);
  const closedAgain = await wallDistance(page, ray);

  expect(closed).toBeCloseTo(1);
  // Open, the ray crosses the blue room to its far wall.
  expect(opened).toBeCloseTo(6);
  expect(closedAgain).toBeCloseTo(1);
});

test.describe('room-collision', () => {
  test('stops the player at a wall', async ({ page }) => {
    await openDemo(page);
    await movePlayer(page, [0, 1.6, 2]);

    await movePlayer(page, [0, 1.6, -1]);

    expect((await playerPosition(page))[2]).toBeCloseTo(2);
  });

  test('lets the player through a door', async ({ page }) => {
    await openDemo(page);
    await movePlayer(page, [-3, 1.6, 2]);

    await movePlayer(page, [-3, 1.6, -3]);

    expect((await playerPosition(page))[2]).toBeCloseTo(-3);
  });
});
