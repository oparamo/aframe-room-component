import { describe, it, expect, vi } from 'vitest';
import { fireComponentChanged, makeRoomComp, makeSceneEl, registeredComponent } from '../utils/mocks';
import '../../src/components/room';

describe('room', () => {
  describe('init', () => {
    it('throws when only width is provided', () => {
      // Arrange
      const comp = makeRoomComp({ data: { width: 5 } });

      // Act / Assert
      expect(() => registeredComponent('room').init.call(comp)).toThrow('<a-room> with WIDTH must also have LENGTH (and vice versa).');
    });

    it('throws when only length is provided', () => {
      // Arrange
      const comp = makeRoomComp({ data: { length: 5 } });

      // Act / Assert
      expect(() => registeredComponent('room').init.call(comp)).toThrow('<a-room> with WIDTH must also have LENGTH (and vice versa).');
    });

    it('throws when no width/length and fewer than 3 walls', () => {
      // Arrange
      const comp = makeRoomComp({ children: [{ localName: 'a-wall' }, { localName: 'a-wall' }] });

      // Act / Assert
      expect(() => registeredComponent('room').init.call(comp)).toThrow('<a-room> needs at least 3 walls.');
    });

    it('throws when width and length given but fewer than 4 walls', () => {
      // Arrange
      const comp = makeRoomComp({ data: { width: 4, length: 6 }, children: [{ localName: 'a-wall' }, { localName: 'a-wall' }] });

      // Act / Assert
      expect(() => registeredComponent('room').init.call(comp)).toThrow('<a-room> with WIDTH and LENGTH must have four walls.');
    });

    it('sets object3D.visible to false', () => {
      // Arrange
      const comp = makeRoomComp({ data: {} });

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(comp.el.object3D.visible).toBe(false);
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
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
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
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'color');

      // Assert
      expect(buildRoom).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('calls building.buildRoom with el', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
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
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
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
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom, hasMoved } } });
      const comp = makeRoomComp({ data: {}, sceneEl });

      // Act
      comp.tick();

      // Assert
      expect(hasMoved).toHaveBeenCalledWith(comp.el);
      expect(buildRoom).toHaveBeenCalledTimes(rebuilds);
    });
  });

  describe('remove', () => {
    it('removes componentchanged listener', () => {
      // Arrange
      const comp = makeRoomComp({ data: {} });
      registeredComponent('room').init.call(comp);
      const removeSpy = vi.spyOn(comp.el, 'removeEventListener');

      // Act
      registeredComponent('room').remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('componentchanged', comp._onTransformChanged);
    });

    it('tells the building system the room is gone', () => {
      // Arrange
      const removeRoom = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { removeRoom } } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      registeredComponent('room').remove.call(comp);

      // Assert
      expect(removeRoom).toHaveBeenCalledExactlyOnceWith(comp.el);
    });
  });
});
