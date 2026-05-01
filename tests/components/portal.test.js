import { describe, it, expect, vi } from 'vitest';
import { makePortalComp, makeSceneEl } from '../utils/mocks.js';
import '../../src/components/portal.js';

describe('portal', () => {
  describe('init', () => {
    it('throws when parent is not a-scene or a-wall', () => {
      // Arrange
      const comp = makePortalComp({ parentTag: 'a-room' });

      // Act / Assert
      expect(() => AFRAME._components.portal.init.call(comp)).toThrow();
    });

    it('does not throw when parent is a-wall', () => {
      // Arrange
      const comp = makePortalComp({ parentTag: 'a-wall' });

      // Act / Assert
      expect(() => AFRAME._components.portal.init.call(comp)).not.toThrow();
    });

    it('registers componentchanged listener', () => {
      // Arrange
      const comp = makePortalComp();

      // Act
      AFRAME._components.portal.init.call(comp);

      // Assert
      expect(comp.el._listeners.componentchanged).toBeDefined();
    });
  });

  describe('componentchanged listener', () => {
    it('calls buildPortal when a transform prop changes', () => {
      // Arrange
      const buildPortal = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildPortal } } });
      const comp = makePortalComp({ sceneEl });
      AFRAME._components.portal.init.call(comp);

      // Act
      comp.el._listeners.componentchanged({ detail: { name: 'position' } });

      // Assert
      expect(buildPortal).toHaveBeenCalledWith(comp.el);
    });

    it('does not call buildPortal when a non-transform prop changes', () => {
      // Arrange
      const buildPortal = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildPortal } } });
      const comp = makePortalComp({ sceneEl });
      AFRAME._components.portal.init.call(comp);

      // Act
      comp.el._listeners.componentchanged({ detail: { name: 'color' } });

      // Assert
      expect(buildPortal).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('calls building.buildPortal with el', () => {
      // Arrange
      const buildPortal = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildPortal } } });
      const comp = makePortalComp({ sceneEl });
      AFRAME._components.portal.init.call(comp);

      // Act
      AFRAME._components.portal.update.call(comp);

      // Assert
      expect(buildPortal).toHaveBeenCalledWith(comp.el);
    });
  });

  describe('remove', () => {
    it('removes componentchanged listener', () => {
      // Arrange
      const comp = makePortalComp();
      AFRAME._components.portal.init.call(comp);
      const removeSpy = vi.spyOn(comp.el, 'removeEventListener');

      // Act
      AFRAME._components.portal.remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('componentchanged', comp._onTransformChanged);
    });
  });
});
