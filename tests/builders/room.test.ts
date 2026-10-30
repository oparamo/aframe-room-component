import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Material, Mesh } from 'three';
import type { Entity } from '../../src/types/aframe';
import type { WallEl } from '../../src/types/elements';
import { capOf, wallsOf } from '../../src/builders/helpers/structure';
import { buildRoom } from '../../src/builders/room';
import { assertDefined } from '../../src/utils/assert';
import { COLLIDABLE } from '../../src/utils/surfaceClasses';
import { meshOf, worldCenter, worldNormals } from '../utils/meshes';
import {
  makeBuildState, makeOpening, makePortal, makeRoom, makeSquareRoom, makeTransformedRoom, makeWall
} from '../utils/mocks';

afterEach(() => vi.restoreAllMocks());

const floorOf = (room: Parameters<typeof capOf>[0]) => assertDefined(capOf(room, 'floor'), 'floor');
const firstWallOf = (room: Parameters<typeof wallsOf>[0]) => assertDefined(wallsOf(room)[0], 'first wall');
const colliderOf = (el: Entity) => assertDefined(el.getObject3D('collider') as Mesh | undefined, 'collider');

// A square room whose first wall holds an opening for a window 1 m wide, with its sill at 0.5 m.
const makeWindowRoom = () => {
  const openingEl = makeOpening();
  const portalEl = makePortal({ at: { x: 2.5 }, height: 1, floorHeight: 0.5 });
  const room = makeRoom([makeWall({ openings: [openingEl] }), makeWall({ x: 5 }), makeWall({ x: 5, z: 5 }), makeWall({ z: 5 })]);
  return { room, openingEl, state: makeBuildState({ links: [[openingEl, portalEl]] }) };
};

const openingColliderOf = (openingEl: ReturnType<typeof makeOpening>) => openingEl.getObject3D('collider') as Mesh | undefined;

describe('buildRoom', () => {
  describe('with implicit wall positions', () => {
    it('creates a mesh on each wall', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      for (const wall of wallsOf(room)) {
        expect(meshOf(wall).geometry.getAttribute('position').count).toBeGreaterThan(0);
      }
    });

    it('creates a mesh for the floor', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(meshOf(floorOf(room))).toBeDefined();
    });

    it('creates a mesh for the ceiling', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(meshOf(assertDefined(capOf(room, 'ceiling'), 'ceiling'))).toBeDefined();
    });

    it('turns the last wall to run back to the first wall', () => {
      // Arrange: the last wall's corner is (0, 0, 5) and the first wall's is (0, 0, 0)
      const room = makeSquareRoom();

      // Act
      buildRoom(room, makeBuildState());

      // Assert: running toward -z means a quarter turn
      expect(wallsOf(room).at(-1)?.object3D.rotation.y).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('wall facing', () => {
    const SQUARE: [number, number][] = [[0, 0], [5, 0], [5, 5], [0, 5]];
    const roomCenter = new THREE.Vector3(2.5, 0, 2.5);

    // Whether each wall's front faces the middle of the room.
    const facesCenter = (wallEl: WallEl) => {
      const mesh = meshOf(wallEl);
      const toCenter = roomCenter.clone().sub(worldCenter(mesh)).setY(0);
      return new THREE.Vector3(...assertDefined(worldNormals(mesh)[0], 'wall normal')).dot(toCenter) > 0;
    };

    it.each([
      { outside: false, corners: SQUARE, inward: true },
      { outside: false, corners: SQUARE.toReversed(), inward: true },
      { outside: true, corners: SQUARE, inward: false },
      { outside: true, corners: SQUARE.toReversed(), inward: false }
    ])('faces walls inward=$inward when outside=$outside, corners $corners', ({ outside, corners, inward }) => {
      // Arrange
      const room = makeRoom(corners.map(([x, z]) => makeWall({ x, z })), { outside });

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(wallsOf(room).map(facesCenter)).toEqual(Array(corners.length).fill(inward));
    });
  });

  describe('with width/length shorthand', () => {
    it('positions the four walls to match width and length', () => {
      // Arrange
      const room = makeRoom([makeWall(), makeWall(), makeWall(), makeWall()], { width: 4, length: 6 });

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(wallsOf(room).map(wall => [wall.object3D.position.x, wall.object3D.position.z])).toEqual([[0, 0], [4, 0], [4, 6], [0, 6]]);
    });
  });

  describe('outside room', () => {
    it('keeps each wall at the same corner when a width/length room is rebuilt', () => {
      // Arrange
      const room = makeRoom([makeWall(), makeWall(), makeWall(), makeWall()], { width: 4, length: 6, outside: true });
      const corners = () => wallsOf(room).map(wall => ({ x: wall.object3D.position.x, z: wall.object3D.position.z }));
      buildRoom(room, makeBuildState());
      const firstBuild = corners();

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(corners()).toEqual(firstBuild);
    });
  });

  describe('cap corners', () => {
    it('lifts each ceiling corner to its own wall height', () => {
      // Arrange
      const walls = [
        makeWall({ height: 2 }),
        makeWall({ x: 4, height: 2 }),
        makeWall({ x: 4, z: 4, height: 4 }),
        makeWall({ z: 4, y: 1, height: 2 })
      ];
      const room = makeRoom(walls);

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      const pos = meshOf(assertDefined(capOf(room, 'ceiling'), 'ceiling')).geometry.getAttribute('position');
      const heights = Array.from({ length: pos.count }, (_, i) => [pos.getX(i), pos.getY(i), pos.getZ(i)]);
      expect(heights).toEqual(expect.arrayContaining([[0, 2, 0], [4, 2, 0], [4, 4, 4], [0, 3, 4]]));
    });
  });

  describe('openings', () => {
    it('records the corners of an opening with a portal', () => {
      // Arrange
      const { room, openingEl, state } = makeWindowRoom();

      // Act
      buildRoom(room, state);

      // Assert: left bottom, left top, right bottom, right top, on the wall at z = 0
      expect(state.cornersOf.get(openingEl)?.map(corner => corner.toArray())).toEqual([
        [2, 0.5, 0], [2, 1.5, 0], [3, 0.5, 0], [3, 1.5, 0]
      ]);
    });

    it('drops the corners once the opening has no portal', () => {
      // Arrange
      const { room, openingEl, state } = makeWindowRoom();
      buildRoom(room, state);
      state.portalOf.delete(openingEl);

      // Act
      buildRoom(room, state);

      // Assert
      expect(state.cornersOf.has(openingEl)).toBe(false);
    });
  });

  describe('opening collider', () => {
    it('creates an invisible collidable mesh for openings with floorHeight > 0', () => {
      // Arrange
      const { room, openingEl, state } = makeWindowRoom();

      // Act
      buildRoom(room, state);

      // Assert
      expect(openingColliderOf(openingEl)?.visible).toBe(false);
      expect(openingEl.classList.contains(COLLIDABLE)).toBe(true);
    });

    it('spans the opening in world space', () => {
      // Arrange
      const { room, openingEl, state } = makeWindowRoom();

      // Act
      buildRoom(room, state);

      // Assert
      const collider = assertDefined(openingColliderOf(openingEl), 'opening collider');
      collider.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(collider);
      expect([box.min.toArray(), box.max.toArray()]).toEqual([[2, 0.5, 0], [3, 1.5, 0]]);
    });

    it('keeps the collider on rebuild, freeing the old geometry but not the shared material', () => {
      // Arrange
      const { room, openingEl, state } = makeWindowRoom();
      buildRoom(room, state);
      const collider = assertDefined(openingColliderOf(openingEl), 'opening collider');
      const oldGeometry = collider.geometry;
      const geometryDisposed = vi.fn();
      const materialDisposed = vi.fn();
      oldGeometry.addEventListener('dispose', geometryDisposed);
      [collider.material].flat()[0]?.addEventListener('dispose', materialDisposed);

      // Act
      buildRoom(room, state);

      // Assert
      expect(openingColliderOf(openingEl)).toBe(collider);
      expect(collider.geometry).not.toBe(oldGeometry);
      expect(geometryDisposed).toHaveBeenCalledOnce();
      expect(materialDisposed).not.toHaveBeenCalled();
    });

    it('leaves no collider or class on an opening in a wall that is not collidable', () => {
      // Arrange
      const { room, openingEl, state } = makeWindowRoom();
      buildRoom(room, state);
      assertDefined(openingEl.parentEl.getAttribute('wall'), 'wall data').collidable = false;

      // Act
      buildRoom(room, state);

      // Assert
      expect(openingColliderOf(openingEl)).toBeUndefined();
      expect(openingEl.classList.contains(COLLIDABLE)).toBe(false);
    });
  });

  describe('colliders', () => {
    it('gives each wall and the floor an invisible, double-sided collider on its own geometry', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      for (const el of [...wallsOf(room), floorOf(room)]) {
        const collider = colliderOf(el);
        expect(collider.geometry).toBe(meshOf(el).geometry);
        expect(collider.visible).toBe(false);
        expect((collider.material as Material).side).toBe(THREE.DoubleSide);
      }
    });

    it('gives the ceiling none, since nothing collides with it', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(assertDefined(capOf(room, 'ceiling'), 'ceiling').getObject3D('collider')).toBeUndefined();
    });

    it('keeps the collider on the new geometry across a rebuild', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room, makeBuildState());
      const wall = firstWallOf(room);
      const collider = colliderOf(wall);

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(colliderOf(wall)).toBe(collider);
      expect(collider.geometry).toBe(meshOf(wall).geometry);
    });

    it.each([
      { owner: 'the wall', wall: { collidable: false }, room: {} },
      { owner: 'its room', wall: {}, room: { collidable: false } }
    ])('leaves a wall unclassed and without a collider when $owner is not collidable', ({ wall, room: roomOptions }) => {
      // Arrange
      const room = makeRoom([makeWall(wall), makeWall({ x: 5 }), makeWall({ x: 5, z: 5 })], roomOptions);

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      const uncollidable = firstWallOf(room);
      expect(uncollidable.classList.contains(COLLIDABLE)).toBe(false);
      expect(uncollidable.getObject3D('collider')).toBeUndefined();
      expect(meshOf(uncollidable)).toBeDefined();
    });

    it('classes a wall again and gives it a collider when it becomes collidable', () => {
      // Arrange
      const room = makeRoom([makeWall({ collidable: false }), makeWall({ x: 5 }), makeWall({ x: 5, z: 5 })]);
      buildRoom(room, makeBuildState());
      const wall = firstWallOf(room);
      assertDefined(wall.getAttribute('wall'), 'wall data').collidable = true;

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(wall.classList.contains(COLLIDABLE)).toBe(true);
      expect(colliderOf(wall).geometry).toBe(meshOf(wall).geometry);
    });
  });

  describe('rebuilding', () => {
    it('frees the previous wall geometry', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room, makeBuildState());
      const disposed = vi.fn();
      meshOf(firstWallOf(room)).geometry.addEventListener('dispose', disposed);

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(disposed).toHaveBeenCalledOnce();
    });

    it('frees the previous floor geometry', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room, makeBuildState());
      const disposed = vi.fn();
      meshOf(floorOf(room)).geometry.addEventListener('dispose', disposed);

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(disposed).toHaveBeenCalledOnce();
    });

    it('keeps the mesh and gives it new geometry', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room, makeBuildState());
      const mesh = meshOf(firstWallOf(room));
      const firstGeom = mesh.geometry;

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(meshOf(firstWallOf(room))).toBe(mesh);
      expect(mesh.geometry).not.toBe(firstGeom);
    });

    it('applies the material found on the parent room', () => {
      // Arrange
      const material = new THREE.MeshBasicMaterial();
      const room = makeSquareRoom({ material });
      buildRoom(room, makeBuildState());

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(meshOf(floorOf(room)).material).toBe(material);
    });

    it('keeps the mesh material when no material is found', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room, makeBuildState());
      const material = meshOf(firstWallOf(room)).material;

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(meshOf(firstWallOf(room)).material).toBe(material);
    });
  });

  describe('missing caps', () => {
    it('builds without a floor', () => {
      // Arrange
      const room = makeSquareRoom({ caps: ['ceiling'] });

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(meshOf(assertDefined(capOf(room, 'ceiling'), 'ceiling'))).toBeDefined();
    });

    it('builds without a ceiling', () => {
      // Arrange
      const room = makeSquareRoom({ caps: ['floor'] });

      // Act
      buildRoom(room, makeBuildState());

      // Assert
      expect(meshOf(floorOf(room))).toBeDefined();
    });
  });
});

describe('buildRoom in a transformed room', () => {
  const SQUARE: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];

  it('places the opening at the portal in a scaled room', () => {
    // Arrange: the portal sits halfway along the first wall, which is 8m long in world space
    const { roomEl, openingEl, state } = makeTransformedRoom({ corners: SQUARE, scale: [2, 1, 2], portalAt: [4, 0, 0] });

    // Act
    buildRoom(roomEl, state);

    // Assert: halfway along the wall in the room's own units
    expect(openingEl.object3D.position.x).toBeCloseTo(2);
  });

  it('places the opening at the portal in a rotated, moved room', () => {
    // Arrange
    const rotationY = Math.PI / 6;
    const position: [number, number, number] = [10, 0, -5];
    const portal = new THREE.Vector3(1.5, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
      .add(new THREE.Vector3(...position));
    const { roomEl, openingEl, state } = makeTransformedRoom({
      corners: SQUARE, position, rotationY, portalAt: [portal.x, portal.y, portal.z]
    });

    // Act
    buildRoom(roomEl, state);

    // Assert: the opening's world corners are centered on the portal
    const corners = assertDefined(state.cornersOf.get(openingEl), 'opening corners');
    const center = corners.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).divideScalar(corners.length);
    expect(center.x).toBeCloseTo(portal.x);
    expect(center.z).toBeCloseTo(portal.z);
  });
});
