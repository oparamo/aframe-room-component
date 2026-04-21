import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => vi.restoreAllMocks());
import { buildRoom, buildDoorlink } from '../src/systems/buildingService.js';

// --- Minimal A-Frame element mocks ---

const makeObject3D = (x = 0, y = 0, z = 0) => ({
  position: { x, y, z, set (nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } },
  rotation: { y: 0 },
  localToWorld (v) { return v; },
  worldToLocal (v) { return v; },
  getWorldPosition (target) { target.x = this.position.x; target.y = this.position.y; target.z = this.position.z; return target; }
});

const makeCap = (parentMaterial) => ({
  mesh: null,
  components: {},
  parentEl: { components: { material: { material: parentMaterial } } },
  setObject3D (_name, mesh) { this.mesh = mesh; }
});

const makeWall = (x = 0, z = 0, height = 3, doorholes = []) => ({
  object3D: makeObject3D(x, 0, z),
  doorholes,
  getHeight () { return height; },
  components: {},
  parentEl: { components: {} },
  mesh: null,
  nextWallEl: null,
  setObject3D (_name, mesh) { this.mesh = mesh; }
});

const makeRoom = (walls, { outside = false, width = null, length = null } = {}) => ({
  getAttribute (attr) {
    if (attr === 'room') return { outside, width, length };
    return null;
  },
  walls,
  floor: makeCap(null),
  ceiling: makeCap(null)
});

const makeSquareRoom = (opts) => makeRoom([
  makeWall(0, 0),
  makeWall(5, 0),
  makeWall(5, 5),
  makeWall(0, 5)
], opts);

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

const makeVertex = (x, y, z) => new THREE.Vector3(x, y, z);

const makeDoorholeVerts = (x, width, height) => [
  makeVertex(x - width / 2, 0, 0),
  makeVertex(x - width / 2, height, 0),
  makeVertex(x + width / 2, 0, 0),
  makeVertex(x + width / 2, height, 0)
];

const makeDoorlinkChild = (type) => ({
  components: {
    [type]: {},
    material: { material: null }
  },
  parentEl: { components: {} },
  object3D: makeObject3D(),
  mesh: null,
  setObject3D (_name, mesh) { this.mesh = mesh; }
});

const makeDoorlink = (fromVerts, toVerts, children) => ({
  getAttribute (attr) {
    if (attr === 'doorlink') {
      return { from: { vertices: fromVerts }, to: { vertices: toVerts } };
    }
    return null;
  },
  children
});

describe('buildDoorlink', () => {
  const fromVerts = makeDoorholeVerts(0, 2, 2.5);
  const toVerts = makeDoorholeVerts(0, 2, 2.5);

  it('creates a mesh on a floor child', () => {
    // Arrange
    const floorChild = makeDoorlinkChild('floor');
    const doorlink = makeDoorlink(fromVerts, toVerts, [floorChild]);

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(floorChild.mesh).not.toBeNull();
  });

  it('creates a mesh on a ceiling child', () => {
    // Arrange
    const ceilingChild = makeDoorlinkChild('ceiling');
    const doorlink = makeDoorlink(fromVerts, toVerts, [ceilingChild]);

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(ceilingChild.mesh).not.toBeNull();
  });

  it('creates a mesh on a sides child', () => {
    // Arrange
    const sidesChild = makeDoorlinkChild('sides');
    const doorlink = makeDoorlink(fromVerts, toVerts, [sidesChild]);

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(sidesChild.mesh).not.toBeNull();
  });

  it('floor geometry has 4 vertices', () => {
    // Arrange
    const floorChild = makeDoorlinkChild('floor');
    const doorlink = makeDoorlink(fromVerts, toVerts, [floorChild]);

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(floorChild.mesh.geometry.attributes.position.count).toBe(4);
  });

  it('ceiling geometry has 4 vertices', () => {
    // Arrange
    const ceilingChild = makeDoorlinkChild('ceiling');
    const doorlink = makeDoorlink(fromVerts, toVerts, [ceilingChild]);

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(ceilingChild.mesh.geometry.attributes.position.count).toBe(4);
  });

  it('sides geometry has 8 vertices', () => {
    // Arrange
    const sidesChild = makeDoorlinkChild('sides');
    const doorlink = makeDoorlink(fromVerts, toVerts, [sidesChild]);

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(sidesChild.mesh.geometry.attributes.position.count).toBe(8);
  });

  it('logs an error and does nothing when from element is missing', () => {
    // Arrange
    const floorChild = makeDoorlinkChild('floor');
    const doorlink = makeDoorlink(null, toVerts, [floorChild]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(floorChild.mesh).toBeNull();
  });

  it('logs an error and does nothing when to element is missing', () => {
    // Arrange
    const floorChild = makeDoorlinkChild('floor');
    const doorlink = makeDoorlink(fromVerts, null, [floorChild]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(floorChild.mesh).toBeNull();
  });

  it('processes multiple children in one call', () => {
    // Arrange
    const floorChild = makeDoorlinkChild('floor');
    const ceilingChild = makeDoorlinkChild('ceiling');
    const sidesChild = makeDoorlinkChild('sides');
    const doorlink = makeDoorlink(fromVerts, toVerts, [floorChild, ceilingChild, sidesChild]);

    // Act
    buildDoorlink(doorlink);

    // Assert
    expect(floorChild.mesh).not.toBeNull();
    expect(ceilingChild.mesh).not.toBeNull();
    expect(sidesChild.mesh).not.toBeNull();
  });
});
