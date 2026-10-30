import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { Entity } from '../../src/types/aframe';
import type { CollisionScene } from '../../src/types/collision';
import { serveCdnLocally } from './cdn';

// Loads example/index.html in headless Chromium and checks the demo the way a person walking it would,
// by reading scene state instead of pixels: headless WebGL and fonts render differently.
// Functions passed to page.evaluate run in the page, so they can only use what they are given.

type Point = [number, number, number];

declare global {
  interface Window { buildCount: number }
}

const DEMO = '/example/index.html';

// The center of each lot in the demo's grid, by its entity's id.
const LOTS = {
  centerLot: [0, 0, 0],
  redLot: [0, 0, -24],
  navyLot: [24, 0, -24],
  brownLot: [24, 0, 0],
  goldLot: [48, 0, 0],
  cyanLot: [24, 0, 24],
  limeLot: [0, 0, 24],
  whiteLot: [-24, 0, 24],
  purpleLot: [-24, 0, 0],
  magentaLot: [-24, 0, -24]
} satisfies Record<string, Point>;

// The world point for a point measured from the lot's center, the way the demo's markup places things.
const inLot = (lot: keyof typeof LOTS, [x, y, z]: Point): Point => {
  const [centerX, centerY, centerZ] = LOTS[lot];
  return [centerX + x, centerY + y, centerZ + z];
};

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

// How far a ray travels before it meets something room-collision collides with, or null if it meets
// nothing. The demo's level rays run parallel to every floor, so what they meet is a wall.
const wallDistance = (page: Page, { from, toward }: Ray) => page.evaluate(({ origin, direction }) => {
  const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize());
  const [hit] = document.querySelector<CollisionScene>('a-scene')?.systems['room-collision']?.intersect(ray) ?? [];
  return hit?.distance ?? null;
}, { origin: from, direction: toward });

// How far the element's mesh's texture coordinates reach in U and V. With uv-scale 1 that's its size in meters.
const uvSpan = (page: Page, selector: string) => page.evaluate((elSelector) => {
  const mesh = document.querySelector<Entity>(elSelector)?.getObject3D('mesh') as Mesh | undefined;
  if (!mesh) throw new Error(`No mesh on ${elSelector}.`);
  const uv = mesh.geometry.getAttribute('uv');
  const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
  const vs = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
  // Rounded so float noise doesn't count.
  return [Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)]
    .map(span => Math.round(span * 1000) / 1000);
}, selector);

// The distinct directions the element's mesh's faces point in the world, rounded so float noise doesn't count.
const worldNormals = (page: Page, selector: string) => page.evaluate((elSelector) => {
  const mesh = document.querySelector<Entity>(elSelector)?.getObject3D('mesh') as Mesh | undefined;
  if (!mesh) throw new Error(`No mesh on ${elSelector}.`);
  const normals = mesh.geometry.getAttribute('normal');
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const rounded = Array.from({ length: normals.count }, (_, i) => new THREE.Vector3()
    .fromBufferAttribute(normals, i)
    .applyNormalMatrix(normalMatrix)
    .toArray()
    .map(n => Math.round(n * 1000) / 1000 + 0)
    .join(' '));
  return [...new Set(rounded)];
}, selector);

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
  const floor = document.querySelector<Entity>(`#${id} a-floor`)?.getObject3D('mesh') as Mesh | undefined;
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

// From 1m outside each cyan wall to 1m inside it: the collidable front, the hidden west, the hidden
// east that isn't collidable, and the back that isn't either.
const CYAN_WALKS: { from: Point; to: Point }[] = [
  { from: inLot('cyanLot', [0, 1.6, 2.5]), to: inLot('cyanLot', [0, 1.6, 0.5]) },
  { from: inLot('cyanLot', [-3, 1.6, 0]), to: inLot('cyanLot', [-1, 1.6, 0]) },
  { from: inLot('cyanLot', [3, 1.6, 0]), to: inLot('cyanLot', [1, 1.6, 0]) },
  { from: inLot('cyanLot', [0, 1.6, -2.5]), to: inLot('cyanLot', [0, 1.6, -0.5]) }
];

// Puts the player at the point without room-collision judging the jump: re-adding the component
// starts it from where the player stands.
const placePlayer = async (page: Page, at: Point) => {
  await page.evaluate((point) => {
    const playerEl = document.getElementById('player') as Entity;
    playerEl.removeAttribute('room-collision');
    playerEl.object3D.position.set(...point);
    playerEl.setAttribute('room-collision', '');
  }, at);
  await nextFrames(page, 2);
};

// Moves the player by the step, the way a control would, the given number of times, letting room-collision
// judge each one. Returns where they end up.
const walkSteps = async (page: Page, { step, count }: { step: Point; count: number }) => {
  for (let i = 0; i < count; i++) {
    await page.evaluate((offset) => {
      (document.getElementById('player') as Entity).object3D.position.add(new THREE.Vector3(...offset));
    }, step);
    await nextFrames(page, 2);
  }
  return playerPosition(page);
};

// Places the player at `from`, then tries to step to `to`, and says whether a wall stopped them.
const walkInto = async (page: Page, from: Point, to: Point) => {
  await placePlayer(page, from);
  await movePlayer(page, to);
  const [x, , z] = await playerPosition(page);
  if (Math.hypot(x - to[0], z - to[2]) < 0.01) return 'through';
  return 'stopped';
};

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

test('puts each lot where the tests measure from', async ({ page }) => {
  await openDemo(page);

  const lots = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll<Entity>('.lot')]
    .map(lotEl => [lotEl.id, lotEl.object3D.position.toArray()])));

  expect(lots).toEqual(LOTS);
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
  const ORANGE_ROOM = inLot('purpleLot', [-0.5, 1, 0]);
  const PINK_ROOM = inLot('purpleLot', [-5, 1, 0]);
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
  const ray = { from: inLot('redLot', [-1, 1, 2.5]), toward: [1, 0, 0] } satisfies Ray;
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
    const ray = { from: inLot('redLot', [-3, 1, 3]), toward: [0, 0, -1] } satisfies Ray;
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
    const floor = '#yellowFloor';
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

  test('paints its left wall orange, and takes the room\'s material back when the paint is removed', async ({ page }) => {
    const label = 'Paint the left wall orange';
    // Whose material the wall's mesh shows, and its color.
    const wallMaterial = () => page.evaluate(() => {
      const wallEl = document.getElementById('yellowLeftWall') as Entity;
      const roomEl = document.getElementById('yellowRoom') as Entity;
      const material = (wallEl.getObject3D('mesh') as Mesh).material as MeshStandardMaterial;
      const owner = [[wallEl, 'wall'], [roomEl, 'room']] as const;
      return {
        color: material.color.getHexString(),
        from: owner.find(([el]) => el.components.material?.material === material)?.[1] ?? null
      };
    });
    await openDemo(page);

    const before = await wallMaterial();
    await clickCheck(page, label);
    const painted = await wallMaterial();
    await clickCheckAndRebuild(page, label);
    const removed = await wallMaterial();

    expect(before).toEqual({ color: 'ffe680', from: 'room' });
    expect(painted).toEqual({ color: 'f77f00', from: 'wall' });
    expect(removed).toEqual({ color: 'ffe680', from: 'room' });
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
  // Outside the red building's front, and inside it, past the front wall at z = 7.
  const OUTSIDE = inLot('redLot', [0, 1.6, 9]);
  const INSIDE = inLot('redLot', [0, 1.6, 6]);

  test('stops the player at the cyan room\'s collidable walls from outside, hidden or not, and lets them through the others', async ({ page }) => {
    await openDemo(page);

    const ends = [];
    for (const { from, to } of CYAN_WALKS) ends.push(await walkInto(page, from, to));

    expect(ends).toEqual(['stopped', 'stopped', 'through', 'through']);
  });

  test('lets the player through every cyan wall while the room is not collidable', async ({ page }) => {
    const label = 'Turn off collision for the cyan room';
    const walkAll = async () => {
      const ends = [];
      for (const { from, to } of CYAN_WALKS) ends.push(await walkInto(page, from, to));
      return ends;
    };
    await openDemo(page);

    // Switching collision rebuilds nothing; the next ray sees it.
    await clickCheck(page, label);
    const off = await walkAll();
    await clickCheck(page, label);
    const on = await walkAll();

    expect(off).toEqual(['through', 'through', 'through', 'through']);
    expect(on).toEqual(['stopped', 'stopped', 'through', 'through']);
  });

  test('stops the player at a wall', async ({ page }) => {
    await openDemo(page);
    await movePlayer(page, OUTSIDE);

    await movePlayer(page, INSIDE);

    expect((await playerPosition(page))[2]).toBeCloseTo(OUTSIDE[2]);
  });

  test('lets the player through a door', async ({ page }) => {
    const inside = inLot('redLot', [-3, 1.6, 4]);
    await openDemo(page);
    await movePlayer(page, inLot('redLot', [-3, 1.6, 9]));

    await movePlayer(page, inside);

    expect((await playerPosition(page))[2]).toBeCloseTo(inside[2]);
  });

  test('turns off and on with its toggle', async ({ page }) => {
    const intoWall = async () => {
      await movePlayer(page, INSIDE);
      return (await playerPosition(page))[2];
    };
    await openDemo(page);

    await clickCheck(page, 'Disable wall collision');
    await movePlayer(page, OUTSIDE);
    const whileOff = await intoWall();
    await clickCheck(page, 'Enable wall collision');
    // Back out through the wall, which walls now block from inside too.
    await placePlayer(page, OUTSIDE);
    const whileOn = await intoWall();

    expect([whileOff, whileOn]).toEqual([INSIDE[2], OUTSIDE[2]]);
  });

  test('stops the player at the lime room\'s walls, which are lower than the torso', async ({ page }) => {
    await openDemo(page);

    const end = await walkInto(page, inLot('limeLot', [0, 1.6, 2]), inLot('limeLot', [0, 1.6, 0.5]));

    expect(end).toBe('stopped');
  });

  test('lets the player up the gold building\'s stepped door and inside', async ({ page }) => {
    await openDemo(page);
    await placePlayer(page, inLot('goldLot', [-6, 1.6, 0]));

    const onStep = await walkSteps(page, { step: [0.25, 0, 0], count: 9 });
    const inside = await walkSteps(page, { step: [0.25, 0, 0], count: 7 });

    // On the 0.2m sill the camera stands its eye height above it.
    expect(onStep[0]).toBeCloseTo(inLot('goldLot', [-3.75, 0, 0])[0]);
    expect(onStep[1]).toBeCloseTo(1.8);
    expect(inside[0]).toBeCloseTo(inLot('goldLot', [-2, 0, 0])[0]);
    expect(inside[1]).toBeCloseTo(1.6);
  });

  test('stops the player at the gold building\'s windows, low sill and high', async ({ page }) => {
    await openDemo(page);

    const ends = [];
    for (const x of [-1.5, 1.5]) ends.push(await walkInto(page, inLot('goldLot', [x, 1.6, 4]), inLot('goldLot', [x, 1.6, 2])));

    expect(ends).toEqual(['stopped', 'stopped']);
  });

  test('keeps the player its radius from both walls of a corner', async ({ page }) => {
    // The gold room's back right corner is at (3.5, -2.5) in its lot.
    const corner = inLot('goldLot', [3.5, 0, -2.5]);
    await openDemo(page);
    await placePlayer(page, inLot('goldLot', [2, 1.6, -1]));

    const [x, , z] = await walkSteps(page, { step: [0.1, 0, -0.1], count: 20 });

    expect(corner[0] - x).toBeCloseTo(0.4, 2);
    expect(z - corner[2]).toBeCloseTo(0.4, 2);
  });

  test('keeps the player its radius from a wall walked toward at a shallow angle', async ({ page }) => {
    // The gold room's back wall is at z = -2.5 in its lot.
    const backZ = inLot('goldLot', [0, 0, -2.5])[2];
    await openDemo(page);
    await placePlayer(page, inLot('goldLot', [-2.5, 1.6, -1.5]));

    const [, , z] = await walkSteps(page, { step: [0.1, 0, -0.02], count: 50 });

    expect(z - backZ).toBeCloseTo(0.4, 2);
  });

  test('steps the player back down onto the grass outside the stepped door, so the picture window still stops them', async ({ page }) => {
    // The shell's south wall, where the picture window is, is at z = 3 in the lot.
    const shellZ = inLot('goldLot', [0, 0, 3])[2];
    await openDemo(page);
    await placePlayer(page, inLot('goldLot', [-2, 1.6, 0]));

    // Out through the door, then round to the picture window and into it.
    const [, outsideY] = await walkSteps(page, { step: [-0.5, 0, 0], count: 8 });
    await walkSteps(page, { step: [0, 0, 0.5], count: 10 });
    await walkSteps(page, { step: [0.5, 0, 0], count: 9 });
    const [, , z] = await walkSteps(page, { step: [0, 0, -0.2], count: 10 });

    // The grass is 1cm below the floors. A blocked step can stop up to one step short of the radius.
    expect(outsideY).toBeCloseTo(1.59);
    expect(z - shellZ).toBeGreaterThan(0.39);
  });

  test('stops the player at a window', async ({ page }) => {
    const outside = inLot('redLot', [3, 1.6, 9]);
    await openDemo(page);
    await movePlayer(page, outside);

    await movePlayer(page, inLot('redLot', [3, 1.6, 6]));

    expect((await playerPosition(page))[2]).toBeCloseTo(outside[2]);
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
    const hit = await firstHit(page, { from: inLot('redLot', [0, 1, 10]), toward: [0, 0, -1], selector: '#redShell > a-wall' });

    expect(hit?.distance).toBeCloseTo(3);
    expect(hit?.normal).toEqual([0, 0, 1]);
  });

  test('a window keeps the wall under its sill solid', async () => {
    const toward = [0, 0, -1] satisfies Point;
    const walls = 'a-wall';

    const belowSill = await firstHit(page, { from: inLot('redLot', [3, 0.5, 10]), toward, selector: walls });
    const throughWindow = await firstHit(page, { from: inLot('redLot', [3, 1.4, 10]), toward, selector: walls });

    expect(belowSill?.distance).toBeCloseTo(3);
    expect(throughWindow?.distance).toBeGreaterThan(3);
  });

  test('rooms sharing a wall plane get a doorway with no depth', async () => {
    const [portal] = await meshCounts(page, 'a-portal[from="#blueBack"]');

    // From the blue room, through the doorway, to the green room's back wall.
    const distance = await wallDistance(page, { from: inLot('redLot', [3, 1, 2]), toward: [0, 0, -1] });

    expect(portal?.count).toBe(0);
    expect(distance).toBeCloseTo(7);
  });

  test('a wall\'s children sit in its own space', async () => {
    const boxes = await page.evaluate(() => [...document.querySelectorAll<Entity>('#greenBackWall > a-box')]
      .map(boxEl => boxEl.object3D.getWorldPosition(new THREE.Vector3()).toArray()
        .map(n => Math.round(n * 1000) / 1000)));

    // The wall starts at (1, 0, -5) in its lot and runs along x, so each box is offset from that corner.
    expect(boxes).toEqual(([[2, 1.4, -5], [3.5, 1.7, -5], [5, 1.4, -5]] satisfies Point[])
      .map(box => inLot('redLot', box)));
  });

  test('uv-scale 1 tiles a texture per meter, and material repeat stretches it', async () => {
    const span = await uvSpan(page, '#greenTexturedWall');
    const repeat = await page.evaluate(() => {
      const mesh = (document.getElementById('greenTexturedWall') as Entity).getObject3D('mesh') as Mesh;
      return (mesh.material as MeshStandardMaterial).map?.repeat.toArray();
    });

    // The wall is 5m long and 3m high.
    expect(span).toEqual([5, 3]);
    expect(repeat).toEqual([0.5, 0.5]);
  });

  test('an outside room\'s ceiling is a roof that faces up', async () => {
    const normals = await worldNormals(page, '#limeRoom > a-ceiling');

    expect(normals).toEqual(['0 1 0']);
  });

  test('a concave room\'s floor and ceiling cover only the U', async () => {
    const arm = inLot('magentaLot', [-3, 1, 2]);
    const notch = inLot('magentaLot', [0, 1, 2]);
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
    const span = await uvSpan(page, 'a-portal[from="#magentaDoor"] > a-floor');

    // The tunnel is 1.2m wide and 1m deep.
    expect(span.toSorted()).toEqual([1, 1.2]);
  });
});
