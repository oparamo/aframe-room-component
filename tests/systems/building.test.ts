import { describe, it, expect, vi, beforeEach } from 'vitest';
import { immediateAnimationFrame, makePortal, makeRoomWithLinks, makeSystem, registeredSystem } from '../utils/mocks';

vi.mock('../../src/systems/buildingService', () => ({
  buildRoom: vi.fn(),
  buildPortal: vi.fn()
}));

import { buildRoom as mockBuildRoom, buildPortal as mockBuildPortal } from '../../src/systems/buildingService';
import '../../src/systems/building';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.requestAnimationFrame = vi.fn();
});

// --- Tests ---

describe('building system', () => {
  describe('init', () => {
    it('initializes buildPending, dirtyRooms, and dirtyPortals', () => {
      // Arrange
      const system = { ...registeredSystem('building') };

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
      const room = makeRoomWithLinks();

      // Act
      system.buildRoom(room);

      // Assert
      expect(system.dirtyRooms.has(room)).toBe(true);
    });

    it('adds connected portals to dirtyPortals', () => {
      // Arrange
      const system = makeSystem();
      const portal = makePortal();
      const room = makeRoomWithLinks({ portals: [portal] });

      // Act
      system.buildRoom(room);

      // Assert
      expect(system.dirtyPortals.has(portal)).toBe(true);
    });

    it('does not add to dirtyPortals when an opening has no portal', () => {
      // Arrange: makeRoomWithLinks({ portals: [null] }) creates a room with an opening whose getPortal() returns null
      const system = makeSystem();
      const room = makeRoomWithLinks({ portals: [null] });

      // Act
      system.buildRoom(room);

      // Assert
      expect(system.dirtyPortals.size).toBe(0);
    });

    it('schedules a build', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoomWithLinks());

      // Assert
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledOnce();
    });

    it('does not schedule a second build if one is already pending', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoomWithLinks());
      system.buildRoom(makeRoomWithLinks());

      // Assert
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledOnce();
    });
  });

  describe('buildPortal', () => {
    it('adds the portal to dirtyPortals', () => {
      // Arrange
      const system = makeSystem();
      const portal = makePortal();

      // Act
      system.buildPortal(portal);

      // Assert
      expect(system.dirtyPortals.has(portal)).toBe(true);
    });

    it('adds connected rooms to dirtyRooms', () => {
      // Arrange
      const system = makeSystem();
      const roomA = makeRoomWithLinks();
      const roomB = makeRoomWithLinks();
      const portal = makePortal({ roomA, roomB });

      // Act
      system.buildPortal(portal);

      // Assert
      expect(system.dirtyRooms.has(roomA)).toBe(true);
      expect(system.dirtyRooms.has(roomB)).toBe(true);
    });

    it('does not throw when from/to are null', () => {
      // Arrange
      const system = makeSystem();
      const portal = makePortal();

      // Act / Assert
      expect(() => system.buildPortal(portal)).not.toThrow();
    });

    it('does not throw when portal has no component data', () => {
      // Arrange: the portal has no components.portal.data
      const system = makeSystem();
      const portal = makePortal();
      portal.components = {};

      // Act / Assert
      expect(() => system.buildPortal(portal)).not.toThrow();
      expect(system.dirtyPortals.has(portal)).toBe(true);
    });

    it('schedules a build', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildPortal(makePortal());

      // Assert
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledOnce();
    });
  });

  describe('removePortal', () => {
    it('queues the connected rooms and schedules a build', () => {
      // Arrange
      const system = makeSystem();
      const roomA = makeRoomWithLinks();
      const roomB = makeRoomWithLinks();

      // Act
      system.removePortal(makePortal({ roomA, roomB }));

      // Assert
      expect([...system.dirtyRooms]).toEqual([roomA, roomB]);
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledOnce();
    });

    it('drops the portal from the next build', () => {
      // Arrange
      const system = makeSystem();
      const portal = makePortal();
      system.buildPortal(portal);

      // Act
      system.removePortal(portal);

      // Assert
      expect(system.dirtyPortals.has(portal)).toBe(false);
    });
  });

  describe('removeRoom', () => {
    it('drops the room from the next build', () => {
      // Arrange
      const system = makeSystem();
      const room = makeRoomWithLinks();
      system.buildRoom(room);

      // Act
      system.removeRoom(room);

      // Assert
      expect(system.dirtyRooms.has(room)).toBe(false);
    });
  });

  describe('requestBuild', () => {
    it('calls buildRoom for each dirty room and makes it visible', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const room = makeRoomWithLinks();

      // Act
      system.buildRoom(room);

      // Assert
      expect(mockBuildRoom).toHaveBeenCalledWith(room);
      expect(room.object3D.visible).toBe(true);
    });

    it('calls buildPortal for each dirty portal', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const portal = makePortal();

      // Act
      system.buildPortal(portal);

      // Assert
      expect(mockBuildPortal).toHaveBeenCalledWith(portal);
    });

    it('clears dirty sets and resets the scheduled flag after flush', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoomWithLinks());

      // Assert
      expect(system.dirtyRooms.size).toBe(0);
      expect(system.dirtyPortals.size).toBe(0);
      expect(system.buildPending).toBe(false);
    });

    it('allows a new build to be scheduled after a flush completes', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoomWithLinks());
      system.buildRoom(makeRoomWithLinks());

      // Assert
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2);
    });
  });
});
