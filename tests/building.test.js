import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeRoomWithLinks as makeRoom, makeDoorlink, makeSystem } from './utils/mocks.js';

vi.mock('../src/systems/buildingService.js', () => ({
  buildRoom: vi.fn(),
  buildDoorlink: vi.fn()
}));

import { buildRoom as mockBuildRoom, buildDoorlink as mockBuildDoorlink } from '../src/systems/buildingService.js';
import '../src/systems/building.js';

beforeEach(() => {
  vi.clearAllMocks();
  global.requestAnimationFrame = vi.fn();
});

// --- Tests ---

describe('building system', () => {
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

    it('adds connected doorlinks to dirtyDoorlinks', () => {
      // Arrange
      const system = makeSystem();
      const dl = makeDoorlink();
      const room = makeRoom(dl);

      // Act
      system.buildRoom(room);

      // Assert
      expect(system.dirtyDoorlinks.has(dl)).toBe(true);
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

  describe('buildDoorlink', () => {
    it('adds the doorlink to dirtyDoorlinks', () => {
      // Arrange
      const system = makeSystem();
      const dl = makeDoorlink();

      // Act
      system.buildDoorlink(dl);

      // Assert
      expect(system.dirtyDoorlinks.has(dl)).toBe(true);
    });

    it('adds connected rooms to dirtyRooms', () => {
      // Arrange
      const system = makeSystem();
      const roomA = makeRoom();
      const roomB = makeRoom();
      const dl = makeDoorlink({ roomA, roomB });

      // Act
      system.buildDoorlink(dl);

      // Assert
      expect(system.dirtyRooms.has(roomA)).toBe(true);
      expect(system.dirtyRooms.has(roomB)).toBe(true);
    });

    it('does not throw when from/to are null', () => {
      // Arrange
      const system = makeSystem();
      const dl = makeDoorlink();

      // Act / Assert
      expect(() => system.buildDoorlink(dl)).not.toThrow();
    });

    it('schedules a build', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildDoorlink(makeDoorlink());

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

    it('calls buildDoorlink for each dirty doorlink', () => {
      // Arrange
      global.requestAnimationFrame = vi.fn(cb => cb());
      const system = makeSystem();
      const dl = makeDoorlink();

      // Act
      system.buildDoorlink(dl);

      // Assert
      expect(mockBuildDoorlink).toHaveBeenCalledWith(dl);
    });

    it('clears dirty sets and resets the scheduled flag after flush', () => {
      // Arrange
      global.requestAnimationFrame = vi.fn(cb => cb());
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoom());

      // Assert
      expect(system.dirtyRooms.size).toBe(0);
      expect(system.dirtyDoorlinks.size).toBe(0);
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
