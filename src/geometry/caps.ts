import type { BufferGeometry, Vector3 } from 'three';
import { assertDefined } from '../utils/assert';
import { makePlaneUvs } from './helpers/uvs';

interface CapOptions { corners: Vector3[]; isCeiling: boolean; isOutside: boolean; uvScale: number }

const flipGeometry = (geom: BufferGeometry) => {
  const index = assertDefined(geom.getIndex(), 'geometry index');
  for (let i = 0; i < index.count; i += 3) {
    const tempIndex = index.getX(i + 2);
    index.setX(i + 2, index.getX(i + 1));
    index.setX(i + 1, tempIndex);
  }

  index.needsUpdate = true;
};

// Triangulates the corners in the XZ plane, which handles concave rooms. Earcut indexes into the
// contour as given, so vertex i stays corner i and keeps that corner's height.
const capIndices = (corners: Vector3[]) => {
  const contour = corners.map(({ x, z }) => new THREE.Vector2(x, z));
  return THREE.ShapeUtils.triangulateShape(contour, []).flat();
};

// A floor or ceiling spanning the room's wall corners, one vertex per corner.
const capGeometry = ({ corners, isCeiling, isOutside, uvScale }: CapOptions) => {
  const positions = corners.flatMap(({ x, y, z }) => [x, y, z]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setIndex(capIndices(corners));

  // Earcut winds counterclockwise in (x, z) whichever way the walls run, and x cross z is -y, so
  // its triangles face down. Caps face into an inside room (floor up, ceiling down) and out of an
  // outside one (roof up, floor down), so flip an inside floor and an outside ceiling.
  if (isCeiling === isOutside) flipGeometry(geom);

  const uSign = isCeiling ? 1 : -1;
  makePlaneUvs(geom, { uKey: 'x', vKey: 'z', uMult: uSign * uvScale, vMult: uvScale });
  geom.computeVertexNormals();
  return geom;
};

export { capGeometry };
