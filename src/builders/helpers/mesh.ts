import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import type { Entity } from '../../types/aframe';
import type { BuildingEl, OpeningEl } from '../../types/elements';
import { COLLIDABLE } from '../../utils/surfaceClasses';

interface MeshOptions { el: BuildingEl; geom: BufferGeometry; fallbackMaterial?: Material }

// A-Frame's own key for an entity's mesh, where its material component looks for it.
const MESH = 'mesh';
const BLOCKER = 'blocker';

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

// Takes the element's mesh off it and frees the geometry. The material is left alone, since it
// belongs to the element's material component, or to whoever assigned it.
const removeMesh = (el: Entity, objectName = MESH) => {
  const mesh = el.getObject3D(objectName);
  if (!isMesh(mesh)) return null;
  el.removeObject3D(objectName);
  mesh.geometry.dispose();
  return mesh;
};

// An invisible collidable quad across an opening, so the player cannot walk through it. The
// geometry is in the wall's local space, and the opening sits on the wall unrotated, so moving the
// mesh back by the opening's position puts it where the geometry says.
const addBlocker = (openingEl: OpeningEl, geom: BufferGeometry) => {
  // MeshBasicMaterial is required, because Mesh.raycast returns early when material is undefined.
  // DoubleSide so raycasts from both the room interior and exterior are caught.
  const blockMesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  blockMesh.visible = false;
  blockMesh.position.copy(openingEl.object3D.position).negate();
  openingEl.setObject3D(BLOCKER, blockMesh);
  openingEl.classList.add(COLLIDABLE);
};

// Removes the blocker left by a previous build, freeing its geometry and the material addBlocker made.
const removeBlocker = (openingEl: OpeningEl) => {
  const blocker = removeMesh(openingEl, BLOCKER);
  for (const material of [blocker?.material ?? []].flat()) material.dispose();
};

export { addBlocker, applyMesh, getMaterial, isMesh, removeBlocker, removeMesh };
