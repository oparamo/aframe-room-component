import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeRoomWithLinks as makeRoom, makeRoomWithLinks, makePortal, makeSystem } from '../utils/mocks.js';

vi.mock('../../src/systems/buildingService.js', () => ({
  buildRoom: vi.fn(),
  buildPortal: vi.fn()
}));

import { buildRoom as mockBuildRoom, buildPortal as mockBuildPortal } from '../../src/systems/buildingService.js';
import '../../src/systems/building.js';

beforeEach(() => {
  vi.clearAllMocks();
  global.requestAnimationFrame = vi.fn();
});

// --- Tests ---

describe('building system', () => {
  describe('init', () => {
    it('initializes buildPending, dirtyRooms, and dirtyPortals', () => {
      // Arrange
      const system = { ...global.AFRAME._systems.building };

      // Act
      system.init();

      // Assert
      expect(system.buildPending).toBe(false);
      expect(system.dirtyRooms).toBeInstanceOf(Set);
      expect(system.dirtyPortals).toBeInstanceOf(Set);
    });
  });

  describe('buildRoom', () => {
    it('adds the room to dirtyRooms', () => {
      // Arrange
      const system = makeSystem();
      const room = makeRoom();

      // Act
      system.buildRoom(room);

      // Assert
      expect(system.dirtyRooms.has(room)).toBe(true);
    });

    it('adds connected portals to dirtyPortals', () => {
      // Arrange
      const system = makeSystem();
      const dl = makePortal();
      const room = makeRoom(dl);

      // Act
      system.buildRoom(room);

      // Assert
      expect(system.dirtyPortals.has(dl)).toBe(true);
    });

    it('does not add to dirtyPortals when an opening has no portal', () => {
      // Arrange — makeRoomWithLinks(null) creates a room with an opening whose getPortal() returns null
      const system = makeSystem();
      const room = makeRoomWithLinks(null);

      // Act
      system.buildRoom(room);

      // Assert
      expect(system.dirtyPortals.size).toBe(0);
    });

    it('schedules a build', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoom());

      // Assert
      expect(global.requestAnimationFrame).toHaveBeenCalledOnce();
    });

    it('does not schedule a second build if one is already pending', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoom());
      system.buildRoom(makeRoom());

      // Assert
      expect(global.requestAnimationFrame).toHaveBeenCalledOnce();
    });
  });

  describe('buildPortal', () => {
    it('adds the portal to dirtyPortals', () => {
      // Arrange
      const system = makeSystem();
      const dl = makePortal();

      // Act
      system.buildPortal(dl);

      // Assert
      expect(system.dirtyPortals.has(dl)).toBe(true);
    });

    it('adds connected rooms to dirtyRooms', () => {
      // Arrange
      const system = makeSystem();
      const roomA = makeRoom();
      const roomB = makeRoom();
      const dl = makePortal({ roomA, roomB });

      // Act
      system.buildPortal(dl);

      // Assert
      expect(system.dirtyRooms.has(roomA)).toBe(true);
      expect(system.dirtyRooms.has(roomB)).toBe(true);
    });

    it('does not throw when from/to are null', () => {
      // Arrange
      const system = makeSystem();
      const dl = makePortal();

      // Act / Assert
      expect(() => system.buildPortal(dl)).not.toThrow();
    });

    it('does not throw when portal has no component data', () => {
      // Arrange — no components.portal.data hits the || {} fallback on line 24
      const system = makeSystem();
      const dl = makePortal();
      dl.components = {};

      // Act / Assert
      expect(() => system.buildPortal(dl)).not.toThrow();
      expect(system.dirtyPortals.has(dl)).toBe(true);
    });

    it('schedules a build', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildPortal(makePortal());

      // Assert
      expect(global.requestAnimationFrame).toHaveBeenCalledOnce();
    });
  });

  describe('requestBuild', () => {
    it('calls buildRoom for each dirty room and makes it visible', () => {
      // Arrange
      global.requestAnimationFrame = vi.fn(cb => cb());
      const system = makeSystem();
      const room = makeRoom();

      // Act
      system.buildRoom(room);

      // Assert
      expect(mockBuildRoom).toHaveBeenCalledWith(room);
      expect(room.object3D.visible).toBe(true);
    });

    it('calls buildPortal for each dirty portal', () => {
      // Arrange
      global.requestAnimationFrame = vi.fn(cb => cb());
      const system = makeSystem();
      const dl = makePortal();

      // Act
      system.buildPortal(dl);

      // Assert
      expect(mockBuildPortal).toHaveBeenCalledWith(dl);
    });

    it('clears dirty sets and resets the scheduled flag after flush', () => {
      // Arrange
      global.requestAnimationFrame = vi.fn(cb => cb());
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoom());

      // Assert
      expect(system.dirtyRooms.size).toBe(0);
      expect(system.dirtyPortals.size).toBe(0);
      expect(system.buildPending).toBe(false);
    });

    it('allows a new build to be scheduled after a flush completes', () => {
      // Arrange
      global.requestAnimationFrame = vi.fn(cb => cb());
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoom());
      system.buildRoom(makeRoom());

      // Assert
      expect(global.requestAnimationFrame).toHaveBeenCalledTimes(2);
    });
  });
});
