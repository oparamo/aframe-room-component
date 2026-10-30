import { describe, it, expect } from 'vitest';
import { makeCollisionSystem, makePlaneMesh, makeSurfaceEl } from '../utils/mocks';
import '../../src/systems/collision';

// A ray from z along +z. It runs off the planes' diagonal, where their two triangles would both report a hit.
const rayFrom = (z: number) => new THREE.Raycaster(new THREE.Vector3(1, 2, z), new THREE.Vector3(0, 0, 1));

// A 10 m square at z, facing +z, so a ray from behind it meets its back face.
const planeAt = (z: number) => makePlaneMesh({ position: [0, 0, z] });

describe('room-collision system', () => {
  describe('intersect', () => {
    it('hits a surface from behind, whatever its material\'s side', () => {
      // Arrange
      const mesh = planeAt(0);
      const system = makeCollisionSystem({ surfaces: [makeSurfaceEl({ mesh })] });

      // Act
      const hits = system.intersect(rayFrom(-2));

      // Assert
      expect(rayFrom(-2).intersectObject(mesh)).toEqual([]);
      expect(hits.map(hit => hit.distance)).toEqual([2]);
    });

    it('returns hits nearest first, each naming the surface\'s own mesh', () => {
      // Arrange
      const near = planeAt(1);
      const far = planeAt(3);
      const system = makeCollisionSystem({ surfaces: [makeSurfaceEl({ mesh: far }), makeSurfaceEl({ mesh: near })] });

      // Act
      const hits = system.intersect(rayFrom(0));

      // Assert
      expect(hits.map(hit => [hit.object, hit.distance])).toEqual([[near, 1], [far, 3]]);
    });

    it('reads a mesh whose geometry a rebuild swapped in place', () => {
      // Arrange
      const mesh = planeAt(0);
      const system = makeCollisionSystem({ surfaces: [makeSurfaceEl({ mesh })] });
      system.intersect(rayFrom(-2));
      mesh.geometry = new THREE.PlaneGeometry(10, 10).translate(0, 0, 1);

      // Act
      const hits = system.intersect(rayFrom(-2));

      // Assert
      expect(hits.map(hit => hit.distance)).toEqual([3]);
    });

    it('skips surfaces with nothing to hit: no mesh, or a group under the mesh key', () => {
      // Arrange
      const mesh = planeAt(1);
      const groupEl = makeSurfaceEl({ mesh: new THREE.Group() });
      const system = makeCollisionSystem({ surfaces: [makeSurfaceEl(), groupEl, makeSurfaceEl({ mesh })] });

      // Act
      const hits = system.intersect(rayFrom(0));

      // Assert
      expect(hits.map(hit => hit.object)).toEqual([mesh]);
    });
  });

  describe('the switch', () => {
    it.each([
      { case: 'it is on', own: true, parent: undefined, hits: 1 },
      { case: 'it is off', own: false, parent: undefined, hits: 0 },
      { case: 'its parent switches it off', own: true, parent: false, hits: 0 },
      { case: 'its parent has it on', own: true, parent: true, hits: 1 }
    ])('collides as expected when $case', ({ own, parent, hits }) => {
      // Arrange
      const grandparentEl = makeSurfaceEl({ collidable: parent });
      const parentEl = makeSurfaceEl({ parentEl: grandparentEl });
      const system = makeCollisionSystem({ surfaces: [makeSurfaceEl({ mesh: planeAt(1), collidable: own, parentEl })] });

      // Act
      const result = system.intersect(rayFrom(0));

      // Assert
      expect(result).toHaveLength(hits);
    });

    it('takes effect when the component tells the system, not before', () => {
      // Arrange
      const el = makeSurfaceEl({ mesh: planeAt(1), collidable: true });
      const system = makeCollisionSystem({ surfaces: [el] });
      system.intersect(rayFrom(0));
      el.components['room-collidable'] = { data: false };
      const beforeUpdate = system.intersect(rayFrom(0));

      // Act
      system.updateSurface(el);

      // Assert
      expect(beforeUpdate).toHaveLength(1);
      expect(system.intersect(rayFrom(0))).toEqual([]);
    });

    it('forgets a removed surface', () => {
      // Arrange
      const el = makeSurfaceEl({ mesh: planeAt(1) });
      const system = makeCollisionSystem({ surfaces: [el] });

      // Act
      system.removeSurface(el);

      // Assert
      expect(system.intersect(rayFrom(0))).toEqual([]);
      expect(system.meshes()).toEqual([]);
    });
  });
});
