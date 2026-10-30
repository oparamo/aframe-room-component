import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import type { Entity } from '../../types/aframe';
import type { BuildingEl } from '../../types/elements';

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

// A surface's collider shares its mesh's geometry, so it blocks without another buffer, and the mesh
// frees it. An element with no mesh, such as an opening, owns its collider's geometry.
const ownsColliderGeometry = (el: Entity) => !el.getObject3D(MESH);

// A rebuild points the existing collider at the new geometry.
const applyCollider = (el: Entity, geom: BufferGeometry) => {
  const collider = el.getObject3D(COLLIDER);
  if (!isMesh(collider)) {
    el.setObject3D(COLLIDER, makeCollider(geom));
    return;
  }
  if (ownsColliderGeometry(el)) collider.geometry.dispose();
  collider.geometry = geom;
};

const removeCollider = (el: Entity) => {
  const collider = el.getObject3D(COLLIDER);
  if (!isMesh(collider)) return;
  el.removeObject3D(COLLIDER);
  if (ownsColliderGeometry(el)) collider.geometry.dispose();
};

// Classes the element's surface for room-collision and gives it a collider, on its mesh's geometry
// unless given its own. The builds call it right after applyMesh, so a surface's mesh is there.
const enableCollision = (el: Entity, className: string, geom = (el.getObject3D(MESH) as Mesh).geometry) => {
  el.classList.add(className);
  applyCollider(el, geom);
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

export { applyMesh, COLLIDER, disableCollision, enableCollision, getMaterial, isMesh, MESH, removeMesh };
