import { describe, it, expect, vi } from 'vitest';
import { fireComponentChanged, makePortalComp, makeSceneEl, registeredComponent } from '../utils/mocks';
import '../../src/components/portal';

describe('portal', () => {
  describe('init', () => {
    it('throws when parent is not a-scene or a-wall', () => {
      // Arrange
      const comp = makePortalComp({ parentTag: 'a-room' });

      // Act / Assert
      expect(() => registeredComponent('portal').init.call(comp)).toThrow();
    });

    it('does not throw when parent is a-wall', () => {
      // Arrange
      const comp = makePortalComp({ parentTag: 'a-wall' });

      // Act / Assert
      expect(() => registeredComponent('portal').init.call(comp)).not.toThrow();
    });

    it('registers componentchanged listener', () => {
      // Arrange
      const comp = makePortalComp();

      // Act
      registeredComponent('portal').init.call(comp);

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
      registeredComponent('portal').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'position');

      // Assert
      expect(buildPortal).toHaveBeenCalledWith(comp.el);
    });

    it('does not call buildPortal when a non-transform prop changes', () => {
      // Arrange
      const buildPortal = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildPortal } } });
      const comp = makePortalComp({ sceneEl });
      registeredComponent('portal').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'color');

      // Assert
      expect(buildPortal).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('links the portal to its openings, then queues it', () => {
      // Arrange
      const calls: string[] = [];
      const linkPortal = vi.fn(() => calls.push('link'));
      const buildPortal = vi.fn(() => calls.push('build'));
      const sceneEl = makeSceneEl({ systems: { building: { linkPortal, buildPortal } } });
      const comp = makePortalComp({ sceneEl });
      const oldData = { from: null };

      // Act
      registeredComponent('portal').update.call(comp, oldData);

      // Assert
      expect(linkPortal).toHaveBeenCalledWith(comp.el, oldData);
      expect(buildPortal).toHaveBeenCalledWith(comp.el);
      expect(calls).toEqual(['link', 'build']);
    });
  });

  describe('rebuild', () => {
    it('queues the portal with the building system', () => {
      // Arrange
      const buildPortal = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { buildPortal } } });
      const comp = makePortalComp({ data: {}, sceneEl });
      registeredComponent('portal').init.call(comp);

      // Act
      comp.rebuild();

      // Assert
      expect(buildPortal).toHaveBeenCalledExactlyOnceWith(comp.el);
    });
  });

  describe('tick', () => {
    it.each([
      { moved: true, rebuilds: 1 },
      { moved: false, rebuilds: 0 }
    ])('rebuilds $rebuilds times when the system says moved=$moved', ({ moved, rebuilds }) => {
      // Arrange
      const buildPortal = vi.fn();
      const hasMoved = vi.fn(() => moved);
      const sceneEl = makeSceneEl({ systems: { building: { buildPortal, hasMoved } } });
      const comp = makePortalComp({ data: {}, sceneEl });

      // Act
      comp.tick();

      // Assert
      expect(hasMoved).toHaveBeenCalledWith(comp.el);
      expect(buildPortal).toHaveBeenCalledTimes(rebuilds);
    });
  });

  describe('remove', () => {
    it('removes componentchanged listener', () => {
      // Arrange
      const comp = makePortalComp();
      registeredComponent('portal').init.call(comp);
      const removeSpy = vi.spyOn(comp.el, 'removeEventListener');

      // Act
      registeredComponent('portal').remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('componentchanged', comp._onTransformChanged);
    });

    it('tells the building system the portal is gone', () => {
      // Arrange
      const removePortal = vi.fn();
      const sceneEl = makeSceneEl({ systems: { building: { removePortal } } });
      const comp = makePortalComp({ sceneEl });
      registeredComponent('portal').init.call(comp);

      // Act
      registeredComponent('portal').remove.call(comp);

      // Assert
      expect(removePortal).toHaveBeenCalledExactlyOnceWith(comp.el);
    });
  });
});
