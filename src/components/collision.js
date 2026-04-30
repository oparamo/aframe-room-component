/* global AFRAME, THREE */

const DOWN = new THREE.Vector3(0, -1, 0);
const FLOOR_SEARCH_HEIGHT = 1.5;
const MIN_MOVE_SQ = 0.000001;
const MIN_SLIDE_SQ = 0.0001;
const TORSO_OFFSET = 0.6;

AFRAME.registerComponent('room-collision', {
  schema: {
    radius: { type: 'number', default: 0.4 }
  },

  init: function () {
    this.wallMeshes = [];
    this.floorMeshes = [];

    // Supports rig pattern (room-collision on parent, camera is a child)
    // and direct pattern (room-collision on the camera entity itself).
    this._cameraEl = this.el.querySelector('[camera]') || this.el;

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
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('loaded', this._onLoaded);
    this.el.sceneEl.removeEventListener('room-building-complete', this._onBuildComplete);
  },

  _refreshMeshes: function () {
    this.wallMeshes = [...this.el.sceneEl.querySelectorAll('.collidable')]
      .flatMap(el => el.mesh ? [el.mesh] : []);
    this.floorMeshes = [...this.el.sceneEl.querySelectorAll('.walkable')]
      .flatMap(el => el.mesh ? [el.mesh] : []);
  },

  tick: function () {
    const position = this.el.object3D.position;
    this._move.subVectors(position, this._previousPosition);

    if (this._move.lengthSq() < MIN_MOVE_SQ) return;

    // Ray origin: previous camera world position at mid-torso height.
    // Y from current camera position is fine — WASD doesn't move vertically.
    this._cameraEl.object3D.getWorldPosition(this._cameraPosition);
    this._origin.set(this._previousPosition.x, this._cameraPosition.y - TORSO_OFFSET, this._previousPosition.z);

    // Reset to previous position so _tryMove applies the delta cleanly
    // from a known baseline, whether blocked or not.
    position.copy(this._previousPosition);

    if (!this._tryMove(this._move, position)) {
      // Blocked — try sliding along the wall's XZ normal.
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
    const hits = this._floorRaycaster.intersectObjects(this.floorMeshes);
    if (hits.length === 0) return;
    position.y = hits[0].point.y + this._eyeHeight;
  },

  _tryMove: function (moveVector, position) {
    this._raycaster.set(this._origin, this._direction.copy(moveVector).normalize());
    const hits = this._raycaster.intersectObjects(this.wallMeshes);

    if (hits.length > 0 && hits[0].distance < this.data.radius + moveVector.length()) {
      // Store world-space wall normal for the caller (used for sliding).
      this._normalMatrix.getNormalMatrix(hits[0].object.matrixWorld);
      this._normal.copy(hits[0].face.normal).applyMatrix3(this._normalMatrix).normalize();
      this._normal.y = 0;
      return false;
    }

    position.add(moveVector);
    return true;
  }
});
