import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  makeObject3D, makeCap, makeWall, makeRoom, makeSquareRoom,
  makeOpening, makeVertex, makeOpeningVerts, makePortalChild, makePortal
} from './utils/mocks.js';

afterEach(() => vi.restoreAllMocks());
import { buildRoom, buildPortal } from '../src/systems/buildingService.js';

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
      expect(room.floor.mesh).not.toBeNull();
    });

    it('creates a mesh for the ceiling', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      expect(room.ceiling.mesh).not.toBeNull();
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
      expect(room.walls[room.walls.length - 1].nextWallEl).toBe(room.walls[0]);
    });

    it('assigns wall mesh geometry with vertices', () => {
      // Arrange
      const room = makeSquareRoom();

      // Act
      buildRoom(room);

      // Assert
      for (const wall of room.walls) {
        expect(wall.mesh.geometry.attributes.position).toBeDefined();
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
      expect(room.walls[0].object3D.position).toMatchObject({ x: 0, z: 0 });
      expect(room.walls[1].object3D.position).toMatchObject({ x: 4, z: 0 });
      expect(room.walls[2].object3D.position).toMatchObject({ x: 4, z: 6 });
      expect(room.walls[3].object3D.position).toMatchObject({ x: 0, z: 6 });
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
      const firstGeom = room.walls[0].mesh.geometry;

      // Act
      buildRoom(room);

      // Assert
      expect(room.walls[0].mesh.geometry).not.toBe(firstGeom);
    });
  });

  describe('sloped walls', () => {
    it('positions opening Y to match wall slope at its X', () => {
      // Arrange — wall runs from (0,0,0) to (4,0,4) in XZ, with a Y rise of 2 over length ~5.66
      const portalEl = {
        getAttribute (attr) {
          if (attr === 'portal') return { width: 1, height: 2 };
          return null;
        },
        object3D: makeObject3D(2, 0, 2)
      };
      const opening = makeOpening(portalEl);
      // Wall at (0,0,0), next wall at (4,2,4) — slopes upward by 2 units over XZ length ~5.66
      const wall0 = makeWall(0, 0, 3, [opening], 0);
      const wall1 = makeWall(4, 4, 3, [], 2);
      const wall2 = makeWall(0, 4, 3, [], 0);
      opening.parentEl = wall0;
      const room = makeRoom([wall0, wall1, wall2]);

      // Act
      buildRoom(room);

      // Assert — opening X should be ~half the wall length, Y should be ~half the Y rise
      const wallLength = Math.hypot(4, 4); // ~5.66
      const expectedX = wallLength / 2;
      const expectedY = (expectedX / wallLength) * 2; // = 1
      expect(opening.object3D.position.x).toBeCloseTo(expectedX, 2);
      expect(opening.object3D.position.y).toBeCloseTo(expectedY, 2);
    });
  });

  describe('quad cap triangulation', () => {
    it('chooses the better diagonal for a non-coplanar quad ceiling', () => {
      // Arrange — wall 2 is taller, making ceiling vertices non-coplanar.
      // Diagonal 1-3 (through the three same-height corners) is more coplanar
      // than the default fan diagonal 0-2, so the index buffer should be overridden.
      const room = makeRoom([
        makeWall(0, 0, 2), // ceiling V0: (0, 2, 0)
        makeWall(4, 0, 2), // ceiling V1: (4, 2, 0)
        makeWall(4, 4, 4), // ceiling V2: (4, 4, 4) — tall corner
        makeWall(0, 4, 2)  // ceiling V3: (0, 2, 4)
      ]);

      // Act
      buildRoom(room);

      // Assert
      const idx = Array.from(room.ceiling.mesh.geometry.getIndex().array);
      expect(idx).toEqual([0, 1, 3, 1, 2, 3]);
    });
  });

  describe('input validation', () => {
    it('logs an error and returns when fewer than 3 walls are given', () => {
      // Arrange
      const room = makeRoom([makeWall(0, 0), makeWall(5, 0)]);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      buildRoom(room);

      // Assert
      expect(errorSpy).toHaveBeenCalledOnce();
      expect(room.floor.mesh).toBeNull();
    });

    it('skips floor when floor is null', () => {
      // Arrange
      const room = makeSquareRoom();
      room.floor = null;

      // Act & Assert — should not throw
      expect(() => buildRoom(room)).not.toThrow();
      expect(room.ceiling.mesh).not.toBeNull();
    });

    it('skips ceiling when ceiling is null', () => {
      // Arrange
      const room = makeSquareRoom();
      room.ceiling = null;

      // Act & Assert — should not throw
      expect(() => buildRoom(room)).not.toThrow();
      expect(room.floor.mesh).not.toBeNull();
    });
  });
});

// --- buildDoorlink ---

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
    expect(floorChild.mesh.geometry.attributes.position.count).toBe(4);
  });

  it('ceiling geometry has 4 vertices', () => {
    // Arrange
    const ceilingChild = makePortalChild('ceiling');
    const portal = makePortal({ fromVerts, toVerts, children: [ceilingChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(ceilingChild.mesh.geometry.attributes.position.count).toBe(4);
  });

  it('sides geometry has 8 vertices', () => {
    // Arrange
    const sidesChild = makePortalChild('sides');
    const portal = makePortal({ fromVerts, toVerts, children: [sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(sidesChild.mesh.geometry.attributes.position.count).toBe(8);
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
