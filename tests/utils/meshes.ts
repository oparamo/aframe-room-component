import type { BufferAttribute, Mesh } from 'three';
import type { Entity } from '../../src/types/aframe';
import { assertDefined } from '../../src/utils/assert';

// Rounded so float noise doesn't fail an exact comparison; adding 0 turns -0 into 0.
const round = (n: number) => Math.round(n * 1e4) / 1e4 + 0;

// The visible mesh a build put on the element. Colliders are invisible, so they don't count.
const meshOf = (el: Entity): Mesh => assertDefined(
  el.object3D.children.find((child): child is Mesh => child instanceof THREE.Mesh && child.visible),
  'built mesh'
);

const vectorsOf = (attribute: BufferAttribute) =>
  Array.from({ length: attribute.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(attribute, i));

// Each vertex position in world space, as rounded [x, y, z].
const worldPositions = (mesh: Mesh) => {
  mesh.updateWorldMatrix(true, false);
  return vectorsOf(mesh.geometry.getAttribute('position') as BufferAttribute)
    .map(vertex => vertex.applyMatrix4(mesh.matrixWorld).toArray().map(round));
};

// Each vertex normal in world space, as rounded [x, y, z].
const worldNormals = (mesh: Mesh) => {
  mesh.updateWorldMatrix(true, false);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  return vectorsOf(mesh.geometry.getAttribute('normal') as BufferAttribute)
    .map(normal => normal.applyMatrix3(normalMatrix).normalize().toArray().map(round));
};

// The middle of the mesh's bounding box in world space.
const worldCenter = (mesh: Mesh) => {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  const box = assertDefined(mesh.geometry.boundingBox, 'bounding box');
  return box.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
};

export { meshOf, worldCenter, worldNormals, worldPositions };
