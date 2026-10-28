import type { BufferGeometry, Vector3 } from 'three';
import { assertDefined } from '../../utils/assert';

type UvCallback = (vertex: Vector3) => [number, number];
type Axis = 'x' | 'y' | 'z';

interface PlaneUvs { uKey: Axis; vKey: Axis; uMult: number; vMult: number }

const makeGeometryUvs = (geom: BufferGeometry, callback: UvCallback) => {
  const indices = assertDefined(geom.getIndex(), 'geometry index').array;
  const pos = geom.getAttribute('position');
  const vertex = new THREE.Vector3();
  const uvs: number[] = [];
  for (const vertexIndex of indices) {
    vertex.set(pos.getX(vertexIndex), pos.getY(vertexIndex), pos.getZ(vertexIndex));
    const [u, v] = callback(vertex);
    uvs[vertexIndex * 2 + 0] = u;
    uvs[vertexIndex * 2 + 1] = v;
  }

  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
};

// Projects each vertex onto two axes, so UVs run in the geometry's own units.
const makePlaneUvs = (geom: BufferGeometry, { uKey, vKey, uMult, vMult }: PlaneUvs) => {
  makeGeometryUvs(geom, point => ([point[uKey] * uMult, point[vKey] * vMult]));
};

export { makePlaneUvs };
