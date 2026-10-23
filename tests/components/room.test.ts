import { describe, it, expect, vi } from 'vitest';
import { fireComponentChanged, makeRoomComp, makeSceneEl, registeredComponent } from '../utils/mocks';
import '../../src/components/room';

describe('room', () => {
  describe('init', () => {
    it('throws when only width is provided', () => {
      // Arrange
      const comp = makeRoomComp({ data: { width: 5 } });

      // Act / Assert
      expect(() => registeredComponent('room').init.call(comp)).toThrow();
    });

    it('throws when only length is provided', () => {
      // Arrange
      const comp = makeRoomComp({ data: { length: 5 } });

      // Act / Assert
      expect(() => registeredComponent('room').init.call(comp)).toThrow();
    });

    it('throws when no width/length and fewer than 3 walls', () => {
      // Arrange
      const comp = makeRoomComp({ walls: [{}, {}] });

      // Act / Assert
      expect(() => registeredComponent('room').init.call(comp)).toThrow();
    });

    it('throws when width and length given but fewer than 4 walls', () => {
      // Arrange
      const comp = makeRoomComp({ data: { width: 4, length: 6 }, walls: [{}, {}] });

      // Act / Assert
      expect(() => registeredComponent('room').init.call(comp)).toThrow();
    });

    it('sets object3D.visible to false', () => {
      // Arrange
      const comp = makeRoomComp({ data: {} });

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(comp.el.object3D.visible).toBe(false);
    });

    it('collects walls from a-wall children', () => {
      // Arrange
      const walls = [{}, {}, {}];
      const comp = makeRoomComp({ data: {}, walls });

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(comp.el.walls).toEqual(walls);
    });

    it('stores ceiling and floor refs', () => {
      // Arrange
      const ceilingEl = {};
      const floorEl = {};
      const comp = makeRoomComp({ data: {}, ceilingEl, floorEl });

      // Act
      registeredComponent('room').init.call(comp);

      // Assert
      expect(comp.el.ceiling).toBe(ceilingEl);
      expect(comp.el.floor).toBe(floorEl);
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
    it('calls buildRoom when the room has moved', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);
      comp.el.object3D.matrixWorld.makeTranslation(1, 0, 0);

      // Act
      fireComponentChanged(comp.el, 'position');

      // Assert
      expect(buildRoom).toHaveBeenCalledWith(comp.el);
    });

    it('does not call buildRoom when the room has not moved', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'material');

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
    it('rebuilds when the room has moved since its last rebuild', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);
      comp.rebuild();
      buildRoom.mockClear();
      comp.el.object3D.matrixWorld.makeTranslation(1, 0, 0);

      // Act
      comp.tick();

      // Assert
      expect(buildRoom).toHaveBeenCalledExactlyOnceWith(comp.el);
    });

    it('does nothing when the room has not moved', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      registeredComponent('room').init.call(comp);
      comp.rebuild();
      buildRoom.mockClear();

      // Act
      comp.tick();

      // Assert
      expect(buildRoom).not.toHaveBeenCalled();
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
      expect(removeSpy).toHaveBeenCalledWith('componentchanged', comp._onComponentChanged);
    });
  });
});
