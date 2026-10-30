import type { Path, Vector3 } from 'three';
import type { OpeningEdge, OpeningEdges, OpeningSize, WallSpan } from '../types/geometry';
import { assertDefined } from '../utils/assert';
import { QUAD } from './helpers/quads';
import { makePlaneUvs } from './helpers/uvs';

interface WallHeights { start: number; end: number }

// Where a portal crosses a wall. Both points are in the room's local space.
interface OpeningPlacement { span: WallSpan; wallStart: Vector3; portalAt: Vector3; halfWidth: number }

// An opening at openingX along its wall, cut to the portal's size.
interface OpeningCut { span: WallSpan; openingX: number; portal: OpeningSize }

interface WallOptions { span: WallSpan; holes: Path[]; uvScale: number }

const HAIR = 0.0001; // Small epsilon to prevent z-fighting at opening edges.

// Corners as fractions of (width, length). The room component guarantees four walls here.
const RECTANGLE_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;

// The (x, z) corners of a width by length rectangle, one per wall.
const rectangleCorners = (width: number, length: number) =>
  RECTANGLE_CORNERS.map(([u, v]) => [u * width, v * length] as const);

// Shoelace formula over the closed loop of corners: positive sum means clockwise winding in XZ plane.
const isClockwise = (corners: Vector3[]) => {
  let cwSum = 0;
  for (const [i, { x, z }] of corners.entries()) {
    const next = assertDefined(corners[(i + 1) % corners.length], 'next corner');
    cwSum += (next.x - x) * (next.z + z);
  }
  return cwSum > 0;
};

const wallSpan = (start: Vector3, end: Vector3, heights: WallHeights): WallSpan => {
  const gapX = end.x - start.x;
  const gapZ = end.z - start.z;
  return {
    length: Math.hypot(gapX, gapZ),
    gapX,
    gapY: end.y - start.y,
    gapZ,
    height: heights.start,
    heightGap: heights.end - heights.start
  };
};

// The rotation about y that turns the wall's local x axis along the span.
const wallAngle = ({ gapX, gapZ }: WallSpan) => -Math.atan2(gapZ, gapX);

// The opening's position on its wall: x along the wall, clamped so the opening stays on it, and y
// on the wall's base line, which slopes when the next wall stands higher or lower.
const openingPlacement = ({ span, wallStart, portalAt, halfWidth }: OpeningPlacement) => {
  const wallDir = new THREE.Vector2(span.gapX, span.gapZ).normalize();
  const portalOffset = new THREE.Vector2(portalAt.x - wallStart.x, portalAt.z - wallStart.z);

  let x = portalOffset.dot(wallDir);
  x = Math.max(x, halfWidth + HAIR);
  x = Math.min(x, span.length - halfWidth - HAIR);

  return { x, y: (x / span.length) * span.gapY };
};

// side = -1 is the left edge of the opening, side = +1 is the right edge.
const openingEdge = ({ span, openingX, portal }: OpeningCut, side: -1 | 1): OpeningEdge => {
  const ptX = openingX + portal.width / 2 * side;
  const along = ptX / span.length;
  // Interpolate wall-base Y for sloped walls (non-zero gapY).
  const baseY = along * span.gapY;
  const bottomY = baseY + portal.floorHeight;
  const ceilingY = span.height + along * span.heightGap;
  // Clamp the top of the opening to the ceiling, leaving a HAIR seam.
  const topY = Math.min(bottomY + portal.height, baseY + ceilingY - HAIR);
  return { ptX, bottomY, topY };
};

const openingEdges = (cut: OpeningCut): OpeningEdges => ({ left: openingEdge(cut, -1), right: openingEdge(cut, 1) });

// Cutting the opening as a Shape hole handles both doors (floorHeight=0) and windows
// (floorHeight>0) without leaving gaps in the wall mesh.
const holePath = ({ left, right }: OpeningEdges) => {
  const hole = new THREE.Path();
  hole.moveTo(left.ptX, left.bottomY);
  hole.lineTo(left.ptX, left.topY);
  hole.lineTo(right.ptX, right.topY);
  hole.lineTo(right.ptX, right.bottomY);
  hole.closePath();
  return hole;
};

// A quad filling an opening, in the wall's local space.
const openingQuad = ({ left, right }: OpeningEdges) => {
  const geom = new THREE.BufferGeometry();
  geom.setIndex(QUAD);
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    left.ptX, left.bottomY, 0,
    left.ptX, left.topY, 0,
    right.ptX, right.bottomY, 0,
    right.ptX, right.topY, 0
  ]), 3));
  return geom;
};

// The wall's face in its local XY plane, from its base to its height at each end, with the
// openings cut out.
const wallGeometry = ({ span, holes, uvScale }: WallOptions) => {
  const shape = new THREE.Shape();
  shape.moveTo(0, span.height);
  shape.lineTo(0, 0);
  shape.lineTo(span.length, span.gapY);
  shape.lineTo(span.length, span.gapY + span.height + span.heightGap);
  shape.holes.push(...holes);

  const geom = new THREE.ShapeGeometry(shape);
  makePlaneUvs(geom, { uKey: 'x', vKey: 'y', uMult: uvScale, vMult: uvScale });
  geom.computeVertexNormals();
  return geom;
};

export {
  holePath,
  isClockwise,
  openingEdges,
  openingQuad,
  openingPlacement,
  rectangleCorners,
  wallAngle,
  wallGeometry,
  wallSpan
};
