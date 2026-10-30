import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireComponentChanged, fireComponentRemoved, makeRoomComp, makeSceneEl, makeWallChild, registeredComponent } from '../utils/mocks';
import '../../src/components/room';

afterEach(() => vi.restoreAllMocks());

const TWO_WALLS = [makeWallChild(), makeWallChild()];

describe('room', () => {
  describe('init', () => {
    it.each([
      { shape: 'only width', data: { width: 5 }, children: undefined, reason: 'WIDTH needs LENGTH, and LENGTH needs WIDTH' },
      { shape: 'only length', data: { length: 5 }, children: undefined, reason: 'WIDTH needs LENGTH, and LENGTH needs WIDTH' },
      { shape: 'two walls', data: {}, children: TWO_WALLS, reason: 'it needs at least 3 walls' },
      { shape: 'width, length and two walls', data: { width: 4, length: 6 }, children: TWO_WALLS, reason: 'with WIDTH and LENGTH it must have four walls' }
    ])('logs why a room with $shape is not built', ({ data, children, reason }) => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const comp = makeRoomComp({ data, ...(children && { children }) });

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(errorSpy).toHaveBeenCalledExactlyOnceWith(`<a-room> was not built: ${reason}.`, comp.el);
    });

    it('never queues or hides a room whose shape is wrong', () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const [buildRoom, hideUntilBuilt] = [vi.fn(), vi.fn()];
      const sceneEl = makeSceneEl({ building: { buildRoom, hideUntilBuilt } });
      const comp = makeRoomComp({ data: { width: 5 }, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      comp.rebuild();

      // Assert
      expect(buildRoom).not.toHaveBeenCalled();
      expect(hideUntilBuilt).not.toHaveBeenCalled();
    });

    it('asks the building system to hide it until its first build', () => {
      // Arrange
      const hideUntilBuilt = vi.fn();
      const comp = makeRoomComp({ data: {}, sceneEl: makeSceneEl({ building: { hideUntilBuilt } }) });

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(hideUntilBuilt).toHaveBeenCalledExactlyOnceWith(comp.el);
    });

    it('leaves a room its markup hides to the markup', () => {
      // Arrange: A-Frame applies visible="false" before the room initializes
      const hideUntilBuilt = vi.fn();
      const comp = makeRoomComp({ data: {}, sceneEl: makeSceneEl({ building: { hideUntilBuilt } }) });
      comp.el.object3D.visible = false;

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(hideUntilBuilt).not.toHaveBeenCalled();
    });

    it('warns about each wall position a width/length room ignores', () => {
      // Arrange
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const positioned = makeWallChild({ positioned: true });
      const children = [positioned, makeWallChild(), makeWallChild(), makeWallChild()];
      const comp = makeRoomComp({ data: { width: 4, length: 6 }, children });

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(warnSpy).toHaveBeenCalledExactlyOnceWith('<a-room> has WIDTH and LENGTH, so the position of this wall is ignored.', positioned);
    });

    it('registers componentchanged listener', () => {
      // Arrange
      const comp = makeRoomComp({ data: {} });

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(comp.el._listeners.componentchanged).toBeDefined();
    });
  });

  describe('componentchanged listener', () => {
    it('calls buildRoom when a transform prop changes', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ building: { buildRoom } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'position');

      // Assert
      expect(buildRoom).toHaveBeenCalledWith(comp.el);
    });

    it('does not call buildRoom when a non-transform prop changes', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ building: { buildRoom } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'color');

      // Assert
      expect(buildRoom).not.toHaveBeenCalled();
    });
  });

  describe('componentremoved listener', () => {
    it.each([
      { removed: 'material', builds: 1 },
      { removed: 'shadow', builds: 0 }
    ])('queues the room $builds times when $removed is removed', ({ removed, builds }) => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ building: { buildRoom } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      fireComponentRemoved(comp.el, removed);

      // Assert
      expect(buildRoom).toHaveBeenCalledTimes(builds);
    });
  });

  describe('update', () => {
    it('calls building.buildRoom with el', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ building: { buildRoom } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      registeredComponent('room').update.call(comp);

      // Assert
      expect(buildRoom).toHaveBeenCalledWith(comp.el);
    });
  });

  describe('rebuild', () => {
    it('queues the room with the building system', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ building: { buildRoom } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      comp.rebuild();

      // Assert
      expect(buildRoom).toHaveBeenCalledExactlyOnceWith(comp.el);
    });
  });

  describe('tick', () => {
    it.each([
      { moved: true, rebuilds: 1 },
      { moved: false, rebuilds: 0 }
    ])('rebuilds $rebuilds times when the system says moved=$moved', ({ moved, rebuilds }) => {
      // Arrange
      const buildRoom = vi.fn();
      const hasMoved = vi.fn(() => moved);
      const sceneEl = makeSceneEl({ building: { buildRoom, hasMoved } });
      const comp = makeRoomComp({ data: {}, sceneEl });

      // Act
      comp.tick();

      // Assert
      expect(hasMoved).toHaveBeenCalledWith(comp.el);
      expect(buildRoom).toHaveBeenCalledTimes(rebuilds);
    });
  });

  describe('remove', () => {
    it('removes its listeners', () => {
      // Arrange
      const comp = makeRoomComp({ data: {} });
      registeredComponent('room').init.call(comp);
      const removeSpy = vi.spyOn(comp.el, 'removeEventListener');

      // Act
      registeredComponent('room').remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('componentchanged', comp._onTransformChanged);
      expect(removeSpy).toHaveBeenCalledWith('componentremoved', comp._onMaterialRemoved);
    });

    it('tells the building system the room is gone', () => {
      // Arrange
      const removeRoom = vi.fn();
      const sceneEl = makeSceneEl({ building: { removeRoom } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      registeredComponent('room').remove.call(comp);

      // Assert
      expect(removeRoom).toHaveBeenCalledExactlyOnceWith(comp.el);
    });
  });
});
