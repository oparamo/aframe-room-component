import type { Intersection, Matrix3, Raycaster, Vector3 } from 'three';
import type { Component, Entity } from '../types/aframe';
import type { CollisionSystem } from '../types/collision';
import { assertDefined } from '../utils/assert';

interface CollisionData { radius: number; stepHeight: number }

interface CollisionComponent extends Component<CollisionData> {
  // A-Frame hands every room-collision component the system of the same name.
  system: CollisionSystem;
  _cameraEl: Entity;
  _eyeHeight: number;
  // The world heights the level rays run at this tick: the torso, and just above the step-height.
  _heights: [number, number];
  _raycaster: Raycaster;
  _floorRaycaster: Raycaster;
  _previousHead: Vector3;
  _head: Vector3;
  _resolved: Vector3;
  _entityPosition: Vector3;
  _move: Vector3;
  _slide: Vector3;
  _direction: Vector3;
  _origin: Vector3;
  _normal: Vector3;
  _normalMatrix: Matrix3;
  _onLoaded: () => void;
  _nearestHit(from: Vector3, direction: Vector3): Intersection | undefined;
  _sweep(from: Vector3, move: Vector3): boolean;
  _pushOut(position: Vector3): void;
  _pushAway(position: Vector3, direction: Vector3): void;
  _floorLift(position: Vector3, feetY: number): number;
  _apply(correction: Vector3): void;
  _setHorizontalNormal(hit: Intersection): void;
}

const DOWN = new THREE.Vector3(0, -1, 0);
// The low ray runs this far above the step-height, so a sill exactly at it isn't hit edge-on.
const LOW_RAY_LIFT = 0.01;
const MIN_MOVE_SQ = 0.000001;
const MIN_SLIDE_SQ = 0.0001;
const TORSO_OFFSET = 0.6;

// The eight horizontal directions the radius is held in: the axes and the diagonals.
const PUSH_DIRECTIONS = Array.from({ length: 8 }, (_, i) => {
  const angle = i * Math.PI / 4;
  return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
});

AFRAME.registerComponent<CollisionComponent>('room-collision', {
  schema: {
    radius: { type: 'number', default: 0.4 },
    stepHeight: { type: 'number', default: 0.3 }
  },

  init: function () {
    // Supports rig pattern (room-collision on parent, camera is a child)
    // and direct pattern (room-collision on the camera entity itself).
    this._cameraEl = this.el.querySelector<Entity>('[camera]') ?? this.el;

    this._heights = [0, 0];
    this._raycaster = new THREE.Raycaster();
    this._floorRaycaster = new THREE.Raycaster();
    this._previousHead = new THREE.Vector3();
    this._head = new THREE.Vector3();
    this._resolved = new THREE.Vector3();
    this._entityPosition = new THREE.Vector3();
    this._move = new THREE.Vector3();
    this._slide = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._normalMatrix = new THREE.Matrix3();

    this._onLoaded = () => {
      this._cameraEl.object3D.getWorldPosition(this._previousHead);
      // In rig mode the rig sits at floor level so no eye-height offset is needed.
      // In direct camera mode snapshot the camera's actual Y as eye height above floor.
      this._eyeHeight = this._cameraEl !== this.el ? 0 : this._cameraEl.object3D.position.y;
    };

    this.el.sceneEl.addEventListener('loaded', this._onLoaded);
    if (this.el.sceneEl.hasLoaded) this._onLoaded();
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('loaded', this._onLoaded);
  },

  // Works in world space from the head, the camera's world position, which moves both when a control
  // moves the entity and when a headset moves the camera inside a rig. Wherever the head may not go,
  // the entity is moved back by the difference.
  tick: function () {
    const head = this._cameraEl.object3D.getWorldPosition(this._head);
    this._move.subVectors(head, this._previousHead).setY(0);
    if (this._move.lengthSq() < MIN_MOVE_SQ) return;

    const feetY = this.el.object3D.getWorldPosition(this._entityPosition).y - this._eyeHeight;
    this._heights[0] = head.y - TORSO_OFFSET;
    this._heights[1] = feetY + this.data.stepHeight + LOW_RAY_LIFT;

    const resolved = this._resolved.copy(this._previousHead);
    if (this._sweep(resolved, this._move)) {
      // Blocked, so try sliding along the wall.
      this._slide.copy(this._move).projectOnPlane(this._normal);
      if (this._slide.lengthSq() > MIN_SLIDE_SQ) this._sweep(resolved, this._slide);
    }
    this._pushOut(resolved);

    const lift = this._floorLift(resolved, feetY);
    this._apply(resolved.sub(head).setY(lift));
  },

  // The nearest surface ahead at either height, within the raycaster's far.
  _nearestHit: function (from, direction) {
    let nearest: Intersection | undefined;
    for (const height of this._heights) {
      this._raycaster.set(this._origin.set(from.x, height, from.z), direction);
      const [hit] = this.system.intersect(this._raycaster);
      if (hit && (!nearest || hit.distance < nearest.distance)) nearest = hit;
    }
    return nearest;
  },

  // Moves from along move unless a surface is within radius of the way; then leaves it, keeps the
  // surface's horizontal normal for sliding, and returns true.
  _sweep: function (from, move) {
    const length = move.length();
    this._direction.copy(move).divideScalar(length);
    // Everything beyond far is culled, so any hit is a block.
    this._raycaster.far = this.data.radius + length;
    const hit = this._nearestHit(from, this._direction);
    if (!hit) {
      from.add(move);
      return false;
    }
    this._setHorizontalNormal(hit);
    return true;
  },

  // Pushes position out until every surface around it is at least radius away. Each ray starts where
  // the pushes before it left the position, so a wall that two rays meet is only pushed out of once.
  _pushOut: function (position) {
    this._raycaster.far = this.data.radius;
    for (const height of this._heights) {
      for (const direction of PUSH_DIRECTIONS) {
        this._raycaster.set(this._origin.set(position.x, height, position.z), direction);
        this._pushAway(position, direction);
      }
    }
  },

  // Pushes position straight away from the first surface the raycaster meets, to radius from it.
  _pushAway: function (position, direction) {
    const [hit] = this.system.intersect(this._raycaster);
    if (!hit) return;
    this._setHorizontalNormal(hit);
    // Surfaces are hit from either side, so the normal may face along the ray; turn it toward the player.
    const facing = this._normal.dot(direction);
    if (facing > 0) this._normal.negate();
    const gap = hit.distance * Math.abs(facing);
    position.addScaledVector(this._normal, Math.max(0, this.data.radius - gap));
  },

  // How far the feet must rise or fall to stand on the nearest surface below the step-height, or 0 if
  // there is none.
  _floorLift: function (position, feetY) {
    this._origin.set(position.x, feetY + this.data.stepHeight, position.z);
    this._floorRaycaster.set(this._origin, DOWN);
    const [hit] = this.system.intersect(this._floorRaycaster);
    if (!hit) return 0;
    return hit.point.y - feetY;
  },

  // Moves the entity by a world-space correction, whatever its parent's transform.
  _apply: function (correction) {
    const object = this.el.object3D;
    const target = this._entityPosition.add(correction);
    object.position.copy(assertDefined(object.parent, 'room-collision parent').worldToLocal(target));
    this._previousHead.addVectors(this._head, correction);
  },

  // Keeps the hit surface's world normal, flattened to the horizontal.
  _setHorizontalNormal: function (hit) {
    this._normalMatrix.getNormalMatrix(hit.object.matrixWorld);
    // Mesh hits always carry a face.
    const faceNormal = assertDefined(hit.face, 'hit face').normal;
    this._normal.copy(faceNormal).applyMatrix3(this._normalMatrix).setY(0).normalize();
  }
});

export type { CollisionComponent };
