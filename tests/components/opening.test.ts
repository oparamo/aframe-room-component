import { describe, it, expect } from 'vitest';
import { makeOpeningComp, makeSceneEl, registeredComponent } from '../utils/mocks';
import '../../src/components/opening';

describe('opening', () => {
  describe('init', () => {
    it('throws when parent is not a-wall', () => {
      // Arrange
      const comp = makeOpeningComp({ parentTag: 'a-room' });

      // Act / Assert
      expect(() => registeredComponent('opening').init.call(comp)).toThrow();
    });

    it('initializes vertices as an empty array', () => {
      // Arrange
      const comp = makeOpeningComp();

      // Act
      registeredComponent('opening').init.call(comp);

      // Assert
      expect(comp.el.vertices).toEqual([]);
    });
  });

  describe('getPortal', () => {
    it('returns the portal whose from matches this opening', () => {
      // Arrange
      const comp = makeOpeningComp();
      registeredComponent('opening').init.call(comp);
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
      registeredComponent('opening').init.call(comp);
      const portal = { components: { portal: { data: { from: null, to: comp.el } } } };
      comp.el.sceneEl = makeSceneEl({ portals: [portal] });

      // Act
      const result = comp.el.getPortal();

      // Assert
      expect(result).toBe(portal);
    });

    it('finds a portal added after an earlier lookup', () => {
      // Arrange
      const comp = makeOpeningComp();
      registeredComponent('opening').init.call(comp);
      const portals: object[] = [];
      comp.el.sceneEl = makeSceneEl({ portals });
      comp.el.getPortal();
      const portal = { components: { portal: { data: { from: comp.el, to: null } } } };
      portals.push(portal);

      // Act
      const result = comp.el.getPortal();

      // Assert
      expect(result).toBe(portal);
    });

    it('returns null once the portal connects a different opening', () => {
      // Arrange
      const comp = makeOpeningComp();
      registeredComponent('opening').init.call(comp);
      const data = { from: comp.el as object, to: null };
      comp.el.sceneEl = makeSceneEl({ portals: [{ components: { portal: { data } } }] });
      comp.el.getPortal();
      data.from = {};

      // Act
      const result = comp.el.getPortal();

      // Assert
      expect(result).toBeNull();
    });

    it('returns null once the portal component is removed', () => {
      // Arrange
      const comp = makeOpeningComp();
      registeredComponent('opening').init.call(comp);
      const portal: { components: { portal?: object } } = {
        components: { portal: { data: { from: comp.el, to: null } } }
      };
      comp.el.sceneEl = makeSceneEl({ portals: [portal] });
      comp.el.getPortal();
      delete portal.components.portal;

      // Act
      const result = comp.el.getPortal();

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when no portal references this opening', () => {
      // Arrange
      const comp = makeOpeningComp();
      registeredComponent('opening').init.call(comp);
      const portal = { components: { portal: { data: { from: {}, to: {} } } } };
      comp.el.sceneEl = makeSceneEl({ portals: [portal] });

      // Act
      const result = comp.el.getPortal();

      // Assert
      expect(result).toBeNull();
    });
  });
});
