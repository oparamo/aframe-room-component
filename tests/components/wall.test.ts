import { describe, it, expect, vi } from 'vitest';
import { fireComponentChanged, makeWallComp, registeredComponent } from '../utils/mocks';
import '../../src/components/wall';

describe('wall', () => {
  describe('init', () => {
    it('throws when parent is not a-room', () => {
      // Arrange
      const comp = makeWallComp({ parentTag: 'a-scene' });

      // Act / Assert
      expect(() => registeredComponent('wall').init.call(comp)).toThrow();
    });

    it('collects openings sorted by x-position ascending', () => {
      // Arrange
      const a = { object3D: { position: { x: 2 } } };
      const b = { object3D: { position: { x: 1 } } };
      const comp = makeWallComp({ openings: [a, b] });

      // Act
      registeredComponent('wall').init.call(comp);

      // Assert
      expect(comp.el.openings[0]).toBe(b);
      expect(comp.el.openings[1]).toBe(a);
    });

    it('getHeight returns the wall-specific height when set', () => {
      // Arrange
      const comp = makeWallComp({ attrs: { wall: { height: 3.5 } } });

      // Act
      registeredComponent('wall').init.call(comp);

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
      registeredComponent('wall').init.call(comp);

      // Assert
      expect(comp.el.getHeight()).toBe(2.4);
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
    it('rebuilds its room once when the wall has moved since it was built', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = makeWallComp({ parentComponents: { room: { rebuild } } });
      comp.el.builtPosition = new THREE.Vector3();
      comp.el.object3D.position.set(1, 0, 0);

      // Act
      comp.tick();
      comp.tick();

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });

    it('does nothing when the wall has not moved', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = makeWallComp({ parentComponents: { room: { rebuild } } });
      comp.el.builtPosition = new THREE.Vector3();

      // Act
      comp.tick();

      // Assert
      expect(rebuild).not.toHaveBeenCalled();
    });

    it('does nothing before the wall is first built', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = makeWallComp({ parentComponents: { room: { rebuild } } });
      comp.el.object3D.position.set(1, 0, 0);

      // Act
      comp.tick();

      // Assert
      expect(rebuild).not.toHaveBeenCalled();
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
