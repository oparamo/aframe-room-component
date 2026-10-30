import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import type { Entity } from '../../types/aframe';
import type { BuildingEl } from '../../types/elements';

interface MeshOptions { el: BuildingEl; geom: BufferGeometry; fallbackMaterial?: Material }

// A-Frame's own key for an entity's mesh, where its material component looks for it.
const MESH = 'mesh';

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

// A mesh nothing renders, for collision alone, such as the pane across a window.
const applyHiddenMesh = (el: BuildingEl, geom: BufferGeometry) => {
  applyMesh({ el, geom });
  (el.getObject3D(MESH) as Mesh).visible = false;
};

// Takes the element's mesh off it and frees the geometry. The material is left alone, since it
// belongs to the element's material component, or to whoever assigned it.
const removeMesh = (el: Entity) => {
  const mesh = el.getObject3D(MESH);
  if (!isMesh(mesh)) return;
  el.removeObject3D(MESH);
  mesh.geometry.dispose();
};

export { applyHiddenMesh, applyMesh, getMaterial, isMesh, MESH, removeMesh };
