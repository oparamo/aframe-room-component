import { describe, it, expect, beforeAll } from 'vitest';
import type { BuildingEl, PortalEl } from '../../src/types/elements';
import { capOf, isEntity, wallsOf } from '../../src/builders/helpers/structure';
import { buildPortal } from '../../src/builders/portal';
import { buildRoom } from '../../src/builders/room';
import { assertDefined } from '../../src/utils/assert';
import { COLLIDABLE, WALKABLE } from '../../src/utils/surfaceClasses';
import { meshOf, worldCenter, worldNormals, worldPositions } from '../utils/meshes';
import { loadScene, makeCollisionComponent, makeCollisionEl, makeTwoRooms } from '../utils/mocks';
import '../../src/components/collision';

// The golden test: two real rooms joined by a door and a window, built the way the system builds
// them, rooms first. Refactors must leave it passing unchanged.
const scene = makeTwoRooms();

beforeAll(() => {
  buildRoom(scene.near, scene.state);
  buildRoom(scene.far, scene.state);
  buildPortal(scene.door, scene.state);
  buildPortal(scene.window, scene.state);
  // The renderer updates every world matrix each frame, before room-collision ticks.
  for (const el of [scene.near, scene.far, scene.door, scene.window]) el.object3D.updateMatrixWorld(true);
});

const NEAR_CENTER = new THREE.Vector3(2, 0, 2);
const FAR_CENTER = new THREE.Vector3(2, 0, 8);

const portalChild = (portalEl: PortalEl, type: string) =>
  assertDefined([...portalEl.children].filter(isEntity).find(childEl => type in childEl.components), `portal ${type}`);

const sortedPositions = (el: BuildingEl) =>
  worldPositions(meshOf(el)).sort((a, b) => a.join().localeCompare(b.join()));

interface Walk { start: [number, number, number]; step: [number, number, number]; ticks: number }

// Walks a camera rig through the built scene and returns where collision let it end up.
const walk = ({ start, step, ticks }: Walk) => {
  const el = makeCollisionEl({
    position: new THREE.Vector3(...start),
    childCamera: true,
    wallCollidables: scene.withClass(COLLIDABLE),
    floorCollidables: scene.withClass(WALKABLE)
  });
  const comp = makeCollisionComponent(el);
  loadScene(el);
  for (let i = 0; i < ticks; i++) {
    el.object3D.position.add(new THREE.Vector3(...step));
    comp.tick.call(comp);
  }
  return el.object3D.position;
};

describe('two rooms joined by a door and a window', () => {
  describe.each([
    { name: 'near', room: () => scene.near, center: NEAR_CENTER },
    { name: 'far', room: () => scene.far, center: FAR_CENTER }
  ])('the $name room', ({ room, center }) => {
    it('faces every wall into the room', () => {
      // Act
      const walls = wallsOf(room()).map((wallEl) => {
        const mesh = meshOf(wallEl);
        const [normal = []] = worldNormals(mesh);
        return new THREE.Vector3(...normal).dot(center.clone().sub(worldCenter(mesh)).setY(0)) > 0;
      });

      // Assert
      expect(walls).toEqual([true, true, true, true]);
    });

    it('faces the floor up and the ceiling down', () => {
      // Arrange
      const [floor, ceiling] = [capOf(room(), 'floor'), capOf(room(), 'ceiling')];

      // Act
      const floorNormals = worldNormals(meshOf(assertDefined(floor, 'floor')));
      const ceilingNormals = worldNormals(meshOf(assertDefined(ceiling, 'ceiling')));

      // Assert
      expect(floorNormals).toEqual(Array(4).fill([0, 1, 0]));
      expect(ceilingNormals).toEqual(Array(4).fill([0, -1, 0]));
    });
  });

  describe('the door', () => {
    it('joins the two openings, which line up across the gap', () => {
      // Act: the sides span all eight opening corners
      const corners = sortedPositions(portalChild(scene.door, 'sides'));

      // Assert
      expect(corners).toEqual([
        [0.5, 0, 4], [0.5, 0, 6], [0.5, 2, 4], [0.5, 2, 6],
        [1.5, 0, 4], [1.5, 0, 6], [1.5, 2, 4], [1.5, 2, 6]
      ]);
    });

    it('faces the floor up and the ceiling down', () => {
      // Act
      const normals = ['floor', 'ceiling'].map(type => worldNormals(meshOf(portalChild(scene.door, type))));

      // Assert
      expect(normals).toEqual([Array(4).fill([0, 1, 0]), Array(4).fill([0, -1, 0])]);
    });

    it('faces both sides into the doorway, whose middle is at x = 1', () => {
      // Arrange
      const mesh = meshOf(portalChild(scene.door, 'sides'));
      const positions = worldPositions(mesh);

      // Act
      const facing = worldNormals(mesh).map(([nx = 0, ny, nz], i) => {
        const [x = 0] = positions[i] ?? [];
        return { across: Math.sign(nx * (1 - x)), ny, nz };
      });

      // Assert
      expect(facing).toEqual(Array(8).fill({ across: 1, ny: 0, nz: 0 }));
    });

    it('lets the player walk from the near room into the far room', () => {
      // Act
      const end = walk({ start: [1, 0, 2], step: [0, 0, 0.1], ticks: 60 });

      // Assert: stopped by the far room's back wall
      expect(end.z).toBeGreaterThan(6);
      expect(end.z).toBeLessThan(10);
    });
  });

  describe('the window', () => {
    it('joins the two openings from the sill to its top', () => {
      // Act
      const corners = sortedPositions(portalChild(scene.window, 'sides'));

      // Assert
      expect(corners).toEqual([
        [2.5, 0.8, 4], [2.5, 0.8, 6], [2.5, 1.8, 4], [2.5, 1.8, 6],
        [3.5, 0.8, 4], [3.5, 0.8, 6], [3.5, 1.8, 4], [3.5, 1.8, 6]
      ]);
    });

    it('stops the player at the window', () => {
      // Act
      const end = walk({ start: [3, 0, 2], step: [0, 0, 0.1], ticks: 40 });

      // Assert
      expect(end.z).toBeLessThan(4);
    });
  });

  it('stops the player at a wall', () => {
    // Act
    const end = walk({ start: [2, 0, 2], step: [0.1, 0, 0], ticks: 40 });

    // Assert
    expect(end.x).toBeLessThan(4);
  });

  it('stops the player at a wall from outside, where its back faces them', () => {
    // Act: from west of the near room, walking east into its x = 0 wall
    const end = walk({ start: [-2, 0, 2], step: [0.1, 0, 0], ticks: 40 });

    // Assert
    expect(end.x).toBeLessThan(0);
  });
});
