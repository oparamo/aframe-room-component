import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wallsOf } from '../../src/builders/helpers/structure';
import { assertDefined } from '../../src/utils/assert';
import {
  immediateAnimationFrame, makeOpening, makeOpeningCorners, makePortal, makeRoom, makeRoomWithOpening, makeSquareRoom, makeSystem,
  makeWall
} from '../utils/mocks';

vi.mock('../../src/builders/room', () => ({ buildRoom: vi.fn() }));
vi.mock('../../src/builders/portal', () => ({ buildPortal: vi.fn() }));

import { buildPortal as mockBuildPortal } from '../../src/builders/portal';
import { buildRoom as mockBuildRoom } from '../../src/builders/room';
import '../../src/systems/building';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.requestAnimationFrame = vi.fn();
});

// Two rooms joined by a portal the system has linked, as the portal's first update leaves them.
const makeLinkedPair = () => {
  const system = makeSystem();
  const near = makeRoomWithOpening();
  const far = makeRoomWithOpening();
  const portal = makePortal({ from: near.openingEl, to: far.openingEl });
  system.linkPortal(portal, {});
  return { system, near, far, portal };
};

describe('building system', () => {
  describe('init', () => {
    it('starts with nothing pending or dirty', () => {
      // Act
      const system = makeSystem();

      // Assert
      expect(system.buildPending).toBe(false);
      expect(system.dirtyRooms.size).toBe(0);
      expect(system.dirtyPortals.size).toBe(0);
    });
  });

  describe('buildRoom', () => {
    it('adds the room to dirtyRooms', () => {
      // Arrange
      const system = makeSystem();
      const room = makeSquareRoom();

      // Act
      system.buildRoom(room);

      // Assert
      expect(system.dirtyRooms.has(room)).toBe(true);
    });

    it('adds the portals linked to its openings to dirtyPortals', () => {
      // Arrange
      const { system, near, portal } = makeLinkedPair();

      // Act
      system.buildRoom(near.roomEl);

      // Assert
      expect(system.dirtyPortals.has(portal)).toBe(true);
    });

    it('does not add to dirtyPortals when an opening has no portal', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildRoom(makeRoomWithOpening().roomEl);

      // Assert
      expect(system.dirtyPortals.size).toBe(0);
    });

    it('schedules a build', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildRoom(makeSquareRoom());

      // Assert
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledOnce();
    });

    it('does not schedule a second build if one is already pending', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.buildRoom(makeSquareRoom());
      system.buildRoom(makeSquareRoom());

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

    it('adds the rooms of its openings to dirtyRooms', () => {
      // Arrange
      const { system, near, far, portal } = makeLinkedPair();

      // Act
      system.buildPortal(portal);

      // Assert
      expect([...system.dirtyRooms]).toEqual([near.roomEl, far.roomEl]);
    });

    it('skips an end that is not an opening', () => {
      // Arrange
      const system = makeSystem();
      const portal = makePortal({ from: makeWall(), to: null });

      // Act
      system.buildPortal(portal);

      // Assert
      expect(system.dirtyRooms.size).toBe(0);
      expect(system.dirtyPortals.has(portal)).toBe(true);
    });

    it('still queues a portal whose component data is gone', () => {
      // Arrange
      const system = makeSystem();
      const portal = makePortal();
      vi.spyOn(portal, 'getAttribute').mockReturnValue(null);

      // Act
      system.buildPortal(portal);

      // Assert
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

  describe('linkPortal', () => {
    it('links the portal to both of its openings', () => {
      // Act
      const { system, near, far, portal } = makeLinkedPair();

      // Assert
      expect(system.state.portalOf.get(near.openingEl)).toBe(portal);
      expect(system.state.portalOf.get(far.openingEl)).toBe(portal);
    });

    it('releases the openings it joined before', () => {
      // Arrange
      const { system, near, far, portal } = makeLinkedPair();
      const previous = { from: near.openingEl, to: far.openingEl };
      Object.assign(assertDefined(portal.getAttribute('portal'), 'portal data'), { from: makeOpening() });

      // Act
      system.linkPortal(portal, previous);

      // Assert
      expect(system.state.portalOf.has(near.openingEl)).toBe(false);
      expect(system.state.portalOf.get(far.openingEl)).toBe(portal);
    });

    it('queues the rooms of the openings it released, so their holes fill in', () => {
      // Arrange
      const { system, near, far, portal } = makeLinkedPair();
      Object.assign(assertDefined(portal.getAttribute('portal'), 'portal data'), { from: makeOpening() });

      // Act
      system.linkPortal(portal, { from: near.openingEl, to: far.openingEl });

      // Assert
      expect([...system.dirtyRooms]).toEqual([near.roomEl]);
    });

    it('leaves an opening another portal has taken since', () => {
      // Arrange
      const { system, near, far, portal } = makeLinkedPair();
      const other = makePortal({ from: near.openingEl });
      system.linkPortal(other, {});
      Object.assign(assertDefined(portal.getAttribute('portal'), 'portal data'), { from: makeOpening() });

      // Act
      system.linkPortal(portal, { from: near.openingEl, to: far.openingEl });

      // Assert
      expect(system.state.portalOf.get(near.openingEl)).toBe(other);
    });
  });

  describe('removePortal', () => {
    it('queues the connected rooms and schedules a build', () => {
      // Arrange
      const { system, near, far, portal } = makeLinkedPair();

      // Act
      system.removePortal(portal);

      // Assert
      expect([...system.dirtyRooms]).toEqual([near.roomEl, far.roomEl]);
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledOnce();
    });

    it('unlinks its openings, so they build as solid wall', () => {
      // Arrange
      const { system, near, far, portal } = makeLinkedPair();

      // Act
      system.removePortal(portal);

      // Assert
      expect(system.state.portalOf.has(near.openingEl)).toBe(false);
      expect(system.state.portalOf.has(far.openingEl)).toBe(false);
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
      const room = makeSquareRoom();
      system.buildRoom(room);

      // Act
      system.removeRoom(room);

      // Assert
      expect(system.dirtyRooms.has(room)).toBe(false);
    });

    it('runs a pass, whose room-building-complete lets room-collision drop the room', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const emit = vi.spyOn(system.el, 'emit');

      // Act
      system.removeRoom(makeSquareRoom());

      // Assert
      expect(emit).toHaveBeenCalledExactlyOnceWith('room-building-complete');
    });
  });

  describe('removeOpening', () => {
    it('forgets the opening\'s corners and queues its portal', () => {
      // Arrange
      const { system, near, portal } = makeLinkedPair();
      system.state.cornersOf.set(near.openingEl, makeOpeningCorners({ x: 0, width: 1, height: 2 }));

      // Act
      system.removeOpening(near.openingEl);

      // Assert
      expect(system.state.cornersOf.has(near.openingEl)).toBe(false);
      expect(system.dirtyPortals.has(portal)).toBe(true);
    });

    it('queues nothing for an opening without a portal', () => {
      // Arrange
      const system = makeSystem();

      // Act
      system.removeOpening(makeOpening());

      // Assert
      expect(system.dirtyPortals.size).toBe(0);
    });
  });

  describe('hideUntilBuilt', () => {
    it('hides the room, then shows it once it has built', () => {
      // Arrange
      const system = makeSystem();
      const room = makeSquareRoom();
      system.hideUntilBuilt(room);
      const hidden = room.object3D.visible;
      globalThis.requestAnimationFrame = immediateAnimationFrame();

      // Act
      system.buildRoom(room);

      // Assert
      expect(hidden).toBe(false);
      expect(room.object3D.visible).toBe(true);
    });

    it('keeps a room hidden while its build fails', () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(mockBuildRoom).mockImplementationOnce(() => {
        throw new Error('bad wall');
      });
      const system = makeSystem();
      const room = makeSquareRoom();
      system.hideUntilBuilt(room);
      globalThis.requestAnimationFrame = immediateAnimationFrame();

      // Act
      system.buildRoom(room);

      // Assert
      expect(room.object3D.visible).toBe(false);
    });
  });

  describe('tick', () => {
    it('runs a pending pass', () => {
      // Arrange
      const system = makeSystem();
      const room = makeSquareRoom();
      system.buildRoom(room);

      // Act
      system.tick();

      // Assert
      expect(mockBuildRoom).toHaveBeenCalledExactlyOnceWith(room, system.state);
    });

    it('leaves nothing for the animation frame once it has taken the pass', () => {
      // Arrange
      const system = makeSystem();
      system.buildRoom(makeSquareRoom());
      system.tick();
      const [[frame]] = vi.mocked(globalThis.requestAnimationFrame).mock.calls as [[FrameRequestCallback]];

      // Act
      frame(0);

      // Assert
      expect(mockBuildRoom).toHaveBeenCalledOnce();
    });
  });

  describe('the build pass', () => {
    it('builds each dirty room with the build state', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const room = makeSquareRoom();

      // Act
      system.buildRoom(room);

      // Assert
      expect(mockBuildRoom).toHaveBeenCalledWith(room, system.state);
    });

    it('leaves alone the visibility of a room it did not hide', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const room = makeSquareRoom();
      room.object3D.visible = false;

      // Act
      system.buildRoom(room);

      // Assert
      expect(room.object3D.visible).toBe(false);
    });

    it.each([
      { gone: 'left the document', leave: (room: ReturnType<typeof makeSquareRoom>) => Object.assign(room, { isConnected: false }) },
      { gone: 'lost its room component', leave: (room: ReturnType<typeof makeSquareRoom>) => Object.assign(room, { components: {} }) }
    ])('skips a room that has $gone', ({ leave }) => {
      // Arrange
      const system = makeSystem();
      const room = makeSquareRoom();
      system.buildRoom(room);
      leave(room);

      // Act
      system.tick();

      // Assert
      expect(mockBuildRoom).not.toHaveBeenCalled();
    });

    it('logs a room whose build throws and still builds the rest', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('bad wall');
      vi.mocked(mockBuildRoom).mockImplementationOnce(() => {
        throw error;
      });
      const system = makeSystem();
      const [broken, fine] = [makeSquareRoom(), makeSquareRoom()];
      const portal = makePortal();
      system.buildRoom(broken);
      system.buildRoom(fine);
      system.buildPortal(portal);

      // Act
      system.tick();

      // Assert
      expect(errorSpy).toHaveBeenCalledExactlyOnceWith('<a-room> failed to build and was skipped.', broken, error);
      expect(mockBuildRoom).toHaveBeenLastCalledWith(fine, system.state);
      expect(mockBuildPortal).toHaveBeenCalledWith(portal, system.state);
    });

    it('starts the next pass clean after a build throws', () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(mockBuildRoom).mockImplementationOnce(() => {
        throw new Error('bad wall');
      });
      const system = makeSystem();
      system.buildRoom(makeSquareRoom());

      // Act
      system.tick();

      // Assert
      expect(system.dirtyRooms.size).toBe(0);
      expect(system.buildPending).toBe(false);
    });

    it('builds each dirty portal with the build state', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const portal = makePortal();

      // Act
      system.buildPortal(portal);

      // Assert
      expect(mockBuildPortal).toHaveBeenCalledWith(portal, system.state);
    });

    it('clears dirty sets and resets the scheduled flag after flush', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();

      // Act
      system.buildRoom(makeSquareRoom());

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
      system.buildRoom(makeSquareRoom());
      system.buildRoom(makeSquareRoom());

      // Assert
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasMoved', () => {
    it('is false before the first build', () => {
      // Arrange
      const system = makeSystem();
      const room = makeSquareRoom();
      room.object3D.position.x = 1;
      room.object3D.updateMatrixWorld();

      // Act / Assert
      expect(system.hasMoved(room)).toBe(false);
    });

    it('is false when the room has not moved since it was built', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const room = makeSquareRoom();
      system.buildRoom(room);

      // Act / Assert
      expect(system.hasMoved(room)).toBe(false);
    });

    it('is true once the room has moved since it was built', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const room = makeSquareRoom();
      system.buildRoom(room);
      room.object3D.position.x = 1;
      room.object3D.updateMatrixWorld();

      // Act / Assert
      expect(system.hasMoved(room)).toBe(true);
    });

    it('measures a portal after the pass, so a wall the pass turned does not count as a move', () => {
      // Arrange: the room build turns the wall the portal hangs on, in the same pass as the portal
      const system = makeSystem();
      const portal = makePortal({ at: { x: 1 } });
      const wall = makeWall({ others: [portal] });
      const room = makeRoom([wall, makeWall({ x: 5 }), makeWall({ x: 5, z: 5 })]);
      vi.mocked(mockBuildRoom).mockImplementationOnce(() => {
        wall.object3D.rotation.y = 1;
      });
      system.buildPortal(portal);
      system.buildRoom(room);
      const [[pass]] = vi.mocked(globalThis.requestAnimationFrame).mock.calls as [[FrameRequestCallback]];
      pass(0);

      // Act: the next frame renders, updating every world matrix
      room.object3D.updateMatrixWorld(true);

      // Assert
      expect(system.hasMoved(portal)).toBe(false);
    });
  });

  describe('hasWallMoved', () => {
    it('is false before the first build', () => {
      // Arrange
      const system = makeSystem();
      const wall = assertDefined(wallsOf(makeSquareRoom())[0], 'wall');

      // Act / Assert
      expect(system.hasWallMoved(wall)).toBe(false);
    });

    it('is true once a wall has moved within its room since the room was built', () => {
      // Arrange
      globalThis.requestAnimationFrame = immediateAnimationFrame();
      const system = makeSystem();
      const room = makeSquareRoom();
      system.buildRoom(room);
      const [moved, still] = wallsOf(room);
      assertDefined(moved, 'wall').object3D.position.x = 1;

      // Act / Assert
      expect(system.hasWallMoved(assertDefined(moved, 'wall'))).toBe(true);
      expect(system.hasWallMoved(assertDefined(still, 'wall'))).toBe(false);
    });
  });
});
