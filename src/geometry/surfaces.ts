import type { Vector3 } from 'three';
import type { OpeningCorners, SurfaceType } from '../types/geometry';
import { assertDefined } from '../utils/assert';
import { QUAD, TWO_QUADS } from './helpers/quads';
import { capUSign } from './helpers/uvs';

// roomCorners are the surface's corners in the from room's local space, which its UVs are measured in;
// positions are the same corners in the local space of the element that will hold the mesh.
interface SurfaceOptions { type: SurfaceType; roomCorners: Vector3[]; positions: number[]; uvScale: number }

type UvLayout = (roomCorners: Vector3[], uvScale: number) => number[];

// A portal surface is one or two quads of four corners each.
interface SurfaceLayout {
  // Which opening corners the surface spans, in vertex order.
  corners: (from: OpeningCorners, to: OpeningCorners) => Vector3[];
  indices: number[];
  uvs: UvLayout;
}

// A floor or ceiling maps the room's x and z the way the room's own floor or ceiling does, so its
// pattern carries on through the doorway.
const capUvs = (isCeiling: boolean): UvLayout => (roomCorners, uvScale) =>
  roomCorners.flatMap(({ x, z }) => [capUSign(isCeiling) * x * uvScale, z * uvScale]);

// A side's UV at each quad corner (0-3) on a unit quad. u runs along the edge from corner 0 to corner 2,
// v along the edge from corner 0 to corner 1.
const sideUnitUv = (corner: number) => [1 - Math.floor(corner / 2), corner % 2] as const;

// Sides tile per meter of each quad's edges: its unit UVs times the lengths of the edges u and v run along.
const sideUvs: UvLayout = (roomCorners, uvScale) => roomCorners.flatMap((_, i) => {
  const quadStart = i - (i % 4);
  const origin = assertDefined(roomCorners[quadStart], 'quad corner');
  const uLength = origin.distanceTo(assertDefined(roomCorners[quadStart + 2], 'quad corner'));
  const vLength = origin.distanceTo(assertDefined(roomCorners[quadStart + 1], 'quad corner'));
  const [u, v] = sideUnitUv(i % 4);
  return [u * uLength * uvScale, v * vLength * uvScale];
});

// Floor and ceiling are one quad between the openings; sides are two, the left and right walls.
const SURFACE_LAYOUTS: Record<SurfaceType, SurfaceLayout> = {
  floor: {
    corners: (from, to) => [to[0], to[2], from[2], from[0]],
    indices: QUAD,
    uvs: capUvs(false)
  },
  ceiling: {
    corners: (from, to) => [to[3], to[1], from[1], from[3]],
    indices: QUAD,
    uvs: capUvs(true)
  },
  sides: {
    corners: (from, to) => [to[2], to[3], from[0], from[1], from[2], from[3], to[0], to[1]],
    indices: TWO_QUADS,
    uvs: sideUvs
  }
};

// The world-space corners a surface spans between two openings, in vertex order.
const surfaceCorners = (type: SurfaceType, from: OpeningCorners, to: OpeningCorners) =>
  SURFACE_LAYOUTS[type].corners(from, to);

// A portal surface's geometry.
const surfaceGeometry = ({ type, roomCorners, positions, uvScale }: SurfaceOptions) => {
  const layout = SURFACE_LAYOUTS[type];
  const geom = new THREE.BufferGeometry();
  geom.setIndex(layout.indices);
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(layout.uvs(roomCorners, uvScale)), 2));
  geom.computeVertexNormals();
  return geom;
};

export { surfaceCorners, surfaceGeometry };
