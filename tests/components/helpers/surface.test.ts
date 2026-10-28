import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Mesh } from 'three';
import type { Component } from '../../../src/types/aframe';
import type { BuildingEl, SurfaceData } from '../../../src/types/elements';
import { surfaceComponent } from '../../../src/components/helpers/surface';
import { makeEl } from '../../utils/mocks';

afterEach(() => vi.restoreAllMocks());

const definition = surfaceComponent('floor', 'a-room', 'a-portal');

// A floor in a room whose rebuild the test can watch.
const makeFloor = ({ parentTag = 'a-room' } = {}) => {
  const rebuild = vi.fn();
  const el = makeEl({ tag: 'a-floor', parentTag, parentComponents: { room: { rebuild } } });
  return { comp: { el, data: { uvScale: 1 } } as Component<SurfaceData, BuildingEl>, rebuild };
};

describe('surfaceComponent', () => {
  describe('init', () => {
    it('accepts any of the allowed parents', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { comp } = makeFloor({ parentTag: 'a-portal' });

      // Act
      definition.init?.call(comp);

      // Assert
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('logs a markup error for any other parent instead of throwing', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { comp } = makeFloor({ parentTag: 'a-scene' });

      // Act
      definition.init?.call(comp);

      // Assert
      expect(errorSpy).toHaveBeenCalledExactlyOnceWith(
        '<a-floor> must be a child of a <a-room> or <a-portal>; it was skipped.', comp.el
      );
    });
  });

  describe('update', () => {
    it('rebuilds its parent', () => {
      // Arrange
      const { comp, rebuild } = makeFloor();

      // Act
      definition.update?.call(comp, {});

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });
  });

  describe('remove', () => {
    it('frees its mesh and rebuilds its parent', () => {
      // Arrange
      const { comp, rebuild } = makeFloor();
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
      comp.el.setObject3D('floor', mesh);
      const disposed = vi.fn();
      mesh.geometry.addEventListener('dispose', disposed);

      // Act
      definition.remove?.call(comp);

      // Assert
      expect(comp.el.getObject3D('floor')).toBeUndefined();
      expect(disposed).toHaveBeenCalledOnce();
      expect(rebuild).toHaveBeenCalledOnce();
    });

    it('leaves the material for its owner to dispose', () => {
      // Arrange
      const { comp } = makeFloor();
      const mesh: Mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
      comp.el.setObject3D('floor', mesh);
      const disposed = vi.fn();
      [mesh.material].flat()[0]?.addEventListener('dispose', disposed);

      // Act
      definition.remove?.call(comp);

      // Assert
      expect(disposed).not.toHaveBeenCalled();
    });
  });
});
