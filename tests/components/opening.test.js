import { describe, it, expect, vi } from 'vitest';
import { makeOpeningComp, makeSceneEl } from '../utils/mocks.js';
import '../../src/components/opening.js';

describe('opening', () => {
  describe('init', () => {
    it('throws when parent is not a-wall', () => {
      // Arrange
      const comp = makeOpeningComp({ parentTag: 'a-room' });

      // Act / Assert
      expect(() => AFRAME._components.opening.init.call(comp)).toThrow();
    });

    it('initializes vertices as an empty array', () => {
      // Arrange
      const comp = makeOpeningComp();

      // Act
      AFRAME._components.opening.init.call(comp);

      // Assert
      expect(comp.el.vertices).toEqual([]);
    });
  });

  describe('getPortal', () => {
    it('returns the portal whose from matches this opening', () => {
      // Arrange
      const comp = makeOpeningComp();
      AFRAME._components.opening.init.call(comp);
      const portal = { components: { portal: { data: { from: comp.el, to: null } } } };
      comp.el.sceneEl = makeSceneEl({ portals: [portal] });

      // Act
      const result = comp.el.getPortal();

      // Assert
      expect(result).toBe(portal);
    });

    it('returns the portal whose to matches this opening', () => {
      // Arrange
      const comp = makeOpeningComp();
      AFRAME._components.opening.init.call(comp);
      const portal = { components: { portal: { data: { from: null, to: comp.el } } } };
      comp.el.sceneEl = makeSceneEl({ portals: [portal] });

      // Act
      const result = comp.el.getPortal();

      // Assert
      expect(result).toBe(portal);
    });

    it('returns cached result on subsequent calls without re-querying the scene', () => {
      // Arrange
      const comp = makeOpeningComp();
      AFRAME._components.opening.init.call(comp);
      const portal = { components: { portal: { data: { from: comp.el, to: null } } } };
      const querySelectorAll = vi.fn(() => [portal]);
      comp.el.sceneEl = { querySelectorAll };

      // Act
      comp.el.getPortal();
      const result = comp.el.getPortal();

      // Assert
      expect(querySelectorAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(portal);
    });

    it('returns null when no portal references this opening', () => {
      // Arrange
      const comp = makeOpeningComp();
      AFRAME._components.opening.init.call(comp);
      const portal = { components: { portal: { data: { from: {}, to: {} } } } };
      comp.el.sceneEl = makeSceneEl({ portals: [portal] });

      // Act
      const result = comp.el.getPortal();

      // Assert
      expect(result).toBeNull();
    });
  });
});
