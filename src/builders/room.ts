import type { Path, Vector3 } from 'three';
import type { BuildingEl, BuildState, OpeningEl, PortalEl, RoomEl, WallEl } from '../types/elements';
import type { OpeningCorners, OpeningEdges, WallSpan } from '../types/geometry';
import { capGeometry } from '../geometry/caps';
import {
  blockerGeometry, holePath, isClockwise, openingEdges, openingPlacement, rectangleCorners, wallAngle, wallGeometry,
  wallSpan
} from '../geometry/walls';
import { assertDefined } from '../utils/assert';
import { COLLIDABLE, WALKABLE } from '../utils/surfaceClasses';
import { addBlocker, applyMesh, removeBlocker, WALL_MESH } from './helpers/mesh';
import { capOf, dataOf, openingsOf, wallHeight, wallsOf } from './helpers/structure';

interface CapOptions { walls: WallEl[]; capEl: BuildingEl; kind: 'floor' | 'ceiling'; isOutside: boolean }

// A wall being built, with its span to the next wall.
interface WallBuild { wallEl: WallEl; span: WallSpan; state: BuildState }

// Walls form a closed loop, so the last wall's neighbor is the first.
const nextWallOf = (walls: WallEl[], index: number) => assertDefined(walls[(index + 1) % walls.length], 'next wall');

// Returns the walls in build order, reversed from document order when needed. A width/length room
// places its corners in document order, so the reversal never feeds back into the next build.
const wallsInBuildOrder = (authored: WallEl[], isOutside: boolean) => {
  const walls = [...authored];
  if (isClockwise(walls.map(wallEl => wallEl.object3D.position)) !== isOutside) walls.reverse();
  return walls;
};

const placeRectangleWalls = (walls: WallEl[], width: number, length: number) => {
  for (const [i, [x, z]] of rectangleCorners(width, length).entries()) {
    assertDefined(walls[i], 'rectangle wall').object3D.position.set(x, 0, z);
  }
};

const capCorner = (wallEl: WallEl, isCeiling: boolean) => {
  const lift = isCeiling ? wallHeight(wallEl) : 0;
  const { x, y, z } = wallEl.object3D.position;
  return new THREE.Vector3(x, y + lift, z);
};

const buildCap = ({ walls, capEl, kind, isOutside }: CapOptions) => {
  const isCeiling = kind === 'ceiling';
  const corners = walls.map(wallEl => capCorner(wallEl, isCeiling));
  const { uvScale } = dataOf(capEl, kind);
  applyMesh({ el: capEl, objectName: kind, geom: capGeometry({ corners, isCeiling, isOutside, uvScale }) });
};

// Places the opening on the wall where the portal crosses it. The portal is measured in the room's
// local space, the frame buildWall works in, so the room's own position, rotation and scale apply.
const positionOpening = ({ wallEl, span }: WallBuild, openingEl: OpeningEl, portalEl: PortalEl) => {
  const portalAt = portalEl.object3D.getWorldPosition(new THREE.Vector3());
  wallEl.parentEl.object3D.worldToLocal(portalAt);

  const halfWidth = dataOf(portalEl, 'portal').width / 2;
  const { x, y } = openingPlacement({ span, wallStart: wallEl.object3D.position, portalAt, halfWidth });
  openingEl.object3D.position.set(x, y, 0);
};

// The opening's corners in world space, in the order OpeningCorners describes, for the portal build
// to join.
const openingCorners = (wallEl: WallEl, { left, right }: OpeningEdges): OpeningCorners => {
  const corner = (ptX: number, y: number): Vector3 => wallEl.object3D.localToWorld(new THREE.Vector3(ptX, y, 0));
  return [corner(left.ptX, left.bottomY), corner(left.ptX, left.topY), corner(right.ptX, right.bottomY), corner(right.ptX, right.topY)];
};

// Positions the opening and records its world corners; returns the hole to cut, if it has a portal.
const cutOpening = (wall: WallBuild, openingEl: OpeningEl): Path | null => {
  const { state } = wall;
  const portalEl = state.portalOf.get(openingEl);
  state.cornersOf.delete(openingEl);
  removeBlocker(openingEl);
  if (!portalEl) return null;

  positionOpening(wall, openingEl, portalEl);
  const portal = dataOf(portalEl, 'portal');
  const edges = openingEdges({ span: wall.span, openingX: openingEl.object3D.position.x, portal });
  state.cornersOf.set(openingEl, openingCorners(wall.wallEl, edges));
  if (portal.floorHeight > 0) addBlocker(openingEl, blockerGeometry(edges));
  return holePath(edges);
};

const buildWall = (wallEl: WallEl, nextWallEl: WallEl, state: BuildState) => {
  const heights = { start: wallHeight(wallEl), end: wallHeight(nextWallEl) };
  const span = wallSpan(wallEl.object3D.position, nextWallEl.object3D.position, heights);
  wallEl.object3D.rotation.y = wallAngle(span);

  const holes = openingsOf(wallEl).flatMap(openingEl => cutOpening({ wallEl, span, state }, openingEl) ?? []);
  const { uvScale } = dataOf(wallEl, 'wall');
  applyMesh({ el: wallEl, objectName: WALL_MESH, geom: wallGeometry({ span, holes, uvScale }) });
  wallEl.classList.add(COLLIDABLE);
};

const buildRoom = (roomEl: RoomEl, state: BuildState) => {
  const { outside, length, width } = dataOf(roomEl, 'room');
  const authored = wallsOf(roomEl);
  if (width && length) placeRectangleWalls(authored, width, length);

  const walls = wallsInBuildOrder(authored, outside);

  for (const [i, wallEl] of walls.entries()) {
    buildWall(wallEl, nextWallOf(walls, i), state);
  }

  const floorEl = capOf(roomEl, 'floor');
  if (floorEl) {
    buildCap({ walls, capEl: floorEl, kind: 'floor', isOutside: outside });
    floorEl.classList.add(WALKABLE);
  }
  const ceilingEl = capOf(roomEl, 'ceiling');
  if (ceilingEl) buildCap({ walls, capEl: ceilingEl, kind: 'ceiling', isOutside: outside });
};

export { buildRoom };
