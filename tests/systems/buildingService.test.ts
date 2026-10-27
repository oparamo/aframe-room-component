import { describe, it, expect, vi, afterEach } from 'vitest';
import type { BufferGeometry, Mesh } from 'three';
import type { PortalEl } from '../../src/types/elements';
import {
  fake, makeCap, makeObject3D, makeWall, makeRoom, makeSquareRoom,
  makeOpening, makeOpeningVerts, makePortalChild, makePortal
} from '../utils/mocks';

afterEach(() => vi.restoreAllMocks());
import { buildRoom, buildPortal } from '../../src/systems/buildingService';

// --- buildRoom ---

// UVs as [u, v] pairs, rounded so float noise doesn't fail an exact comparison.
const uvPairs = (geom: BufferGeometry | undefined) => {
  const uv = geom?.getAttribute('uv');
  return Array.from({ length: uv?.count ?? 0 }, (_, i) => [uv?.getX(i), uv?.getY(i)].map(n => Math.round((n ?? NaN) * 1e4) / 1e4));
};

// The Y component of each triangle's face normal, from its winding.
const faceNormalYs = (geom: BufferGeometry | undefined) => {
  const pos = geom?.getAttribute('position');
  const index = Array.from(geom?.getIndex()?.array ?? []);
  const corner = (i: number) => new THREE.Vector3(pos?.getX(i), pos?.getY(i), pos?.getZ(i));
  const ys = [];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]].map(i => corner(i ?? 0));
    if (!a || !b || !c) continue;
    ys.push(b.sub(a).cross(c.sub(a)).y);
  }
  return ys;
};

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

  describe('cap facing', () => {
    it.each([
      { outside: false, kind: 'floor', up: true },
      { outside: false, kind: 'ceiling', up: false },
      { outside: true, kind: 'floor', up: false },
      { outside: true, kind: 'ceiling', up: true }
    ] as const)('faces $kind triangles up=$up when outside=$outside', ({ outside, kind, up }) => {
      // Arrange
      const room = makeSquareRoom({ outside });

      // Act
      buildRoom(room);

      // Assert
      const ys = faceNormalYs(room[kind]?.mesh?.geometry);
      expect(ys.length).toBeGreaterThan(0);
      for (const y of ys) expect(y > 0).toBe(up);
    });
  });

  describe('cap triangulation', () => {
    it('covers a concave room without spanning its notch', () => {
      // Arrange: a U-shaped room, open between x=1 and x=2 for z > 1
      const corners = [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]] as const;
      const room = makeRoom(corners.map(([x, z]) => makeWall({ x, z })));

      // Act
      buildRoom(room);

      // Assert
      const geom = room.floor?.mesh?.geometry;
      const pos = geom?.getAttribute('position');
      const index = Array.from(geom?.getIndex()?.array ?? []);
      expect(index).toHaveLength((corners.length - 2) * 3);
      for (let t = 0; t < index.length; t += 3) {
        const tri = [index[t], index[t + 1], index[t + 2]].map(i => i ?? 0);
        const cx = tri.reduce((sum, i) => sum + (pos?.getX(i) ?? 0), 0) / 3;
        const cz = tri.reduce((sum, i) => sum + (pos?.getZ(i) ?? 0), 0) / 3;
        const inNotch = cx > 1 && cx < 2 && cz > 1;
        expect(inNotch).toBe(false);
      }
    });

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
    it('removes and nulls a stale window-blocker mesh before rebuilding', () => {
      // Arrange
      const opening = makeOpening(null);
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

    it('frees the stale window-blocker geometry and material', () => {
      // Arrange
      const opening = makeOpening(null);
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
      room.floor = makeCap(material);
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

  it('frees the previous surface geometry when rebuilt', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });
    buildPortal(portal);
    const disposed = vi.fn();
    floorChild.mesh?.geometry.addEventListener('dispose', disposed);

    // Act
    buildPortal(portal);

    // Assert
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('creates a mesh on a floor child', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh).not.toBeNull();
  });

  it('creates a mesh on a ceiling child', () => {
    // Arrange
    const ceilingChild = makePortalChild({ type: 'ceiling' });
    const portal = makePortal({ fromVerts, toVerts, children: [ceilingChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(ceilingChild.mesh).not.toBeNull();
  });

  it('creates a mesh on a sides child', () => {
    // Arrange
    const sidesChild = makePortalChild({ type: 'sides' });
    const portal = makePortal({ fromVerts, toVerts, children: [sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(sidesChild.mesh).not.toBeNull();
  });

  it('floor geometry has 4 vertices', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh?.geometry.getAttribute('position').count).toBe(4);
  });

  it('ceiling geometry has 4 vertices', () => {
    // Arrange
    const ceilingChild = makePortalChild({ type: 'ceiling' });
    const portal = makePortal({ fromVerts, toVerts, children: [ceilingChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(ceilingChild.mesh?.geometry.getAttribute('position').count).toBe(4);
  });

  it('sides geometry has 8 vertices', () => {
    // Arrange
    const sidesChild = makePortalChild({ type: 'sides' });
    const portal = makePortal({ fromVerts, toVerts, children: [sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(sidesChild.mesh?.geometry.getAttribute('position').count).toBe(8);
  });

  it('logs an error and does nothing when from element is missing', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
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
    const floorChild = makePortalChild({ type: 'floor' });
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
    const floorChild = makePortalChild({ type: 'floor' });
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
    const unknownChild = makePortalChild({ type: 'floor' });
    unknownChild.components = {};
    const portal = makePortal({ fromVerts, toVerts, children: [unknownChild] });

    // Act / Assert: should not throw and mesh remains null
    expect(() => buildPortal(portal)).not.toThrow();
    expect(unknownChild.mesh).toBeNull();
  });

  describe('surface UVs', () => {
    // A doorway 1 m wide and 2 m tall, with the far opening 3 m away. The openings face each other,
    // so the far one's left edge lines up with the near one's right.
    const near = makeOpeningVerts(0, 1, 2);
    const far = near.map(vertex => new THREE.Vector3(-vertex.x, vertex.y, 3));

    it('spans the floor in meters, across the width and along the depth', () => {
      // Arrange
      const floorChild = makePortalChild({ type: 'floor' });
      const portal = makePortal({ fromVerts: near, toVerts: far, children: [floorChild] });

      // Act
      buildPortal(portal);

      // Assert
      expect(uvPairs(floorChild.mesh?.geometry)).toEqual([[1, 3], [0, 3], [1, 0], [0, 0]]);
    });

    it('multiplies the UVs by uv-scale', () => {
      // Arrange
      const floorChild = makePortalChild({ type: 'floor', uvScale: 2 });
      const portal = makePortal({ fromVerts: near, toVerts: far, children: [floorChild] });

      // Act
      buildPortal(portal);

      // Assert
      expect(uvPairs(floorChild.mesh?.geometry)).toEqual([[2, 6], [0, 6], [2, 0], [0, 0]]);
    });

    it('spans each side wall in meters, with V running up the wall', () => {
      // Arrange
      const sidesChild = makePortalChild({ type: 'sides' });
      const portal = makePortal({ fromVerts: near, toVerts: far, children: [sidesChild] });

      // Act
      buildPortal(portal);

      // Assert
      const sideWall = [[3, 0], [3, 2], [0, 0], [0, 2]];
      expect(uvPairs(sidesChild.mesh?.geometry)).toEqual([...sideWall, ...sideWall]);
    });
  });

  it('processes multiple children in one call', () => {
    // Arrange
    const floorChild = makePortalChild({ type: 'floor' });
    const ceilingChild = makePortalChild({ type: 'ceiling' });
    const sidesChild = makePortalChild({ type: 'sides' });
    const portal = makePortal({ fromVerts, toVerts, children: [floorChild, ceilingChild, sidesChild] });

    // Act
    buildPortal(portal);

    // Assert
    expect(floorChild.mesh).not.toBeNull();
    expect(ceilingChild.mesh).not.toBeNull();
    expect(sidesChild.mesh).not.toBeNull();
  });
});
