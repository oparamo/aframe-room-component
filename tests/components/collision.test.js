import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeCollisionEl, makeCollisionComponent } from '../utils/mocks.js';
import '../../src/components/collision.js';

afterEach(() => vi.restoreAllMocks());

describe('room-collision', () => {
  describe('init', () => {
    it('sets _cameraEl to el when no child camera is found (direct pattern)', () => {
      // Arrange / Act
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);

      // Assert
      expect(comp._cameraEl).toBe(el);
    });

    it('sets _cameraEl to the child element when a child camera is found (rig pattern)', () => {
      // Arrange / Act
      const el = makeCollisionEl({ childCamera: true });
      const comp = makeCollisionComponent(el);

      // Assert
      expect(comp._cameraEl).not.toBe(el);
    });

    it('populates wallMeshes from .collidable elements that have a mesh, skipping those without', () => {
      // Arrange
      const mesh = {};
      const el = makeCollisionEl({ wallCollidables: [{ mesh }, { mesh: null }, {}] });

      // Act
      const comp = makeCollisionComponent(el);

      // Assert
      expect(comp.wallMeshes).toEqual([mesh]);
    });

    it('populates floorMeshes from .walkable elements that have a mesh, skipping those without', () => {
      // Arrange
      const mesh = {};
      const el = makeCollisionEl({ floorCollidables: [{ mesh }, { mesh: null }, {}] });

      // Act
      const comp = makeCollisionComponent(el);

      // Assert
      expect(comp.floorMeshes).toEqual([mesh]);
    });
  });

  describe('_onBuildComplete', () => {
    it('refreshes wall and floor mesh lists', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      const spy = vi.spyOn(comp, '_refreshMeshes');

      // Act
      comp._onBuildComplete();

      // Assert
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes loaded and room-building-complete event listeners', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      const removeSpy = vi.spyOn(el.sceneEl, 'removeEventListener');

      // Act
      comp.remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('loaded', comp._onLoaded);
      expect(removeSpy).toHaveBeenCalledWith('room-building-complete', comp._onBuildComplete);
    });
  });

  describe('tick', () => {
    it('does not cast a ray when the entity has not moved', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      const spy = vi.spyOn(comp._raycaster, 'intersectObjects');

      // Act
      comp.tick.call(comp);

      // Assert
      expect(spy).not.toHaveBeenCalled();
    });

    it('updates _previousPosition each tick', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([]);

      // Act
      el.object3D.position.set(1, 0, 0);
      comp.tick.call(comp);

      // Assert
      expect(comp._previousPosition.x).toBeCloseTo(1);
    });

    it('applies movement when no wall is hit', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([]);

      // Act
      el.object3D.position.set(0.1, 0, 0);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.x).toBeCloseTo(0.1);
      expect(el.object3D.position.z).toBeCloseTo(0);
    });

    it('reverts position when a wall is hit within the collision radius', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([{
        distance: 0.3,  // < radius(0.4) + moveLen(0.1) = 0.5
        face: { normal: new THREE.Vector3(-1, 0, 0) },
        object: { matrixWorld: new THREE.Matrix4() }
      }]);

      // Act
      el.object3D.position.set(0.1, 0, 0);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.x).toBeCloseTo(0);
    });

    it('slides along the wall when blocked at an angle', () => {
      // Arrange — diagonal movement into a wall with normal (-1, 0, 0);
      // slide direction = (0, 0, 0.1), so player should end up at z > 0.
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._raycaster, 'intersectObjects')
        .mockReturnValueOnce([{
          distance: 0.3,
          face: { normal: new THREE.Vector3(-1, 0, 0) },
          object: { matrixWorld: new THREE.Matrix4() }
        }])
        .mockReturnValueOnce([]);

      // Act
      el.object3D.position.set(0.1, 0, 0.1);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.x).toBeCloseTo(0);
      expect(el.object3D.position.z).toBeGreaterThan(0);
    });

    it('does not move when blocked head-on and slide direction is negligible', () => {
      // Arrange — movement directly into the wall's normal; slide = zero vector.
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([{
        distance: 0.3,
        face: { normal: new THREE.Vector3(-1, 0, 0) },
        object: { matrixWorld: new THREE.Matrix4() }
      }]);

      // Act
      el.object3D.position.set(0.1, 0, 0);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.x).toBeCloseTo(0);
      expect(el.object3D.position.z).toBeCloseTo(0);
    });
  });

  describe('_snapToFloor', () => {
    it('does not change y when no floor mesh is found below', () => {
      // Arrange — floorMeshes is empty so intersectObjects returns []
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      const pos = new THREE.Vector3(0, 0, 0);

      // Act
      comp._snapToFloor.call(comp, pos);

      // Assert
      expect(pos.y).toBeCloseTo(0);
    });

    it('snaps y to floor hit point in rig mode (no eye-height offset)', () => {
      // Arrange
      const el = makeCollisionEl({ childCamera: true, floorCollidables: [{ mesh: {} }] });
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._floorRaycaster, 'intersectObjects').mockReturnValue([
        { point: new THREE.Vector3(0, 1, 0) }
      ]);
      const pos = new THREE.Vector3(0, 0, 0);

      // Act
      comp._snapToFloor.call(comp, pos);

      // Assert
      expect(pos.y).toBeCloseTo(1); // floor at 1, _eyeHeight = 0 in rig mode
    });

    it('snaps y to floor hit point plus eye height in direct camera mode', () => {
      // Arrange — camera starts at y=1.6 so _eyeHeight is snapshotted as 1.6
      const position = new THREE.Vector3(0, 1.6, 0);
      const el = makeCollisionEl({ position, floorCollidables: [{ mesh: {} }] });
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._floorRaycaster, 'intersectObjects').mockReturnValue([
        { point: new THREE.Vector3(0, 0.5, 0) }
      ]);
      const pos = new THREE.Vector3(0, 1.6, 0);

      // Act
      comp._snapToFloor.call(comp, pos);

      // Assert
      expect(pos.y).toBeCloseTo(0.5 + 1.6); // floor at 0.5, eye height 1.6
    });

    it('snaps y during tick as player moves across a sloped floor', () => {
      // Arrange
      const el = makeCollisionEl({ floorCollidables: [{ mesh: {} }] });
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([]);
      vi.spyOn(comp._floorRaycaster, 'intersectObjects').mockReturnValue([
        { point: new THREE.Vector3(0, 1, 0) }
      ]);

      // Act
      el.object3D.position.set(0.1, 0, 0);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.y).toBeCloseTo(1);
    });
  });

  describe('_tryMove', () => {
    it('returns true and updates position when there is no intersection', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      const pos = new THREE.Vector3();
      const moveVec = new THREE.Vector3(0.1, 0, 0);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([]);

      // Act
      const result = comp._tryMove.call(comp, moveVec, pos);

      // Assert
      expect(result).toBe(true);
      expect(pos.x).toBeCloseTo(0.1);
    });

    it('returns false and does not update position when hit is within threshold', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      const pos = new THREE.Vector3();
      const moveVec = new THREE.Vector3(0.1, 0, 0);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([{
        distance: 0.3,  // < 0.4 + 0.1
        face: { normal: new THREE.Vector3(1, 0, 0) },
        object: { matrixWorld: new THREE.Matrix4() }
      }]);

      // Act
      const result = comp._tryMove.call(comp, moveVec, pos);

      // Assert
      expect(result).toBe(false);
      expect(pos.x).toBeCloseTo(0);
    });

    it('zeroes the y component of the stored wall normal', () => {
      // Arrange — face normal has a non-zero Y; sliding should remain horizontal.
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([{
        distance: 0.3,
        face: { normal: new THREE.Vector3(0, 1, 0) },
        object: { matrixWorld: new THREE.Matrix4() }
      }]);

      // Act
      comp._tryMove.call(comp, new THREE.Vector3(0.1, 0, 0), new THREE.Vector3());

      // Assert
      expect(comp._normal.y).toBe(0);
    });
  });
});
