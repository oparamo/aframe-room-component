import { describe, it, expect } from 'vitest';
import { makeWallComp } from '../utils/mocks.js';
import '../../src/components/wall.js';

describe('wall', () => {
  describe('init', () => {
    it('throws when parent is not a-room', () => {
      // Arrange
      const comp = makeWallComp({ parentTag: 'a-scene' });

      // Act / Assert
      expect(() => AFRAME._components.wall.init.call(comp)).toThrow();
    });

    it('collects openings sorted by x-position ascending', () => {
      // Arrange
      const a = { object3D: { position: { x: 2 } } };
      const b = { object3D: { position: { x: 1 } } };
      const comp = makeWallComp({ openings: [a, b] });

      // Act
      AFRAME._components.wall.init.call(comp);

      // Assert
      expect(comp.el.openings[0]).toBe(b);
      expect(comp.el.openings[1]).toBe(a);
    });

    it('getHeight returns the wall-specific height when set', () => {
      // Arrange
      const comp = makeWallComp({ attrs: { wall: { height: 3.5 } } });

      // Act
      AFRAME._components.wall.init.call(comp);

      // Assert
      expect(comp.el.getHeight()).toBe(3.5);
    });

    it('getHeight falls back to room height when wall height is falsy', () => {
      // Arrange
      const comp = makeWallComp({
        attrs: { wall: { height: 0 } },
        parentAttrs: { room: { height: 2.4 } }
      });

      // Act
      AFRAME._components.wall.init.call(comp);

      // Assert
      expect(comp.el.getHeight()).toBe(2.4);
    });
  });
});
