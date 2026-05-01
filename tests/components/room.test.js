import { describe, it, expect, vi } from 'vitest';
import { makeRoomComp, makeSceneEl } from '../utils/mocks.js';
import '../../src/components/room.js';

describe('room', () => {
  describe('init', () => {
    it('throws when only width is provided', () => {
      // Arrange
      const comp = makeRoomComp({ data: { width: 5 } });

      // Act / Assert
      expect(() => AFRAME._components.room.init.call(comp)).toThrow();
    });

    it('throws when only length is provided', () => {
      // Arrange
      const comp = makeRoomComp({ data: { length: 5 } });

      // Act / Assert
      expect(() => AFRAME._components.room.init.call(comp)).toThrow();
    });

    it('throws when no width/length and fewer than 3 walls', () => {
      // Arrange
      const comp = makeRoomComp({ walls: [{}, {}] });

      // Act / Assert
      expect(() => AFRAME._components.room.init.call(comp)).toThrow();
    });

    it('throws when width and length given but fewer than 4 walls', () => {
      // Arrange
      const comp = makeRoomComp({ data: { width: 4, length: 6 }, walls: [{}, {}] });

      // Act / Assert
      expect(() => AFRAME._components.room.init.call(comp)).toThrow();
    });

    it('sets object3D.visible to false', () => {
      // Arrange
      const comp = makeRoomComp({ data: {} });

      // Act
      AFRAME._components.room.init.call(comp);

      // Assert
      expect(comp.el.object3D.visible).toBe(false);
    });

    it('collects walls from a-wall children', () => {
      // Arrange
      const walls = [{}, {}, {}];
      const comp = makeRoomComp({ data: {}, walls });

      // Act
      AFRAME._components.room.init.call(comp);

      // Assert
      expect(comp.el.walls).toEqual(walls);
    });

    it('stores ceiling and floor refs', () => {
      // Arrange
      const ceilingEl = {};
      const floorEl = {};
      const comp = makeRoomComp({ data: {}, ceilingEl, floorEl });

      // Act
      AFRAME._components.room.init.call(comp);

      // Assert
      expect(comp.el.ceiling).toBe(ceilingEl);
      expect(comp.el.floor).toBe(floorEl);
    });

    it('registers componentchanged listener', () => {
      // Arrange
      const comp = makeRoomComp({ data: {} });

      // Act
      AFRAME._components.room.init.call(comp);

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
      AFRAME._components.room.init.call(comp);

      // Act
      comp.el._listeners.componentchanged({ detail: { name: 'position' } });

      // Assert
      expect(buildRoom).toHaveBeenCalledWith(comp.el);
    });

    it('does not call buildRoom when a non-transform prop changes', () => {
      // Arrange
      const buildRoom = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildRoom } } });
      const comp = makeRoomComp({ data: {}, sceneEl });
      AFRAME._components.room.init.call(comp);

      // Act
      comp.el._listeners.componentchanged({ detail: { name: 'color' } });

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
      AFRAME._components.room.init.call(comp);

      // Act
      AFRAME._components.room.update.call(comp);

      // Assert
      expect(buildRoom).toHaveBeenCalledWith(comp.el);
    });
  });

  describe('remove', () => {
    it('removes componentchanged listener', () => {
      // Arrange
      const comp = makeRoomComp({ data: {} });
      AFRAME._components.room.init.call(comp);
      const removeSpy = vi.spyOn(comp.el, 'removeEventListener');

      // Act
      AFRAME._components.room.remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('componentchanged', comp._onTransformChanged);
    });
  });
});
