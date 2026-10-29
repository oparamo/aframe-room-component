import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
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

// Where each mesh under the matched elements sits in the world and its color, rounded so float noise
// doesn't count as a change.
const surfaces = (page: Page, selector: string) => page.evaluate((elSelector) => {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return [...document.querySelectorAll<Entity>(elSelector)].flatMap((el) => {
    const meshes: Mesh[] = [];
    el.object3D.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object as Mesh);
    });
    return meshes.map((mesh) => {
      const box = new THREE.Box3().setFromObject(mesh);
      return {
        box: [...box.min.toArray(), ...box.max.toArray()].map(round),
        color: (mesh.material as MeshStandardMaterial).color.getHexString()
      };
    });
  });
}, selector);

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

test('rebuilding the brown room and its shell changes nothing', async ({ page }) => {
  const brownBuilding = '#brownRoom, #brownShell, a-portal[from="#brownDoor"]';
  await openDemo(page);

  const before = await surfaces(page, brownBuilding);
  await clickCheckAndRebuild(page, 'Rebuild the brown room and its shell. Nothing should change.');
  const after = await surfaces(page, brownBuilding);

  expect(after).toEqual(before);
});

test.describe('the hidden white room', () => {
  test('is built but hidden', async ({ page }) => {
    await openDemo(page);

    const [whiteRoom] = await meshCounts(page, '#whiteRoom');

    expect(whiteRoom?.count).toBeGreaterThan(0);
    expect(await isVisible(page, 'whiteRoom')).toBe(false);
  });

  test('stays hidden after a rebuild', async ({ page }) => {
    await openDemo(page);

    await clickCheckAndRebuild(page, 'Rebuild the hidden white room. It should stay hidden.');

    expect(await isVisible(page, 'whiteRoom')).toBe(false);
  });

  test('shows and hides with its toggle', async ({ page }) => {
    await openDemo(page);

    await clickCheck(page, 'Show the hidden white room');
    const shown = await isVisible(page, 'whiteRoom');
    await clickCheck(page, 'Show the hidden white room');
    const hiddenAgain = await isVisible(page, 'whiteRoom');

    expect([shown, hiddenAgain]).toEqual([true, false]);
  });
});

test('rebuilds the pink room as a triangle without its corner wall, and square with it', async ({ page }) => {
  const label = 'Remove the pink room\'s back-left wall';
  await openDemo(page);

  await clickCheckAndRebuild(page, label);
  const withoutWall = await floorVertexCount(page, 'pinkRoom');
  await clickCheckAndRebuild(page, label);
  const withWall = await floorVertexCount(page, 'pinkRoom');

  expect([withoutWall, withWall]).toEqual([3, 4]);
});

test.describe('the orange room\'s door', () => {
  const ORANGE_ROOM = [-17, 1, 11.5] satisfies Point;
  const PINK_ROOM = [-21.5, 1, 11.5] satisfies Point;
  const EAST = [1, 0, 0] satisfies Point;
  const WEST = [-1, 0, 0] satisfies Point;

  test('starts open into the pink room', async ({ page }) => {
    await openDemo(page);

    // Through the door, across the pink room, to its west wall.
    expect(await wallDistance(page, { from: ORANGE_ROOM, toward: WEST })).toBeCloseTo(6);
  });

  test('moves to the teal room and closes both walls it left', async ({ page }) => {
    await openDemo(page);

    await clickCheckAndRebuild(page, 'Move the orange room\'s door to the teal room');

    expect(await wallDistance(page, { from: ORANGE_ROOM, toward: WEST })).toBeCloseTo(1);
    expect(await wallDistance(page, { from: PINK_ROOM, toward: EAST })).toBeCloseTo(1.5);
    // Through the new door, across the teal room, to its east wall.
    expect(await wallDistance(page, { from: ORANGE_ROOM, toward: EAST })).toBeCloseTo(7);
  });
});

test('opens and closes the doorway from the yellow room to the blue room', async ({ page }) => {
  const label = 'Open doorway to the blue room';
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
