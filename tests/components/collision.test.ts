import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Intersection } from 'three';
import { fake, loadScene, makeCollisionEl, makeCollisionComponent, makePlaneMesh } from '../utils/mocks';
import '../../src/components/collision';

afterEach(() => vi.restoreAllMocks());

// A wall standing at x, facing back toward the origin.
const wallAt = (x: number) => ({ mesh: makePlaneMesh({ position: [x, 0, 0], rotationY: -Math.PI / 2 }) });

// A level floor at height y, facing up.
const floorAt = (y: number) => ({ mesh: makePlaneMesh({ position: [0, y, 0], rotationX: -Math.PI / 2 }) });

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

    it('waits for the scene to load before collecting meshes', () => {
      // Arrange
      const el = makeCollisionEl({ wallCollidables: [wallAt(1)], floorCollidables: [floorAt(0)] });

      // Act
      const comp = makeCollisionComponent(el);

      // Assert
      expect(comp.wallMeshes).toEqual([]);
      expect(comp.floorMeshes).toEqual([]);
    });
  });

  describe('when the scene loads', () => {
    it('populates wallMeshes from .collidable elements that have a mesh, skipping those without', () => {
      // Arrange
      const wall = wallAt(1);
      const el = makeCollisionEl({ wallCollidables: [wall, { mesh: null }, {}] });
      const comp = makeCollisionComponent(el);

      // Act
      loadScene(el);

      // Assert
      expect(comp.wallMeshes).toEqual([wall.mesh]);
    });

    it('populates floorMeshes from .walkable elements that have a mesh, skipping those without', () => {
      // Arrange
      const floor = floorAt(0);
      const el = makeCollisionEl({ floorCollidables: [floor, { mesh: null }, {}] });
      const comp = makeCollisionComponent(el);

      // Act
      loadScene(el);

      // Assert
      expect(comp.floorMeshes).toEqual([floor.mesh]);
    });
  });

  describe('init after the scene has loaded', () => {
    it('collects the wall and floor meshes right away', () => {
      // Arrange
      const wall = wallAt(1);
      const floor = floorAt(0);
      const el = makeCollisionEl({ sceneLoaded: true, wallCollidables: [wall], floorCollidables: [floor] });

      // Act
      const comp = makeCollisionComponent(el);

      // Assert
      expect(comp.wallMeshes).toEqual([wall.mesh]);
      expect(comp.floorMeshes).toEqual([floor.mesh]);
    });

    it('snaps to the floor at the camera height', () => {
      // Arrange
      const el = makeCollisionEl({ position: new THREE.Vector3(0, 1.6, 0), sceneLoaded: true, floorCollidables: [floorAt(0.5)] });
      const comp = makeCollisionComponent(el);
      const pos = new THREE.Vector3(0, 1.6, 0);

      // Act
      comp._snapToFloor(pos);

      // Assert
      expect(pos.y).toBeCloseTo(2.1);
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
      loadScene(el);
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
      loadScene(el);

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
      loadScene(el);

      // Act
      el.object3D.position.set(0.1, 0, 0);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.x).toBeCloseTo(0.1);
      expect(el.object3D.position.z).toBeCloseTo(0);
    });

    it('applies movement when the wall ahead is farther than the radius plus the step', () => {
      // Arrange: 0.6 > radius 0.4 + step 0.1
      const el = makeCollisionEl({ wallCollidables: [wallAt(0.6)] });
      const comp = makeCollisionComponent(el);
      loadScene(el);

      // Act
      el.object3D.position.set(0.1, 0, 0);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.x).toBeCloseTo(0.1);
    });

    it('reverts position when a wall is hit within the collision radius', () => {
      // Arrange: 0.3 < radius 0.4 + step 0.1
      const el = makeCollisionEl({ wallCollidables: [wallAt(0.3)] });
      const comp = makeCollisionComponent(el);
      loadScene(el);

      // Act
      el.object3D.position.set(0.1, 0, 0);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.x).toBeCloseTo(0);
    });

    it('slides along the wall when blocked at an angle', () => {
      // Arrange: a diagonal step into a wall facing -x leaves the z part of the step
      const el = makeCollisionEl({ wallCollidables: [wallAt(0.3)] });
      const comp = makeCollisionComponent(el);
      loadScene(el);

      // Act
      el.object3D.position.set(0.1, 0, 0.1);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.x).toBeCloseTo(0);
      expect(el.object3D.position.z).toBeCloseTo(0.1);
    });

    it('does not move when blocked head-on and slide direction is negligible', () => {
      // Arrange
      const el = makeCollisionEl({ wallCollidables: [wallAt(0.3)] });
      const comp = makeCollisionComponent(el);
      loadScene(el);

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
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      loadScene(el);
      const pos = new THREE.Vector3(0, 0, 0);

      // Act
      comp._snapToFloor.call(comp, pos);

      // Assert
      expect(pos.y).toBeCloseTo(0);
    });

    it('snaps y to floor hit point in rig mode (no eye-height offset)', () => {
      // Arrange
      const el = makeCollisionEl({ childCamera: true, floorCollidables: [floorAt(1)] });
      const comp = makeCollisionComponent(el);
      loadScene(el);
      const pos = new THREE.Vector3(0, 0, 0);

      // Act
      comp._snapToFloor.call(comp, pos);

      // Assert
      expect(pos.y).toBeCloseTo(1);
    });

    it('snaps y to floor hit point plus eye height in direct camera mode', () => {
      // Arrange: the camera starts at y=1.6, which becomes the eye height on load
      const el = makeCollisionEl({ position: new THREE.Vector3(0, 1.6, 0), floorCollidables: [floorAt(0.5)] });
      const comp = makeCollisionComponent(el);
      loadScene(el);
      const pos = new THREE.Vector3(0, 1.6, 0);

      // Act
      comp._snapToFloor.call(comp, pos);

      // Assert
      expect(pos.y).toBeCloseTo(0.5 + 1.6);
    });

    it('snaps y during tick as player moves across a sloped floor', () => {
      // Arrange: a 45 degree ramp rising toward -z, so its height is -z
      const ramp = { mesh: makePlaneMesh({ rotationX: -Math.PI / 4 }) };
      const el = makeCollisionEl({ childCamera: true, floorCollidables: [ramp] });
      const comp = makeCollisionComponent(el);
      loadScene(el);

      // Act
      el.object3D.position.set(0, 0, -0.1);
      comp.tick.call(comp);

      // Assert
      expect(el.object3D.position.y).toBeCloseTo(0.1);
    });
  });

  describe('_tryMove', () => {
    it('returns true and updates position when there is no intersection', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      loadScene(el);
      const pos = new THREE.Vector3();

      // Act
      const result = comp._tryMove.call(comp, new THREE.Vector3(0.1, 0, 0), pos);

      // Assert
      expect(result).toBe(true);
      expect(pos.x).toBeCloseTo(0.1);
    });

    it('returns false and does not update position when hit is within threshold', () => {
      // Arrange
      const el = makeCollisionEl({ wallCollidables: [wallAt(0.3)] });
      const comp = makeCollisionComponent(el);
      loadScene(el);
      const pos = new THREE.Vector3();

      // Act
      const result = comp._tryMove.call(comp, new THREE.Vector3(0.1, 0, 0), pos);

      // Assert
      expect(result).toBe(false);
      expect(pos.x).toBeCloseTo(0);
    });

    it('zeroes the y component of the stored wall normal', () => {
      // Arrange: face normal has a non-zero Y; sliding should remain horizontal.
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      vi.spyOn(comp._raycaster, 'intersectObjects').mockReturnValue([fake<Intersection>({
        distance: 0.3,
        face: { normal: new THREE.Vector3(0, 1, 0) },
        object: { matrixWorld: new THREE.Matrix4() }
      })]);

      // Act
      comp._tryMove.call(comp, new THREE.Vector3(0.1, 0, 0), new THREE.Vector3());

      // Assert
      expect(comp._normal.y).toBe(0);
    });
  });
});
