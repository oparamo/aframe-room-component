import type { Intersection } from 'three';
import type { Entity } from '../types/aframe';
import type { CollidableComponent, CollisionSystem } from '../types/collision';
import { isMesh, MESH } from '../builders/helpers/mesh';

const COLLIDABLE = 'room-collidable';

const isSwitchedOff = (el: Entity) => (el.components[COLLIDABLE] as CollidableComponent | undefined)?.data === false;

// An element collides when neither it nor any element it sits inside has room-collidable switched off.
const collides = (el: Entity) => {
  for (let node: Entity | null = el; node && node !== el.sceneEl; node = node.parentEl) {
    if (isSwitchedOff(node)) return false;
  }
  return true;
};

// Every room-collidable element, and the rays room-collision casts against their meshes.
AFRAME.registerSystem<CollisionSystem>('room-collision', {
  init: function () {
    this._surfaces = new Set();
    this._active = null;
    // Stands in for each surface's mesh during a raycast. Mesh.raycast reads only the geometry,
    // material and world matrix, and DoubleSide makes every surface block from both of its faces,
    // whatever its render material's side.
    this._probe = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  },
  // Adds the element, or notes that its switch changed; either way the list is recomputed on the next ray.
  updateSurface: function (el) {
    this._surfaces.add(el);
    this._active = null;
  },
  removeSurface: function (el) {
    this._surfaces.delete(el);
    this._active = null;
  },
  // The meshes of colliding surfaces, read now, so a rebuild that swaps a mesh's geometry needs no
  // notice. A surface without a mesh, such as a room or a door's opening, has nothing to hit.
  meshes: function () {
    this._active ??= [...this._surfaces].filter(collides);
    return this._active.flatMap((el) => {
      const mesh = el.getObject3D(MESH);
      if (!isMesh(mesh)) return [];
      return [mesh];
    });
  },
  // The ray's hits on every colliding mesh, nearest first.
  intersect: function (raycaster) {
    const hits: Intersection[] = [];
    for (const mesh of this.meshes()) {
      this._probe.geometry = mesh.geometry;
      this._probe.matrixWorld.copy(mesh.matrixWorld);
      const meshHits: Intersection[] = [];
      this._probe.raycast(raycaster, meshHits);
      for (const hit of meshHits) hits.push({ ...hit, object: mesh });
    }
    return hits.sort((a, b) => a.distance - b.distance);
  }
});
