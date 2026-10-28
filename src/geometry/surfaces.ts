import type { Vector3 } from 'three';
import type { OpeningCorners, SurfaceType } from '../types/geometry';
import { assertDefined } from '../utils/assert';
import { QUAD, TWO_QUADS } from './helpers/quads';

interface SurfaceOptions { type: SurfaceType; corners: Vector3[]; positions: number[]; uvScale: number }

// A portal surface is one or two quads of four corners each.
interface SurfaceLayout {
  // Which opening corners the surface spans, in vertex order.
  corners: (from: OpeningCorners, to: OpeningCorners) => Vector3[];
  indices: number[];
  // UV of a quad's corner (0-3) on a unit quad; quadUvs scales it to meters.
  uv: (quadCorner: number) => [number, number];
  // u runs along the edge from corner 0 to this corner, v along the edge from corner 0 to the other.
  uEdge: 1 | 2;
}

// Floor and ceiling are one quad between the openings; sides are two, the left and right walls.
const SURFACE_LAYOUTS: Record<SurfaceType, SurfaceLayout> = {
  floor: {
    corners: (from, to) => [to[0], to[2], from[2], from[0]],
    indices: QUAD,
    uv: corner => [1 - (corner % 2), 1 - Math.floor(corner / 2)],
    uEdge: 1
  },
  ceiling: {
    corners: (from, to) => [to[3], to[1], from[1], from[3]],
    indices: QUAD,
    uv: corner => [corner % 2, 1 - Math.floor(corner / 2)],
    uEdge: 1
  },
  sides: {
    corners: (from, to) => [to[2], to[3], from[0], from[1], from[2], from[3], to[0], to[1]],
    indices: TWO_QUADS,
    uv: corner => [1 - Math.floor(corner / 2), corner % 2],
    uEdge: 2
  }
};

// The world-space corners a surface spans between two openings, in vertex order.
const surfaceCorners = (type: SurfaceType, from: OpeningCorners, to: OpeningCorners) =>
  SURFACE_LAYOUTS[type].corners(from, to);

// UVs in meters: each quad's unit UVs times the lengths of the edges u and v run along.
const quadUvs = (corners: Vector3[], { uv, uEdge }: SurfaceLayout, uvScale: number) => corners.flatMap((_, i) => {
  const quadStart = i - (i % 4);
  const origin = assertDefined(corners[quadStart], 'quad corner');
  const uLength = origin.distanceTo(assertDefined(corners[quadStart + uEdge], 'quad corner'));
  const vLength = origin.distanceTo(assertDefined(corners[quadStart + 3 - uEdge], 'quad corner'));
  const [u, v] = uv(i % 4);
  return [u * uLength * uvScale, v * vLength * uvScale];
});

// A portal surface's geometry. The corners give its UVs; positions are those corners in the local
// space of the element that will hold the mesh.
const surfaceGeometry = ({ type, corners, positions, uvScale }: SurfaceOptions) => {
  const layout = SURFACE_LAYOUTS[type];
  const geom = new THREE.BufferGeometry();
  geom.setIndex(layout.indices);
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(quadUvs(corners, layout, uvScale)), 2));
  geom.computeVertexNormals();
  return geom;
};

export { surfaceCorners, surfaceGeometry };
