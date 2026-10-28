import { describe, it, expect, vi } from 'vitest';
import { fireComponentChanged, makeSceneEl, makeWallComp, registeredComponent } from '../utils/mocks';
import '../../src/components/wall';

describe('wall', () => {
  describe('init', () => {
    it('throws when parent is not a-room', () => {
      // Arrange
      const comp = makeWallComp({ parentTag: 'a-scene' });

      // Act / Assert
      expect(() => registeredComponent('wall').init.call(comp)).toThrow();
    });
  });

  describe('update', () => {
    it('rebuilds its room', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = makeWallComp({ parentComponents: { room: { rebuild } } });

      // Act
      registeredComponent('wall').update.call(comp);

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });

    it('does nothing while the room component is missing', () => {
      // Arrange: on first load, children initialize before their parent
      const comp = makeWallComp({ parentComponents: {} });

      // Act / Assert
      expect(() => registeredComponent('wall').update.call(comp)).not.toThrow();
    });
  });

  describe('componentchanged listener', () => {
    it('rebuilds its room when the position changes', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = makeWallComp({ parentComponents: { room: { rebuild } } });
      registeredComponent('wall').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'position');

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });

    it('does not rebuild when the material changes', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = makeWallComp({ parentComponents: { room: { rebuild } } });
      registeredComponent('wall').init.call(comp);

      // Act
      fireComponentChanged(comp.el, 'material');

      // Assert
      expect(rebuild).not.toHaveBeenCalled();
    });
  });

  describe('tick', () => {
    it.each([
      { moved: true, rebuilds: 1 },
      { moved: false, rebuilds: 0 }
    ])('rebuilds its room $rebuilds times when the system says moved=$moved', ({ moved, rebuilds }) => {
      // Arrange
      const rebuild = vi.fn();
      const hasWallMoved = vi.fn(() => moved);
      const sceneEl = makeSceneEl({ systems: { building: { hasWallMoved } } });
      const comp = makeWallComp({ parentComponents: { room: { rebuild } }, sceneEl });

      // Act
      comp.tick();

      // Assert
      expect(hasWallMoved).toHaveBeenCalledWith(comp.el);
      expect(rebuild).toHaveBeenCalledTimes(rebuilds);
    });
  });

  describe('remove', () => {
    it('removes the componentchanged listener', () => {
      // Arrange
      const comp = makeWallComp();
      registeredComponent('wall').init.call(comp);
      const removeSpy = vi.spyOn(comp.el, 'removeEventListener');

      // Act
      registeredComponent('wall').remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('componentchanged', comp._onTransformChanged);
    });
  });
});
