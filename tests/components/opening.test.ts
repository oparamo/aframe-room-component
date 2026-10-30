import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeOpeningComp, makeSceneEl, registeredComponent } from '../utils/mocks';
import '../../src/components/opening';

afterEach(() => vi.restoreAllMocks());

describe('opening', () => {
  describe('init', () => {
    it('logs a markup error when its parent is not a-wall', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const comp = makeOpeningComp({ parentTag: 'a-room' });

      // Act
      registeredComponent('opening').init.call(comp);

      // Assert
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    it('accepts an a-wall parent', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const comp = makeOpeningComp();

      // Act
      registeredComponent('opening').init.call(comp);

      // Assert
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('frees its collider, tells the building system and rebuilds the room', () => {
      // Arrange
      const removeOpening = vi.fn();
      const sceneEl = makeSceneEl({ building: { removeOpening } });
      const rebuild = vi.fn();
      const comp = makeOpeningComp({ sceneEl });
      Object.assign(comp.el.parentEl, { parentEl: { components: { room: { rebuild } } } });
      const collider = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
      comp.el.setObject3D('collider', collider);
      const disposed = vi.fn();
      collider.geometry.addEventListener('dispose', disposed);

      // Act
      registeredComponent('opening').remove.call(comp);

      // Assert
      expect(comp.el.getObject3D('collider')).toBeUndefined();
      expect(disposed).toHaveBeenCalledOnce();
      expect(removeOpening).toHaveBeenCalledExactlyOnceWith(comp.el);
      expect(rebuild).toHaveBeenCalledOnce();
    });
  });
});
