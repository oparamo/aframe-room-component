import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Intersection } from 'three';
import {
  fake, loadScene, makeCollisionEl, makeCollisionComponent, makePlaneMesh, makeSurfaceEl
} from '../utils/mocks';
import '../../src/components/collision';
import '../../src/systems/collision';

afterEach(() => vi.restoreAllMocks());

// A wall standing on the ground at x, as tall as height, facing back toward the origin.
const wallAt = (x: number, height = 10) => makeSurfaceEl({
  mesh: makePlaneMesh({ position: [x, height / 2, 0], rotationY: -Math.PI / 2, size: [10, height] })
});

// A wall standing at z, facing +z.
const wallAtZ = (z: number) => makeSurfaceEl({ mesh: makePlaneMesh({ position: [0, 0, z] }) });

// A level floor at height y, facing up, 10 m square unless sized, centered on x.
const floorAt = (y: number, { x = 0, size = 10 } = {}) => makeSurfaceEl({
  mesh: makePlaneMesh({ position: [x, y, 0], rotationX: -Math.PI / 2, size: [size, size] })
});

type CollisionEl = ReturnType<typeof makeCollisionEl>;
type Comp = ReturnType<typeof makeCollisionComponent>;

// Moves the entity by the step, as a control would, and lets room-collision judge it.
const stepBy = ({ el, comp }: { el: CollisionEl; comp: Comp }, [dx, dz]: [number, number]) => {
  el.object3D.position.x += dx;
  el.object3D.position.z += dz;
  comp.tick.call(comp);
};

// A loaded room-collision on a rig with a child camera, so the feet are at the rig's y.
const makeRig = (options: Parameters<typeof makeCollisionEl>[0] = {}) => {
  const el = makeCollisionEl({ childCamera: true, ...options });
  const comp = makeCollisionComponent(el);
  loadScene(el);
  return { el, comp };
};

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

    it('starts from where the camera stands when added after the scene has loaded', () => {
      // Arrange: the camera's 1.6 m becomes its eye height above the floor
      const el = makeCollisionEl({ position: new THREE.Vector3(0, 1.6, 0), sceneLoaded: true, surfaces: [floorAt(0.2)] });
      const comp = makeCollisionComponent(el);

      // Act
      stepBy({ el, comp }, [0.1, 0]);

      // Assert
      expect(el.object3D.position.toArray()).toEqual([expect.closeTo(0.1), expect.closeTo(1.8), 0]);
    });
  });

  describe('remove', () => {
    it('removes its loaded listener', () => {
      // Arrange
      const el = makeCollisionEl();
      const comp = makeCollisionComponent(el);
      const removeSpy = vi.spyOn(el.sceneEl, 'removeEventListener');

      // Act
      comp.remove.call(comp);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith('loaded', comp._onLoaded);
    });
  });

  describe('walls', () => {
    it('does not cast a ray when the entity has not moved', () => {
      // Arrange
      const rig = makeRig();
      const spy = vi.spyOn(rig.comp.system, 'intersect');

      // Act
      rig.comp.tick.call(rig.comp);

      // Assert
      expect(spy).not.toHaveBeenCalled();
    });

    it('applies movement when no wall is near', () => {
      // Arrange: 0.6 > radius 0.4 + step 0.1
      const rig = makeRig({ surfaces: [wallAt(0.6)] });

      // Act
      stepBy(rig, [0.1, 0]);

      // Assert
      expect(rig.el.object3D.position.toArray()).toEqual([expect.closeTo(0.1), 0, 0]);
    });

    it('casts its move rays no farther than the radius plus the move', () => {
      // Arrange
      const rig = makeRig();
      const { system } = rig.comp;
      const intersect = system.intersect.bind(system);
      const fars: number[] = [];
      vi.spyOn(system, 'intersect').mockImplementation((raycaster) => {
        fars.push(raycaster.far);
        return intersect(raycaster);
      });

      // Act
      stepBy(rig, [0.1, 0]);

      // Assert: one ray at the torso and one low
      expect(fars.slice(0, 2)).toEqual([expect.closeTo(0.5), expect.closeTo(0.5)]);
    });

    it('stops a step that comes within the radius, and holds the player the radius away', () => {
      // Arrange: 0.3 < radius 0.4 + step 0.1
      const rig = makeRig({ surfaces: [wallAt(0.3)] });

      // Act
      stepBy(rig, [0.1, 0]);

      // Assert
      expect(rig.el.object3D.position.x).toBeCloseTo(0.3 - 0.4);
    });

    it('slides along the wall when blocked at an angle', () => {
      // Arrange: a diagonal step into a wall facing -x leaves the z part of the step
      const rig = makeRig({ surfaces: [wallAt(0.3)] });

      // Act
      stepBy(rig, [0.1, 0.1]);

      // Assert
      expect(rig.el.object3D.position.x).toBeCloseTo(-0.1);
      expect(rig.el.object3D.position.z).toBeCloseTo(0.1);
    });

    it('keeps the radius from a wall approached at a shallow angle', () => {
      // Arrange
      const rig = makeRig({ surfaces: [wallAt(0.6)] });

      // Act
      for (let i = 0; i < 20; i++) stepBy(rig, [0.05, 0.1]);

      // Assert
      expect(rig.el.object3D.position.x).toBeCloseTo(0.6 - 0.4);
      expect(rig.el.object3D.position.z).toBeGreaterThan(1);
    });

    it('keeps the radius from both walls of a corner', () => {
      // Arrange
      const rig = makeRig({ surfaces: [wallAt(1), wallAtZ(1)] });

      // Act
      for (let i = 0; i < 20; i++) stepBy(rig, [0.1, 0.1]);

      // Assert
      expect(rig.el.object3D.position.x).toBeCloseTo(0.6);
      expect(rig.el.object3D.position.z).toBeCloseTo(0.6);
    });

    it('stops the player at a wall lower than the torso but higher than the step-height', () => {
      // Arrange: the torso ray runs at 1 m, over a 0.5 m wall
      const rig = makeRig({ surfaces: [wallAt(0.3, 0.5)] });

      // Act
      stepBy(rig, [0.1, 0]);

      // Assert
      expect(rig.el.object3D.position.x).toBeCloseTo(-0.1);
    });

    it('lets the player over a wall no higher than the step-height', () => {
      // Arrange
      const rig = makeRig({ surfaces: [wallAt(0.3, 0.2)] });

      // Act
      stepBy(rig, [0.1, 0]);

      // Assert
      expect(rig.el.object3D.position.x).toBeCloseTo(0.1);
    });

    it('works in world space under a moved and turned parent', () => {
      // Arrange: turned a quarter turn, the parent's +x points along world -z, toward a wall 0.3 m away
      const parent = new THREE.Object3D();
      parent.position.set(10, 0, 0);
      parent.rotation.y = Math.PI / 2;
      const wall = makeSurfaceEl({ mesh: makePlaneMesh({ position: [10, 0, -0.3] }) });
      const rig = makeRig({ parent, surfaces: [wall] });

      // Act
      stepBy(rig, [0.1, 0]);

      // Assert
      expect(rig.el.object3D.position.x).toBeCloseTo(-0.1);
      expect(rig.el.object3D.position.z).toBeCloseTo(0);
    });

    it('pushes the rig back when the camera inside it moves into a wall', () => {
      // Arrange: a headset moves the camera; the rig stands still
      const rig = makeRig({ surfaces: [wallAt(0.3)] });
      const cameraEl = rig.comp._cameraEl;

      // Act
      cameraEl.object3D.position.x = 0.1;
      rig.comp.tick.call(rig.comp);

      // Assert: the head ends the radius from the wall
      expect(rig.el.object3D.position.x).toBeCloseTo(-0.2);
      expect(rig.el.object3D.position.x + cameraEl.object3D.position.x).toBeCloseTo(0.3 - 0.4);
    });

    it('flattens the wall normal it slides along to the horizontal', () => {
      // Arrange
      const rig = makeRig();
      const hit = fake<Intersection>({
        face: { normal: new THREE.Vector3(1, 1, 0) },
        object: { matrixWorld: new THREE.Matrix4() }
      });

      // Act
      rig.comp._setHorizontalNormal(hit);

      // Assert
      expect(rig.comp._normal.toArray()).toEqual([1, 0, 0]);
    });
  });

  describe('floors', () => {
    it('leaves y alone when there is no floor below', () => {
      // Arrange
      const rig = makeRig();

      // Act
      stepBy(rig, [0.1, 0]);

      // Assert
      expect(rig.el.object3D.position.y).toBe(0);
    });

    it('steps the rig up onto a floor within the step-height', () => {
      // Arrange
      const rig = makeRig({ surfaces: [floorAt(0.2, { x: 1, size: 1 })] });

      // Act
      stepBy(rig, [1, 0]);

      // Assert
      expect(rig.el.object3D.position.toArray()).toEqual([expect.closeTo(1), expect.closeTo(0.2), 0]);
    });

    it('does not climb a floor above the step-height', () => {
      // Arrange
      const rig = makeRig({ surfaces: [floorAt(0.5, { x: 1, size: 1 })] });

      // Act
      stepBy(rig, [1, 0]);

      // Assert
      expect(rig.el.object3D.position.y).toBe(0);
    });

    it('keeps the camera its eye height above the floor in the direct pattern', () => {
      // Arrange: the camera starts at y=1.6, which becomes the eye height on load
      const el = makeCollisionEl({ position: new THREE.Vector3(0, 1.6, 0), surfaces: [floorAt(0.2)] });
      const comp = makeCollisionComponent(el);
      loadScene(el);

      // Act
      stepBy({ el, comp }, [0.1, 0]);

      // Assert
      expect(el.object3D.position.y).toBeCloseTo(0.2 + 1.6);
    });

    it('follows a gentle slope', () => {
      // Arrange: a ramp tilted 0.2 rad from level, rising toward -z
      const ramp = makeSurfaceEl({ mesh: makePlaneMesh({ rotationX: -Math.PI / 2 + 0.2 }) });
      const rig = makeRig({ surfaces: [ramp] });

      // Act
      stepBy(rig, [0, -0.1]);

      // Assert
      expect(rig.el.object3D.position.y).toBeCloseTo(0.1 * Math.tan(0.2));
    });
  });
});
