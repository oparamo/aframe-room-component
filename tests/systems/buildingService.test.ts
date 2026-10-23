import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Mesh } from 'three';
import type { PortalEl } from '../../src/types/elements';
import {
  fake, makeObject3D, makeWall, makeRoom, makeSquareRoom,
  makeOpening, makeOpeningVerts, makePortalChild, makePortal
} from '../utils/mocks';

afterEach(() => vi.restoreAllMocks());
import { buildRoom, buildPortal } from '../../src/systems/buildingService';

// --- buildRoom ---

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

    it('sets nextWallEl on each wall', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      for (const wall of room.walls) {
        expect(wall.nextWallEl).not.toBeNull();
      }
    });

    it('links last wall back to first wall', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      expect(room.walls.at(-1)?.nextWallEl).toBe(room.walls[0]);
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

  describe('opening ceiling clamp', () => {
    it('clamps opening top to wall height when portal is taller than the wall', () => {
      // Arrange: wall height 2, portal height 3 (exceeds wall)
      const tallPortal = fake<PortalEl>({
        getAttribute (attr: string) {
          if (attr === 'portal') return { width: 1, height: 3, floorHeight: 0 };
          return null;
        },
        object3D: makeObject3D(2.5, 0, 0)
      });
      const opening = makeOpening(tallPortal);
      const wall0 = makeWall({ height: 2, openings: [opening] });
      opening.parentEl = wall0;
      const room = makeRoom([wall0, makeWall({ x: 5, height: 2 }), makeWall({ x: 5, z: 5, height: 2 }), makeWall({ z: 5, height: 2 })]);

      // Act
      buildRoom(room);

      // Assert: top vertex Y should be clamped to just below ceiling height (2 - HAIR)
      expect(opening.vertices[1]?.y).toBeCloseTo(2 - 0.0001, 3);
    });
  });

  describe('sloped walls', () => {
    it('positions opening Y to match wall slope at its X', () => {
      // Arrange: wall runs from (0,0,0) to (4,0,4) in XZ, with a Y rise of 2 over length ~5.66
      const portalEl = fake<PortalEl>({
        getAttribute (attr: string) {
          if (attr === 'portal') return { width: 1, height: 2, floorHeight: 0 };
          return null;
        },
        object3D: makeObject3D(2, 0, 2)
      });
      const opening = makeOpening(portalEl);
      // Wall at (0,0,0), next wall at (4,2,4): slopes upward by 2 units over XZ length ~5.66
      const wall0 = makeWall({ openings: [opening] });
      const wall1 = makeWall({ x: 4, y: 2, z: 4 });
      const wall2 = makeWall({ z: 4 });
      opening.parentEl = wall0;
      const room = makeRoom([wall0, wall1, wall2]);

      // Act
      buildRoom(room);

      // Assert: opening X should be ~half the wall length, Y should be ~half the Y rise
      const wallLength = Math.hypot(4, 4); // ~5.66
      const expectedX = wallLength / 2;
      const expectedY = (expectedX / wallLength) * 2; // = 1
      expect(opening.object3D.position.x).toBeCloseTo(expectedX, 2);
      expect(opening.object3D.position.y).toBeCloseTo(expectedY, 2);
    });
  });

  describe('cap triangulation', () => {
    it('uses centroid fan for a 4-wall room', () => {
      const room = makeRoom([
        makeWall({ height: 2 }),
        makeWall({ x: 4, height: 2 }),
        makeWall({ x: 4, z: 4, height: 4 }),
        makeWall({ z: 4, height: 2 })
      ]);

      buildRoom(room);

      // 4 corners + 1 centroid = 5 vertices; 4 triangles × 3 indices = 12
      expect(room.ceiling?.mesh?.geometry.getAttribute('position').count).toBe(5);
      expect(room.ceiling?.mesh?.geometry.getIndex()?.count).toBe(12);
    });

    it('uses centroid fan for a 5-wall room', () => {
      const room = makeRoom([
        makeWall({ height: 2 }),
        makeWall({ x: 4, height: 2 }),
        makeWall({ x: 6, z: 2, height: 2 }),
        makeWall({ x: 4, z: 4 }),
        makeWall({ z: 4, height: 2 })
      ]);

      buildRoom(room);

      // 5 corners + 1 centroid = 6 vertices; 5 triangles × 3 indices = 15
      expect(room.ceiling?.mesh?.geometry.getAttribute('position').count).toBe(6);
      expect(room.ceiling?.mesh?.geometry.getIndex()?.count).toBe(15);
    });
  });

  describe('stale mesh cleanup', () => {
    it('removes and nulls a stale window-blocker mesh before rebuilding', () => {
      // Arrange
      const opening = makeOpening(null);
      const remove = vi.fn();
      const staleMesh = fake<Mesh>({ parent: { remove } });
      opening.mesh = staleMesh;
      const room = makeRoom([makeWall({ openings: [opening] }), makeWall({ x: 5 }), makeWall({ x: 5, z: 5 }), makeWall({ z: 5 })]);

      // Act
      buildRoom(room);

      // Assert
      expect(remove).toHaveBeenCalledWith(staleMesh);
      expect(opening.mesh).toBeNull();
    });
  });

  describe('window blocker', () => {
    it('creates an invisible collidable mesh for openings with floorHeight > 0', () => {
      // Arrange
      const windowPortal = fake<PortalEl>({
        getAttribute (attr: string) {
          if (attr === 'portal') return { width: 1, height: 1, floorHeight: 0.5 };
          return null;
        },
        object3D: makeObject3D(2.5, 0, 0)
      });
      const opening = makeOpening(windowPortal);
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

// --- buildPortal ---

describe('buildPortal', () => {
  const fromVerts = makeOpeningVerts(0, 2, 2.5);
  const toVerts = makeOpeningVerts(0, 2, 2.5);

  it('creates a mesh on a floor child', () => {
    // Arrange
    const floorChild = makePortalChild('floor');
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh).not.toBeNull();
  });

  it('creates a mesh on a ceiling child', () => {
    // Arrange
    const ceilingChild = makePortalChild('ceiling');
    const portal = makePortal({ fromVerts, toVerts, children: [ceilingChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(ceilingChild.mesh).not.toBeNull();
  });

  it('creates a mesh on a sides child', () => {
    // Arrange
    const sidesChild = makePortalChild('sides');
    const portal = makePortal({ fromVerts, toVerts, children: [sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(sidesChild.mesh).not.toBeNull();
  });

  it('floor geometry has 4 vertices', () => {
    // Arrange
    const floorChild = makePortalChild('floor');
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh?.geometry.getAttribute('position').count).toBe(4);
  });

  it('ceiling geometry has 4 vertices', () => {
    // Arrange
    const ceilingChild = makePortalChild('ceiling');
    const portal = makePortal({ fromVerts, toVerts, children: [ceilingChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(ceilingChild.mesh?.geometry.getAttribute('position').count).toBe(4);
  });

  it('sides geometry has 8 vertices', () => {
    // Arrange
    const sidesChild = makePortalChild('sides');
    const portal = makePortal({ fromVerts, toVerts, children: [sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(sidesChild.mesh?.geometry.getAttribute('position').count).toBe(8);
  });

  it('logs an error and does nothing when from element is missing', () => {
    // Arrange
    const floorChild = makePortalChild('floor');
    const portal = makePortal({ fromVerts: null, toVerts, children: [floorChild] });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal);

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(floorChild.mesh).toBeNull();
  });

  it('includes portal id in error message when id is set', () => {
    // Arrange
    const floorChild = makePortalChild('floor');
    const portal = makePortal({ fromVerts: null, toVerts, children: [floorChild] });
    portal.id = 'my-portal';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal);

    // Assert
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('#my-portal'));
  });

  it('logs an error and does nothing when to element is missing', () => {
    // Arrange
    const floorChild = makePortalChild('floor');
    const portal = makePortal({ fromVerts, toVerts: null, children: [floorChild] });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildPortal(portal);

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(floorChild.mesh).toBeNull();
  });

  it('skips children with no matching type component', () => {
    // Arrange: child has no floor/ceiling/sides component
    const unknownChild = makePortalChild('floor');
    unknownChild.components = {};
    const portal = makePortal({ fromVerts, toVerts, children: [unknownChild] });

    // Act / Assert: should not throw and mesh remains null
    expect(() => buildPortal(portal)).not.toThrow();
    expect(unknownChild.mesh).toBeNull();
  });

  it('processes multiple children in one call', () => {
    // Arrange
    const floorChild = makePortalChild('floor');
    const ceilingChild = makePortalChild('ceiling');
    const sidesChild = makePortalChild('sides');
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild, ceilingChild, sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh).not.toBeNull();
    expect(ceilingChild.mesh).not.toBeNull();
    expect(sidesChild.mesh).not.toBeNull();
  });
});
