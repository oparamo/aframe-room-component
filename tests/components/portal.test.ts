import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireComponentChanged, fireComponentRemoved, makePortalComp, makeSceneEl, registeredComponent } from '../utils/mocks';
import '../../src/components/portal';

afterEach(() => vi.restoreAllMocks());

describe('portal', () => {
  describe('init', () => {
    it.each(['a-scene', 'a-wall', 'a-entity', 'a-room'])('accepts a parent %s', (parentTag) => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const comp = makePortalComp({ parentTag });

      // Act
      registeredComponent('portal').init.call(comp);

      // Assert
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('logs a markup error inside an a-opening and never links or queues', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const [linkPortal, buildPortal] = [vi.fn(), vi.fn()];
      const sceneEl = makeSceneEl({ building: { linkPortal, buildPortal } });
      const comp = makePortalComp({ parentTag: 'a-opening', sceneEl });
      registeredComponent('portal').init.call(comp);

      // Act
      registeredComponent('portal').update.call(comp, {});
      comp.rebuild();

      // Assert
      expect(errorSpy).toHaveBeenCalledExactlyOnceWith('<a-portal> can\'t be a child of an <a-opening>; it was skipped.', comp.el);
      expect(linkPortal).not.toHaveBeenCalled();
      expect(buildPortal).not.toHaveBeenCalled();
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
      const sceneEl = makeSceneEl({ building: { buildPortal } });
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
      const sceneEl = makeSceneEl({ building: { buildPortal } });
      const comp = makePortalComp({ sceneEl });
      registeredComponent('portal').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'color');

      // Assert
      expect(buildPortal).not.toHaveBeenCalled();
    });
  });

  describe('componentremoved listener', () => {
    it.each([
      { removed: 'material', builds: 1 },
      { removed: 'shadow', builds: 0 }
    ])('queues the portal $builds times when $removed is removed', ({ removed, builds }) => {
      // Arrange
      const buildPortal = vi.fn();
      const sceneEl = makeSceneEl({ building: { buildPortal } });
      const comp = makePortalComp({ sceneEl });
      registeredComponent('portal').init.call(comp);

      // Act
      fireComponentRemoved(comp.el, removed);

      // Assert
      expect(buildPortal).toHaveBeenCalledTimes(builds);
    });
  });

  describe('update', () => {
    it('links the portal to its openings, then queues it', () => {
      // Arrange
      const calls: string[] = [];
      const linkPortal = vi.fn(() => calls.push('link'));
      const buildPortal = vi.fn(() => calls.push('build'));
      const sceneEl = makeSceneEl({ building: { linkPortal, buildPortal } });
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
      const sceneEl = makeSceneEl({ building: { buildPortal } });
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
      const sceneEl = makeSceneEl({ building: { buildPortal, hasMoved } });
      const comp = makePortalComp({ data: {}, sceneEl });

      // Act
      comp.tick();

      // Assert
      expect(hasMoved).toHaveBeenCalledWith(comp.el);
      expect(buildPortal).toHaveBeenCalledTimes(rebuilds);
    });
  });

  describe('remove', () => {
    it('removes its listeners', () => {
      // Arrange
      const comp = makePortalComp();
      registeredComponent('portal').init.call(comp);
      const removeSpy = vi.spyOn(comp.el, 'removeEventListener');

      // Act
      registeredComponent('portal').remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('componentchanged', comp._onTransformChanged);
      expect(removeSpy).toHaveBeenCalledWith('componentremoved', comp._onMaterialRemoved);
    });

    it('tells the building system the portal is gone', () => {
      // Arrange
      const removePortal = vi.fn();
      const sceneEl = makeSceneEl({ building: { removePortal } });
      const comp = makePortalComp({ sceneEl });
      registeredComponent('portal').init.call(comp);

      // Act
      registeredComponent('portal').remove.call(comp);

      // Assert
      expect(removePortal).toHaveBeenCalledExactlyOnceWith(comp.el);
    });
  });
});
