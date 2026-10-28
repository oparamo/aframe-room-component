import type { Matrix3, Object3D, Raycaster, Vector3 } from 'three';
import type { Component, Entity } from '../types/aframe';
import { isMesh } from '../builders/helpers/mesh';
import { COLLIDABLE, WALKABLE } from '../utils/surfaceClasses';

interface CollisionComponent extends Component<{ radius: number }> {
  wallMeshes: Object3D[];
  floorMeshes: Object3D[];
  _cameraEl: Entity;
  _eyeHeight: number;
  _raycaster: Raycaster;
  _floorRaycaster: Raycaster;
  _previousPosition: Vector3;
  _move: Vector3;
  _direction: Vector3;
  _origin: Vector3;
  _cameraPosition: Vector3;
  _slideDirection: Vector3;
  _normal: Vector3;
  _normalMatrix: Matrix3;
  _floorOrigin: Vector3;
  _onLoaded: () => void;
  _onBuildComplete: () => void;
  _refreshMeshes(): void;
  _snapToFloor(position: Vector3): void;
  _tryMove(moveVector: Vector3, position: Vector3): boolean;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const FLOOR_SEARCH_HEIGHT = 1.5;
const MIN_MOVE_SQ = 0.000001;
const MIN_SLIDE_SQ = 0.0001;
const TORSO_OFFSET = 0.6;

// The meshes the builds set on the scene's elements with the class.
const meshesWithClass = (el: Entity, className: string) =>
  [...el.sceneEl.querySelectorAll<Entity>(`.${className}`)].flatMap(classedEl => Object.values(classedEl.object3DMap).filter(isMesh));

AFRAME.registerComponent<CollisionComponent>('room-collision', {
  schema: {
    radius: { type: 'number', default: 0.4 }
  },

  init: function () {
    this.wallMeshes = [];
    this.floorMeshes = [];

    // Supports rig pattern (room-collision on parent, camera is a child)
    // and direct pattern (room-collision on the camera entity itself).
    this._cameraEl = this.el.querySelector<Entity>('[camera]') ?? this.el;

    this._raycaster = new THREE.Raycaster();
    this._floorRaycaster = new THREE.Raycaster();
    this._previousPosition = new THREE.Vector3();
    this._move = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._cameraPosition = new THREE.Vector3();
    this._slideDirection = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._normalMatrix = new THREE.Matrix3();
    this._floorOrigin = new THREE.Vector3();

    this._onLoaded = () => {
      this._previousPosition.copy(this.el.object3D.position);
      // In rig mode the rig sits at floor level so no eye-height offset is needed.
      // In direct camera mode snapshot the camera's actual Y as eye height above floor.
      this._eyeHeight = this._cameraEl !== this.el ? 0 : this._cameraEl.object3D.position.y;
      this._refreshMeshes();
    };
    this._onBuildComplete = () => this._refreshMeshes();

    this.el.sceneEl.addEventListener('loaded', this._onLoaded);
    this.el.sceneEl.addEventListener('room-building-complete', this._onBuildComplete);
    if (this.el.sceneEl.hasLoaded) this._onLoaded();
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('loaded', this._onLoaded);
    this.el.sceneEl.removeEventListener('room-building-complete', this._onBuildComplete);
  },

  _refreshMeshes: function () {
    this.wallMeshes = meshesWithClass(this.el, COLLIDABLE);
    this.floorMeshes = meshesWithClass(this.el, WALKABLE);
  },

  tick: function () {
    const position = this.el.object3D.position;
    this._move.subVectors(position, this._previousPosition);

    if (this._move.lengthSq() < MIN_MOVE_SQ) return;

    // Ray origin: previous camera world position at mid-torso height.
    // Y from the current camera position is fine, since WASD doesn't move vertically.
    this._cameraEl.object3D.getWorldPosition(this._cameraPosition);
    this._origin.set(this._previousPosition.x, this._cameraPosition.y - TORSO_OFFSET, this._previousPosition.z);

    // Reset to previous position so _tryMove applies the delta cleanly
    // from a known baseline, whether blocked or not.
    position.copy(this._previousPosition);

    if (!this._tryMove(this._move, position)) {
      // Blocked, so try sliding along the wall's XZ normal.
      this._slideDirection.copy(this._move).projectOnPlane(this._normal);
      if (this._slideDirection.lengthSq() > MIN_SLIDE_SQ) {
        this._tryMove(this._slideDirection, position);
      }
    }

    this._snapToFloor(position);
    this._previousPosition.copy(position);
  },

  // Casts a ray straight down and snaps position.y to the nearest floor surface.
  // In rig mode position.y IS the floor height; in direct camera mode it's floor + eye height.
  _snapToFloor: function (position) {
    this._floorOrigin.set(position.x, position.y + FLOOR_SEARCH_HEIGHT, position.z);
    this._floorRaycaster.set(this._floorOrigin, DOWN);
    const [hit] = this._floorRaycaster.intersectObjects(this.floorMeshes);
    if (!hit) return;
    position.y = hit.point.y + this._eyeHeight;
  },

  _tryMove: function (moveVector, position) {
    this._raycaster.set(this._origin, this._direction.copy(moveVector).normalize());
    const [hit] = this._raycaster.intersectObjects(this.wallMeshes);

    // Mesh hits always carry a face; the check only narrows the type.
    if (hit?.face && hit.distance < this.data.radius + moveVector.length()) {
      // Store world-space wall normal for the caller (used for sliding).
      this._normalMatrix.getNormalMatrix(hit.object.matrixWorld);
      this._normal.copy(hit.face.normal).applyMatrix3(this._normalMatrix).normalize();
      this._normal.y = 0;
      return false;
    }

    position.add(moveVector);
    return true;
  }
});

export type { CollisionComponent };
