import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Mesh } from 'three';
import type { PortalEl, WallEl } from '../../src/types/elements';
import { buildRoom } from '../../src/builders/room';
import { assertDefined } from '../../src/utils/assert';
import { meshOf, worldCenter, worldNormals } from '../utils/meshes';
import {
  fake, makeCap, makeObject3D, makeWall, makeRoom, makeSquareRoom, makeOpening, makeTransformedRoom
} from '../utils/mocks';

afterEach(() => vi.restoreAllMocks());

describe('buildRoom', () => {
  describe('with implicit wall positions', () => {
    it('creates a mesh on each wall', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      for (const wall of room.walls) {
        expect(wall.mesh).not.toBeNull();
      }
    });

    it('records the position each wall was built at', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      expect(room.walls.map(wall => wall.builtPosition?.toArray())).toEqual([[0, 0, 0], [5, 0, 0], [5, 0, 5], [0, 0, 5]]);
    });

    it('creates a mesh for the floor', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      expect(room.floor?.mesh).not.toBeNull();
    });

    it('creates a mesh for the ceiling', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      expect(room.ceiling?.mesh).not.toBeNull();
    });

    it('turns the last wall to run back to the first wall', () => {
      // Arrange: the last wall's corner is (0, 0, 5) and the first wall's is (0, 0, 0)
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert: running toward -z means a quarter turn
      expect(room.walls.at(-1)?.object3D.rotation.y).toBeCloseTo(Math.PI / 2);
    });

    it('assigns wall mesh geometry with vertices', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      for (const wall of room.walls) {
        expect(wall.mesh?.geometry.getAttribute('position')).toBeDefined();
      }
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
      buildRoom(room);

      // Assert
      expect(room.walls.map(facesCenter)).toEqual(Array(corners.length).fill(inward));
    });
  });

  describe('with width/length shorthand', () => {
    it('positions the four walls to match width and length', () => {
      // Arrange
      const room = makeRoom([makeWall(), makeWall(), makeWall(), makeWall()], { width: 4, length: 6 });

      // Act
      buildRoom(room);

      // Assert
      expect(room.walls[0]?.object3D.position).toMatchObject({ x: 0, z: 0 });
      expect(room.walls[1]?.object3D.position).toMatchObject({ x: 4, z: 0 });
      expect(room.walls[2]?.object3D.position).toMatchObject({ x: 4, z: 6 });
      expect(room.walls[3]?.object3D.position).toMatchObject({ x: 0, z: 6 });
    });
  });

  describe('outside room', () => {
    it('keeps each wall at the same corner when a width/length room is rebuilt', () => {
      // Arrange
      const walls = [makeWall(), makeWall(), makeWall(), makeWall()];
      const room = makeRoom([...walls], { width: 4, length: 6, outside: true });
      const corners = () => walls.map(wall => ({ x: wall.object3D.position.x, z: wall.object3D.position.z }));
      buildRoom(room);
      const firstBuild = corners();

      // Act
      buildRoom(room);

      // Assert
      expect(corners()).toEqual(firstBuild);
    });

    it('still creates meshes for all walls', () => {
      // Arrange
      const room = makeSquareRoom({ outside: true });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      buildRoom(room);

      // Assert
      for (const wall of room.walls) {
        expect(wall.mesh).not.toBeNull();
      }
    });
  });

  describe('re-entrant build', () => {
    it('replaces geometry on subsequent buildRoom calls', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room);
      const firstGeom = room.walls[0]?.mesh?.geometry;

      // Act
      buildRoom(room);

      // Assert
      expect(room.walls[0]?.mesh?.geometry).not.toBe(firstGeom);
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
      buildRoom(room);

      // Assert
      const pos = room.ceiling?.mesh?.geometry.getAttribute('position');
      expect(pos?.count).toBe(walls.length);
      for (let i = 0; i < (pos?.count ?? 0); i++) {
        const wall = walls.find(w => w.object3D.position.x === pos?.getX(i) && w.object3D.position.z === pos.getZ(i));
        expect(pos?.getY(i)).toBe((wall?.object3D.position.y ?? NaN) + (wall?.getHeight() ?? NaN));
      }
    });
  });

  describe('stale mesh cleanup', () => {
    it('removes and nulls a stale blocker mesh before rebuilding', () => {
      // Arrange
      const opening = makeOpening();
      const remove = vi.fn();
      const staleMesh = fake<Mesh>({ parent: { remove }, geometry: { dispose: vi.fn() }, material: { dispose: vi.fn() } });
      opening.mesh = staleMesh;
      const room = makeRoom([makeWall({ openings: [opening] }), makeWall({ x: 5 }), makeWall({ x: 5, z: 5 }), makeWall({ z: 5 })]);

      // Act
      buildRoom(room);

      // Assert
      expect(remove).toHaveBeenCalledWith(staleMesh);
      expect(opening.mesh).toBeNull();
    });

    it('frees the stale blocker geometry and material', () => {
      // Arrange
      const opening = makeOpening();
      const disposeGeometry = vi.fn();
      const disposeMaterial = vi.fn();
      opening.mesh = fake<Mesh>({ geometry: { dispose: disposeGeometry }, material: { dispose: disposeMaterial } });
      const room = makeRoom([makeWall({ openings: [opening] }), makeWall({ x: 5 }), makeWall({ x: 5, z: 5 }), makeWall({ z: 5 })]);

      // Act
      buildRoom(room);

      // Assert
      expect(disposeGeometry).toHaveBeenCalledOnce();
      expect(disposeMaterial).toHaveBeenCalledOnce();
    });
  });

  describe('rebuilding', () => {
    it('frees the previous wall geometry', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room);
      const disposed = vi.fn();
      room.walls[0]?.mesh?.geometry.addEventListener('dispose', disposed);

      // Act
      buildRoom(room);

      // Assert
      expect(disposed).toHaveBeenCalledOnce();
    });

    it('frees the previous floor geometry', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room);
      const disposed = vi.fn();
      room.floor?.mesh?.geometry.addEventListener('dispose', disposed);

      // Act
      buildRoom(room);

      // Assert
      expect(disposed).toHaveBeenCalledOnce();
    });

    it('applies the material found on the parent room', () => {
      // Arrange
      const material = new THREE.MeshBasicMaterial();
      const room = makeSquareRoom();
      room.floor = makeCap({ parentMaterial: material });
      buildRoom(room);

      // Act
      buildRoom(room);

      // Assert
      expect(room.floor.mesh?.material).toBe(material);
    });

    it('keeps the mesh material when no material is found', () => {
      // Arrange
      const room = makeSquareRoom();
      buildRoom(room);
      const material = room.walls[0]?.mesh?.material;

      // Act
      buildRoom(room);

      // Assert
      expect(room.walls[0]?.mesh?.material).toBe(material);
    });
  });

  describe('blocker', () => {
    it('creates an invisible collidable mesh for openings with floorHeight > 0', () => {
      // Arrange
      const windowPortal = fake<PortalEl>({
        getAttribute (attr: string) {
          if (attr === 'portal') return { width: 1, height: 1, floorHeight: 0.5 };
          return null;
        },
        object3D: makeObject3D({ x: 2.5, y: 0, z: 0 })
      });
      const opening = makeOpening({ portalEl: windowPortal });
      const addClassSpy = vi.spyOn(opening.classList, 'add');
      const wall0 = makeWall({ openings: [opening] });
      opening.parentEl = wall0;
      const room = makeRoom([wall0, makeWall({ x: 5 }), makeWall({ x: 5, z: 5 }), makeWall({ z: 5 })]);

      // Act
      buildRoom(room);

      // Assert
      expect(opening.mesh).not.toBeNull();
      expect(opening.mesh?.visible).toBe(false);
      expect(addClassSpy).toHaveBeenCalledWith('collidable');
    });
  });

  describe('input validation', () => {
    it('skips floor when floor is null', () => {
      // Arrange
      const room = makeSquareRoom();
      room.floor = null;

      // Act / Assert: should not throw
      expect(() => buildRoom(room)).not.toThrow();
      expect(room.ceiling?.mesh).not.toBeNull();
    });

    it('skips ceiling when ceiling is null', () => {
      // Arrange
      const room = makeSquareRoom();
      room.ceiling = null;

      // Act / Assert: should not throw
      expect(() => buildRoom(room)).not.toThrow();
      expect(room.floor?.mesh).not.toBeNull();
    });
  });
});

describe('buildRoom in a transformed room', () => {
  const SQUARE: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];

  it('places the opening at the portal in a scaled room', () => {
    // Arrange: the portal sits halfway along the first wall, which is 8m long in world space
    const { roomEl, openingEl } = makeTransformedRoom({ corners: SQUARE, scale: [2, 1, 2], portalAt: [4, 0, 0] });

    // Act
    buildRoom(roomEl);

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
    const { roomEl, openingEl } = makeTransformedRoom({
      corners: SQUARE, position, rotationY, portalAt: [portal.x, portal.y, portal.z]
    });

    // Act
    buildRoom(roomEl);

    // Assert: the opening's world corners are centered on the portal
    const center = openingEl.vertices
      .reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3())
      .divideScalar(openingEl.vertices.length);
    expect(center.x).toBeCloseTo(portal.x);
    expect(center.z).toBeCloseTo(portal.z);
  });
});
