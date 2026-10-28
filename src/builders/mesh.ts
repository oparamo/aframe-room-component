import type { BufferGeometry, Material } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingEl, OpeningEl, WallEl } from '../types/elements';
import { COLLIDABLE } from '../utils/surfaceClasses';

interface MeshOptions { el: BuildingEl; objectName: string; geom: BufferGeometry; fallbackMaterial?: Material }

interface WindowBlocker { wallEl: WallEl; openingEl: OpeningEl; geom: BufferGeometry }

const getMaterial = (el: Entity | null | undefined) => el?.components.material?.material;

// Reuses the element's mesh across rebuilds. The old geometry is freed, since three.js only
// releases GPU buffers on dispose(). The material comes from the element, then its parent, then the
// fallback; with none found, the mesh keeps the one it has, which on a first build without one is the
// default new THREE.Mesh() applies.
const applyMesh = ({ el, objectName, geom, fallbackMaterial }: MeshOptions) => {
  const material = getMaterial(el) ?? getMaterial(el.parentEl) ?? fallbackMaterial;
  if (el.mesh) {
    el.mesh.geometry.dispose();
    el.mesh.geometry = geom;
    if (material) el.mesh.material = material;
    return;
  }
  el.mesh = new THREE.Mesh(geom, material);
  el.setObject3D(objectName, el.mesh);
};

// An invisible collidable quad across a window, so the player cannot walk through it at torso height.
const addWindowBlocker = ({ wallEl, openingEl, geom }: WindowBlocker) => {
  // MeshBasicMaterial is required, because Mesh.raycast returns early when material is undefined.
  // DoubleSide so raycasts from both the room interior and exterior are caught.
  const blockMesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  blockMesh.visible = false;
  wallEl.object3D.add(blockMesh);
  openingEl.mesh = blockMesh;
  openingEl.classList.add(COLLIDABLE);
};

// Removes the window-blocker mesh left by a previous build. Its geometry and material were made
// by the build, so both are freed.
const removeWindowBlocker = (openingEl: OpeningEl) => {
  const blocker = openingEl.mesh;
  if (!blocker) return;
  blocker.parent?.remove(blocker);
  blocker.geometry.dispose();
  for (const material of [blocker.material].flat()) material.dispose();
  openingEl.mesh = null;
};

export { addWindowBlocker, applyMesh, getMaterial, removeWindowBlocker };
