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

interface Ray { from: Point; toward: Point }

// Where a ray first meets a mesh set directly on the matched elements: how far it went and the world
// normal of the face it hit. Null if it meets none.
const firstHit = (page: Page, { from, toward, selector }: Ray & { selector: string }) => page.evaluate(
  ({ origin, direction, elSelector }) => {
    const meshes = [...document.querySelectorAll<Entity>(elSelector)]
      .flatMap(el => Object.values(el.object3DMap).filter(object => object instanceof THREE.Mesh));
    const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize());
    const [hit] = ray.intersectObjects(meshes, false);
    if (!hit?.face) return null;
    const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
    return { distance: hit.distance, normal: normal.toArray().map(n => Math.round(n * 1000) / 1000 + 0) };
  },
  { origin: from, direction: toward, elSelector: selector }
);

// How far a ray travels before it meets a wall, or null if it meets none.
const wallDistance = async (page: Page, ray: Ray) =>
  (await firstHit(page, { ...ray, selector: `.${COLLIDABLE}` }))?.distance ?? null;

interface MeshRef { selector: string; objectName: string }

// How far a mesh's texture coordinates reach in U and V. With uv-scale 1 that's its size in meters.
const uvSpan = (page: Page, { selector, objectName }: MeshRef) => page.evaluate(({ elSelector, name }) => {
  const mesh = document.querySelector<Entity>(elSelector)?.getObject3D(name) as Mesh | undefined;
  if (!mesh) throw new Error(`No ${name} mesh on ${elSelector}.`);
  const uv = mesh.geometry.getAttribute('uv');
  const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
  const vs = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
  // Rounded so float noise doesn't count.
  return [Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)]
    .map(span => Math.round(span * 1000) / 1000);
}, { elSelector: selector, name: objectName });

// The distinct directions a mesh's faces point in the world, rounded so float noise doesn't count.
const worldNormals = (page: Page, { selector, objectName }: MeshRef) => page.evaluate(({ elSelector, name }) => {
  const mesh = document.querySelector<Entity>(elSelector)?.getObject3D(name) as Mesh | undefined;
  if (!mesh) throw new Error(`No ${name} mesh on ${elSelector}.`);
  const normals = mesh.geometry.getAttribute('normal');
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const rounded = Array.from({ length: normals.count }, (_, i) => new THREE.Vector3()
    .fromBufferAttribute(normals, i)
    .applyNormalMatrix(normalMatrix)
    .toArray()
    .map(n => Math.round(n * 1000) / 1000 + 0)
    .join(' '));
  return [...new Set(rounded)];
}, { elSelector: selector, name: objectName });

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

test.describe('the yellow room', () => {
  test('pushes its back wall 2m out and back', async ({ page }) => {
    const label = 'Push back wall 2m';
    const ray = { from: [-3, 1, -4], toward: [0, 0, -1] } satisfies Ray;
    await openDemo(page);

    const before = await wallDistance(page, ray);
    await clickCheckAndRebuild(page, label);
    const pushed = await wallDistance(page, ray);
    await clickCheckAndRebuild(page, label);
    const back = await wallDistance(page, ray);

    expect(before).toBeCloseTo(3);
    expect(pushed).toBeCloseTo(5);
    expect(back).toBeCloseTo(3);
  });

  test('raises its back corner 1m above the room and lowers it again', async ({ page }) => {
    const label = 'Raise corner 1m';
    const wallTop = async () => (await surfaces(page, '#yellowBackWall'))[0]?.box[4];
    await openDemo(page);

    const before = await wallTop();
    await clickCheckAndRebuild(page, label);
    const raised = await wallTop();
    await clickCheckAndRebuild(page, label);
    const lowered = await wallTop();

    expect([before, raised, lowered]).toEqual([3, 4, 3]);
  });

  test('halves its floor tiles and restores them', async ({ page }) => {
    const label = 'Halve floor tiles';
    const floor = { selector: '#yellowFloor', objectName: 'floor' };
    await openDemo(page);

    const before = await uvSpan(page, floor);
    await clickCheckAndRebuild(page, label);
    const halved = await uvSpan(page, floor);
    await clickCheckAndRebuild(page, label);
    const restored = await uvSpan(page, floor);

    // Twice the texture coordinates over the same floor draws each tile half the size.
    expect(halved).toEqual(before.map(span => 2 * span));
    expect(restored).toEqual(before);
  });
});

// A ray from the navy room's center through its door, and how far away the door is.
const throughNavyDoor = async (page: Page) => {
  const { ray, doorDistance } = await page.evaluate(() => {
    const roomEl = document.getElementById('navyRoom') as Entity;
    const doorEl = document.querySelector<Entity>('a-portal[from="#navyDoor"]');
    if (!doorEl) throw new Error('No portal from #navyDoor.');
    roomEl.object3D.updateMatrixWorld(true);
    const center = roomEl.object3D.localToWorld(new THREE.Vector3(1.5, 1, 1.5));
    const door = doorEl.object3D.getWorldPosition(new THREE.Vector3()).setY(1);
    const distance = door.distanceTo(center);
    return { ray: { from: center.toArray(), toward: door.sub(center).toArray() }, doorDistance: distance };
  });
  return { doorDistance, wallDistance: await wallDistance(page, ray) };
};

test('grows the navy building 1.5x with its door still open', async ({ page }) => {
  const floor = '#navyRoom > a-floor';
  const area = ({ box: [minX = 0, , minZ = 0, maxX = 0, , maxZ = 0] }: { box: number[] }) =>
    (maxX - minX) * (maxZ - minZ);
  await openDemo(page);

  const [before] = await surfaces(page, floor);
  const doorBefore = await throughNavyDoor(page);
  await clickCheckAndRebuild(page, 'Grow the navy building 1.5x');
  const [after] = await surfaces(page, floor);
  const doorAfter = await throughNavyDoor(page);

  expect(before && after && area(after) / area(before)).toBeCloseTo(2.25);
  // Through an open door the ray leaves the building and only stops well past it.
  expect(doorBefore.wallDistance).toBeGreaterThan(doorBefore.doorDistance + 1);
  expect(doorAfter.wallDistance).toBeGreaterThan(doorAfter.doorDistance + 1);
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

  test('turns off and on with its toggle', async ({ page }) => {
    const intoWall = async () => {
      await movePlayer(page, [0, 1.6, 2]);
      await movePlayer(page, [0, 1.6, -1]);
      return (await playerPosition(page))[2];
    };
    await openDemo(page);

    await clickCheck(page, 'Disable wall collision');
    const whileOff = await intoWall();
    await clickCheck(page, 'Enable wall collision');
    const whileOn = await intoWall();

    expect([whileOff, whileOn]).toEqual([-1, 2]);
  });

  test('stops the player at a window', async ({ page }) => {
    await openDemo(page);
    await movePlayer(page, [3, 1.6, 2]);

    await movePlayer(page, [3, 1.6, -1]);

    expect((await playerPosition(page))[2]).toBeCloseTo(2);
  });
});

// The white spheres' claims. Reading the scene changes nothing, so they share one page load.
test.describe('the info spheres', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const { baseURL, viewport } = testInfo.project.use;
    page = await browser.newPage({ baseURL, viewport });
    await openDemo(page);
  });

  test.afterAll(() => page.close());

  test('an outside room\'s walls face out', async () => {
    const hit = await firstHit(page, { from: [0, 1, 3], toward: [0, 0, -1], selector: '#redShell > a-wall' });

    expect(hit?.distance).toBeCloseTo(3);
    expect(hit?.normal).toEqual([0, 0, 1]);
  });

  test('a window keeps the wall under its sill solid', async () => {
    const toward = [0, 0, -1] satisfies Point;
    const walls = 'a-wall';

    const belowSill = await firstHit(page, { from: [3, 0.5, 3], toward, selector: walls });
    const throughWindow = await firstHit(page, { from: [3, 1.4, 3], toward, selector: walls });

    expect(belowSill?.distance).toBeCloseTo(3);
    expect(throughWindow?.distance).toBeGreaterThan(3);
  });

  test('rooms sharing a wall plane get a doorway with no depth', async () => {
    const [portal] = await meshCounts(page, 'a-portal[from="#blueBack"]');

    // From the blue room, through the doorway, to the green room's back wall.
    const distance = await wallDistance(page, { from: [3, 1, -5], toward: [0, 0, -1] });

    expect(portal?.count).toBe(0);
    expect(distance).toBeCloseTo(7);
  });

  test('a wall\'s children sit in its own space', async () => {
    const boxes = await page.evaluate(() => [...document.querySelectorAll<Entity>('#greenBackWall > a-box')]
      .map(boxEl => boxEl.object3D.getWorldPosition(new THREE.Vector3()).toArray()
        .map(n => Math.round(n * 1000) / 1000)));

    // The wall starts at (1, 0, -12) and runs along x, so each box is offset from that corner.
    expect(boxes).toEqual([[2, 1.4, -12], [3.5, 1.7, -12], [5, 1.4, -12]]);
  });

  test('uv-scale 1 tiles a texture per meter, and material repeat stretches it', async () => {
    const wall = { selector: '#greenTexturedWall', objectName: 'wallMesh' };

    const span = await uvSpan(page, wall);
    const repeat = await page.evaluate(() => {
      const mesh = (document.getElementById('greenTexturedWall') as Entity).getObject3D('wallMesh') as Mesh;
      return (mesh.material as MeshStandardMaterial).map?.repeat.toArray();
    });

    // The wall is 5m long and 3m high.
    expect(span).toEqual([5, 3]);
    expect(repeat).toEqual([0.5, 0.5]);
  });

  test('an outside room\'s ceiling is a roof that faces up', async () => {
    const normals = await worldNormals(page, { selector: '#limeRoom > a-ceiling', objectName: 'ceiling' });

    expect(normals).toEqual(['0 1 0']);
  });

  test('a concave room\'s floor and ceiling cover only the U', async () => {
    const arm = [-21, 1, -6] satisfies Point;
    const notch = [-18, 1, -6] satisfies Point;
    const down = [0, -1, 0] satisfies Point;
    const up = [0, 1, 0] satisfies Point;
    const floor = '#magentaRoom > a-floor';
    const ceiling = '#magentaRoom > a-ceiling';

    const hits = await Promise.all([
      firstHit(page, { from: arm, toward: down, selector: floor }),
      firstHit(page, { from: notch, toward: down, selector: floor }),
      firstHit(page, { from: arm, toward: up, selector: ceiling }),
      firstHit(page, { from: notch, toward: up, selector: ceiling })
    ]);

    const [armFloor, notchFloor, armCeiling, notchCeiling] = hits;
    expect(armFloor?.distance).toBeCloseTo(1);
    expect(notchFloor).toBeNull();
    expect(armCeiling?.distance).toBeCloseTo(1.8);
    expect(notchCeiling).toBeNull();
  });

  test('a portal\'s surfaces tile their texture per meter', async () => {
    const span = await uvSpan(page, { selector: 'a-portal[from="#magentaDoor"] > a-floor', objectName: 'floor' });

    // The tunnel is 1.2m wide and 1m deep.
    expect(span.toSorted()).toEqual([1, 1.2]);
  });
});
