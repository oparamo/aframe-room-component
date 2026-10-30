import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import type { Entity } from '../../types/aframe';
import type { BuildingEl, OpeningEl } from '../../types/elements';
import { COLLIDABLE } from '../../utils/surfaceClasses';

interface MeshOptions { el: BuildingEl; geom: BufferGeometry; fallbackMaterial?: Material }

// A-Frame's own key for an entity's mesh, where its material component looks for it.
const MESH = 'mesh';
// The invisible, double-sided copy of a surface that room-collision raycasts.
const COLLIDER = 'collider';

let colliderMaterial: Material | undefined;

// Shared by every collider and never disposed. Mesh.raycast skips a mesh without a material, and
// DoubleSide makes the surface block from both of its faces, whatever the render material's side.
const sharedColliderMaterial = () => {
  colliderMaterial ??= new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  return colliderMaterial;
};

const makeCollider = (geom: BufferGeometry) => {
  const collider = new THREE.Mesh(geom, sharedColliderMaterial());
  collider.visible = false;
  return collider;
};

const getMaterial = (el: Entity | null | undefined) => el?.components.material?.material;

const isMesh = (object: Object3D | undefined): object is Mesh => object instanceof THREE.Mesh;

// Reuses the element's mesh across rebuilds. The old geometry is freed, since three.js only
// releases GPU buffers on dispose(). The material comes from the element, then its parent, then the
// fallback; with none found, the mesh keeps the one it has, which on a first build without one is the
// default new THREE.Mesh() applies.
const applyMesh = ({ el, geom, fallbackMaterial }: MeshOptions) => {
  const material = getMaterial(el) ?? getMaterial(el.parentEl) ?? fallbackMaterial;
  const mesh = el.getObject3D(MESH);
  if (isMesh(mesh)) {
    mesh.geometry.dispose();
    mesh.geometry = geom;
    if (material) mesh.material = material;
  } else {
    el.setObject3D(MESH, new THREE.Mesh(geom, material));
  }
};

// Gives the element a collider on its mesh's geometry, so it blocks from both sides without another
// buffer. A rebuild points the existing collider at the new geometry. The builds call it right after
// applyMesh, so the mesh is there.
const applyCollider = (el: Entity) => {
  const mesh = el.getObject3D(MESH) as Mesh;
  const collider = el.getObject3D(COLLIDER);
  if (isMesh(collider)) collider.geometry = mesh.geometry;
  else el.setObject3D(COLLIDER, makeCollider(mesh.geometry));
};

// Its geometry is the mesh's, so it's left for the mesh to free.
const removeCollider = (el: Entity) => {
  if (el.getObject3D(COLLIDER)) el.removeObject3D(COLLIDER);
};

// Classes the element's surface for room-collision and gives it a collider.
const enableCollision = (el: Entity, className: string) => {
  el.classList.add(className);
  applyCollider(el);
};

const disableCollision = (el: Entity, className: string) => {
  el.classList.remove(className);
  removeCollider(el);
};

// Takes the element's mesh and collider off it and frees the geometry. The material is left alone,
// since it belongs to the element's material component, or to whoever assigned it.
const removeMesh = (el: Entity) => {
  removeCollider(el);
  const mesh = el.getObject3D(MESH);
  if (!isMesh(mesh)) return;
  el.removeObject3D(MESH);
  mesh.geometry.dispose();
};

// An invisible collidable quad across an opening, so the player cannot walk through it. The
// geometry is in the wall's local space, and the opening sits on the wall unrotated, so moving the
// collider back by the opening's position puts it where the geometry says.
const addBlocker = (openingEl: OpeningEl, geom: BufferGeometry) => {
  const blocker = makeCollider(geom);
  blocker.position.copy(openingEl.object3D.position).negate();
  openingEl.setObject3D(COLLIDER, blocker);
  openingEl.classList.add(COLLIDABLE);
};

// Removes the blocker left by a previous build. Its geometry is its own, so it's freed here.
const removeBlocker = (openingEl: OpeningEl) => {
  openingEl.classList.remove(COLLIDABLE);
  const blocker = openingEl.getObject3D(COLLIDER);
  if (!isMesh(blocker)) return;
  openingEl.removeObject3D(COLLIDER);
  blocker.geometry.dispose();
};

export {
  addBlocker, applyMesh, COLLIDER, disableCollision, enableCollision, getMaterial, isMesh, MESH, removeBlocker,
  removeMesh
};
