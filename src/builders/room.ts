import type { Path } from 'three';
import type { BuildingEl, OpeningEl, PortalEl, RoomEl, WallEl } from '../types/elements';
import type { OpeningEdges, WallSpan } from '../types/geometry';
import { capGeometry } from '../geometry/caps';
import {
  blockerGeometry, holePath, isClockwise, openingEdges, openingPlacement, rectangleCorners, wallAngle, wallGeometry,
  wallSpan
} from '../geometry/walls';
import { assertDefined } from '../utils/assert';
import { COLLIDABLE, WALKABLE } from '../utils/surfaceClasses';
import { addBlocker, applyMesh, removeBlocker } from './mesh';

interface CapOptions { walls: WallEl[]; capEl: BuildingEl; kind: 'floor' | 'ceiling'; isOutside: boolean }

// A wall being built, with its span to the next wall.
interface WallBuild { wallEl: WallEl; span: WallSpan }

// Walls form a closed loop, so the last wall's neighbor is the first.
const nextWallOf = (walls: WallEl[], index: number) => assertDefined(walls[(index + 1) % walls.length], 'next wall');

// Returns a copy of the walls in build order. roomEl.walls stays in authored order, which a
// width/length room uses to place its corners on every build.
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
  const lift = isCeiling ? wallEl.getHeight() : 0;
  const { x, y, z } = wallEl.object3D.position;
  return new THREE.Vector3(x, y + lift, z);
};

const buildCap = ({ walls, capEl, kind, isOutside }: CapOptions) => {
  const isCeiling = kind === 'ceiling';
  const corners = walls.map(wallEl => capCorner(wallEl, isCeiling));
  const { uvScale } = capEl.getAttribute(kind);
  applyMesh({ el: capEl, objectName: kind, geom: capGeometry({ corners, isCeiling, isOutside, uvScale }) });
};

// Places the opening on the wall where the portal crosses it. The portal is measured in the room's
// local space, the frame buildWall works in, so the room's own position, rotation and scale apply.
const positionOpening = ({ wallEl, span }: WallBuild, openingEl: OpeningEl, portalEl: PortalEl | null) => {
  if (!portalEl) return;

  const portalAt = portalEl.object3D.getWorldPosition(new THREE.Vector3());
  wallEl.parentEl.object3D.worldToLocal(portalAt);

  const halfWidth = portalEl.getAttribute('portal').width / 2;
  const { x, y } = openingPlacement({ span, wallStart: wallEl.object3D.position, portalAt, halfWidth });
  openingEl.object3D.position.set(x, y, 0);
};

// Records the opening's corners in world space, in the order OpeningCorners describes, for the
// portal build to join.
const recordOpeningVertices = (wallEl: WallEl, openingEl: OpeningEl, { left, right }: OpeningEdges) => {
  for (const { ptX, bottomY, topY } of [left, right]) {
    for (const y of [bottomY, topY]) {
      openingEl.vertices.push(wallEl.object3D.localToWorld(new THREE.Vector3(ptX, y, 0)));
    }
  }
};

// Positions the opening and records its world vertices; returns the hole to cut, if it has a portal.
const cutOpening = (wall: WallBuild, openingEl: OpeningEl): Path | null => {
  const portalEl = openingEl.getPortal();
  positionOpening(wall, openingEl, portalEl);
  openingEl.vertices = [];
  removeBlocker(openingEl);
  if (!portalEl) return null;

  const portal = portalEl.getAttribute('portal');
  const edges = openingEdges({ span: wall.span, openingX: openingEl.object3D.position.x, portal });
  recordOpeningVertices(wall.wallEl, openingEl, edges);
  if (portal.floorHeight > 0) {
    addBlocker({ wallEl: wall.wallEl, openingEl, geom: blockerGeometry(edges) });
  }
  return holePath(edges);
};

const buildWall = (wallEl: WallEl, nextWallEl: WallEl) => {
  const heights = { start: wallEl.getHeight(), end: nextWallEl.getHeight() };
  const span = wallSpan(wallEl.object3D.position, nextWallEl.object3D.position, heights);
  wallEl.object3D.rotation.y = wallAngle(span);

  const holes = wallEl.openings.flatMap(openingEl => cutOpening({ wallEl, span }, openingEl) ?? []);
  const { uvScale } = wallEl.getAttribute('wall');
  applyMesh({ el: wallEl, objectName: 'wallMesh', geom: wallGeometry({ span, holes, uvScale }) });
  wallEl.classList.add(COLLIDABLE);
  (wallEl.builtPosition ??= new THREE.Vector3()).copy(wallEl.object3D.position);
};

const buildRoom = (roomEl: RoomEl) => {
  const { outside, length, width } = roomEl.getAttribute('room');
  if (width && length) placeRectangleWalls(roomEl.walls, width, length);

  const walls = wallsInBuildOrder(roomEl.walls, outside);

  for (const [i, wallEl] of walls.entries()) {
    const nextWallEl = nextWallOf(walls, i);
    buildWall(wallEl, nextWallEl);
  }

  if (roomEl.floor) {
    buildCap({ walls, capEl: roomEl.floor, kind: 'floor', isOutside: outside });
    roomEl.floor.classList.add(WALKABLE);
  }
  if (roomEl.ceiling) buildCap({ walls, capEl: roomEl.ceiling, kind: 'ceiling', isOutside: outside });
};

export { buildRoom };
