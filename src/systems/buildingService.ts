import type { BufferGeometry, Material, Path, Vector3 } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingEl, OpeningEl, PortalData, PortalEl, RoomEl, SurfaceType, WallEl } from '../types/elements';
import { required } from './required';

type UvCallback = (vertex: Vector3) => [number, number];
type Axis = 'x' | 'y' | 'z';
// Vertex layout per opening: [0]=left-bottom, [1]=left-top, [2]=right-bottom, [3]=right-top.
type OpeningCorners = readonly [Vector3, Vector3, Vector3, Vector3];

interface PlaneUvs { uKey: Axis; vKey: Axis; uMult: number; vMult: number }

// A wall measured against the next wall in the loop, in the wall's local frame.
interface WallSpan { wallEl: WallEl; nextWallEl: WallEl; length: number; gapY: number; heightGap: number }

interface OpeningCut { span: WallSpan; openingEl: OpeningEl; portal: PortalData }
interface OpeningEdge { ptX: number; bottomY: number; topY: number }
interface OpeningEdges { left: OpeningEdge; right: OpeningEdge }

interface CapOptions { walls: WallEl[]; capEl: BuildingEl; kind: 'floor' | 'ceiling'; isOutside: boolean }

interface PortalSurfaceContext { from: OpeningCorners; to: OpeningCorners; fallbackMaterial: Material | undefined }

// A portal surface is one or two quads of four corners each.
interface SurfaceLayout {
  // Which opening corners the surface spans, in vertex order.
  corners: (from: OpeningCorners, to: OpeningCorners) => Vector3[];
  indices: number[];
  // UV of a quad's corner (0-3) on a unit quad; quadUvs scales it to meters.
  uv: (quadCorner: number) => [number, number];
  // u runs along the edge from corner 0 to this corner, v along the edge from corner 0 to the other.
  uEdge: 1 | 2;
  className?: 'collidable' | 'walkable';
}

const HAIR = 0.0001; // Small epsilon to prevent z-fighting at opening edges.
const CHILD_TYPES: SurfaceType[] = ['sides', 'floor', 'ceiling'];
const QUAD = [0, 1, 2, 1, 3, 2];
const TWO_QUADS = [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6];

// Floor and ceiling are one quad between the openings; sides are two, the left and right walls.
const SURFACE_LAYOUTS: Record<SurfaceType, SurfaceLayout> = {
  floor: {
    corners: (from, to) => [to[0], to[2], from[2], from[0]],
    indices: QUAD,
    uv: corner => [1 - (corner % 2), 1 - Math.floor(corner / 2)],
    uEdge: 1,
    className: 'walkable'
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
    uEdge: 2,
    className: 'collidable'
  }
};

// Corners as fractions of (width, length). The room component guarantees four walls here.
const RECTANGLE_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;

const flipGeometry = (geom: BufferGeometry) => {
  const index = required(geom.getIndex(), 'geometry index');
  for (let i = 0; i < index.count; i += 3) {
    const tempIndex = index.getX(i + 2);
    index.setX(i + 2, index.getX(i + 1));
    index.setX(i + 1, tempIndex);
  }

  index.needsUpdate = true;
};

const makeGeometryUvs = (geom: BufferGeometry, callback: UvCallback) => {
  const indices = required(geom.getIndex(), 'geometry index').array;
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

const makePlaneUvs = (geom: BufferGeometry, { uKey, vKey, uMult, vMult }: PlaneUvs) => {
  makeGeometryUvs(geom, point => ([point[uKey] * uMult, point[vKey] * vMult]));
};

const finishGeometry = (geom: BufferGeometry) => {
  geom.computeVertexNormals();
};

const getMaterial = (el: Entity | null | undefined) => el?.components.material?.material;

// Reuses the element's mesh across rebuilds. The old geometry is freed, since three.js only
// releases GPU buffers on dispose(). With no material found, the mesh keeps the one it has, which
// on a first build without one is the default new THREE.Mesh() applies.
const applyMesh = (el: BuildingEl, objectName: string, geom: BufferGeometry) => {
  const material = getMaterial(el) ?? getMaterial(el.parentEl);
  if (el.mesh) {
    el.mesh.geometry.dispose();
    el.mesh.geometry = geom;
    if (material) el.mesh.material = material;
    return;
  }
  el.mesh = new THREE.Mesh(geom, material);
  el.setObject3D(objectName, el.mesh);
};

const toChildLocal = (vertex: Vector3, childEl: Entity) => {
  const point = vertex.clone();
  childEl.object3D.worldToLocal(point);
  return [point.x, point.y, point.z];
};

const addOpeningWorldVertex = (wallEl: WallEl, openingEl: OpeningEl, point: { x: number; y: number }) => {
  const vertex = new THREE.Vector3(point.x, point.y, 0);
  wallEl.object3D.localToWorld(vertex);
  openingEl.vertices.push(vertex);
};

const positionOpening = ({ wallEl, nextWallEl }: WallSpan, openingEl: OpeningEl, portalEl: PortalEl | null) => {
  if (!portalEl) return;

  const wallWorldPosition = new THREE.Vector3();
  wallEl.object3D.getWorldPosition(wallWorldPosition);

  const nextWallWorldPosition = new THREE.Vector3();
  nextWallEl.object3D.getWorldPosition(nextWallWorldPosition);

  const portalWorldPosition = new THREE.Vector3();
  portalEl.object3D.getWorldPosition(portalWorldPosition);

  const portalGapX = portalWorldPosition.x - wallWorldPosition.x;
  const portalGapZ = portalWorldPosition.z - wallWorldPosition.z;

  const wallGapX = nextWallWorldPosition.x - wallWorldPosition.x;
  const wallGapY = nextWallWorldPosition.y - wallWorldPosition.y;
  const wallGapZ = nextWallWorldPosition.z - wallWorldPosition.z;

  const wallLength = Math.hypot(wallGapX, wallGapZ);

  const portalHalfWidth = portalEl.getAttribute('portal').width / 2;

  const wallDir = new THREE.Vector2(wallGapX, wallGapZ).normalize();
  const portalOffset = new THREE.Vector2(portalGapX, portalGapZ);
  let portalLocalX = portalOffset.dot(wallDir);
  portalLocalX = Math.max(portalLocalX, portalHalfWidth + HAIR);
  portalLocalX = Math.min(portalLocalX, wallLength - portalHalfWidth - HAIR);

  const floorY = (portalLocalX / wallLength) * wallGapY;
  openingEl.object3D.position.set(portalLocalX, floorY, 0);
};

// Walls form a closed loop, so the last wall's neighbour is the first.
const nextWallOf = (walls: WallEl[], index: number) => required(walls[(index + 1) % walls.length], 'next wall');

// Returns a copy of the walls in build order. roomEl.walls stays in authored order, which a
// width/length room uses to place its corners on every build.
const wallsInBuildOrder = (authored: WallEl[], isOutside: boolean) => {
  const walls = [...authored];
  // Shoelace formula: positive sum means clockwise winding in XZ plane.
  let cwSum = 0;
  for (const [i, wallEl] of walls.entries()) {
    const nextWallEl = nextWallOf(walls, i);

    const { x: wallX, z: wallZ } = wallEl.object3D.position;
    const { x: nextWallX, z: nextWallZ } = nextWallEl.object3D.position;

    cwSum += (nextWallX - wallX) * (nextWallZ + wallZ);
  }

  if ((cwSum > 0) !== isOutside) walls.reverse();
  return walls;
};

const capCorner = (wallEl: WallEl, isCeiling: boolean) => {
  const lift = isCeiling ? wallEl.getHeight() : 0;
  const { x, y, z } = wallEl.object3D.position;
  return [x, y + lift, z];
};

// Triangulates the wall corners in the XZ plane, which handles concave rooms. Earcut indexes into
// the contour as given, so vertex i stays wall i and keeps that wall's height.
const capIndices = (walls: WallEl[]) => {
  const contour = walls.map(({ object3D: { position } }) => new THREE.Vector2(position.x, position.z));
  return THREE.ShapeUtils.triangulateShape(contour, []).flat();
};

const buildCap = ({ walls, capEl, kind, isOutside }: CapOptions) => {
  const isCeiling = kind === 'ceiling';
  const positions = walls.flatMap(wallEl => capCorner(wallEl, isCeiling));
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setIndex(capIndices(walls));

  // Earcut winds counterclockwise in (x, z) whichever way the walls run, and x cross z is -y, so
  // its triangles face down. Caps face into an inside room (floor up, ceiling down) and out of an
  // outside one (roof up, floor down), so flip an inside floor and an outside ceiling.
  if (isCeiling === isOutside) flipGeometry(geom);

  const { uvScale } = capEl.getAttribute(kind);
  const uSign = isCeiling ? 1 : -1;
  makePlaneUvs(geom, { uKey: 'x', vKey: 'z', uMult: uSign * uvScale, vMult: uvScale });
  finishGeometry(geom);
  applyMesh(capEl, kind, geom);
};

// side = -1 is the left edge of the opening, side = +1 is the right edge.
const openingEdge = ({ span, openingEl, portal }: OpeningCut, side: -1 | 1): OpeningEdge => {
  const ptX = openingEl.object3D.position.x + portal.width / 2 * side;
  const along = ptX / span.length;
  // Interpolate wall-base Y for sloped walls (non-zero gapY).
  const baseY = along * span.gapY;
  const bottomY = baseY + portal.floorHeight;
  const ceilingY = span.wallEl.getHeight() + along * span.heightGap;
  // Clamp the top of the opening to the ceiling, leaving a HAIR seam.
  const topY = Math.min(bottomY + portal.height, baseY + ceilingY - HAIR);

  addOpeningWorldVertex(span.wallEl, openingEl, { x: ptX, y: bottomY });
  addOpeningWorldVertex(span.wallEl, openingEl, { x: ptX, y: topY });
  return { ptX, bottomY, topY };
};

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

// An invisible collidable quad across a window, so the player cannot walk through it at torso height.
const addWindowBlocker = ({ span, openingEl }: OpeningCut, { left, right }: OpeningEdges) => {
  const blockGeom = new THREE.BufferGeometry();
  blockGeom.setIndex(QUAD);
  blockGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    left.ptX, left.bottomY, 0,
    left.ptX, left.topY, 0,
    right.ptX, right.bottomY, 0,
    right.ptX, right.topY, 0
  ]), 3));
  // MeshBasicMaterial is required, because Mesh.raycast returns early when material is undefined.
  // DoubleSide so raycasts from both the room interior and exterior are caught.
  const blockMesh = new THREE.Mesh(blockGeom, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  blockMesh.visible = false;
  span.wallEl.object3D.add(blockMesh);
  openingEl.mesh = blockMesh;
  openingEl.classList.add('collidable');
};

// Removes the window-blocker mesh left by a previous build. Its geometry and material were made
// here, so both are freed.
const removeWindowBlocker = (openingEl: OpeningEl) => {
  const blocker = openingEl.mesh;
  if (!blocker) return;
  blocker.parent?.remove(blocker);
  blocker.geometry.dispose();
  for (const material of [blocker.material].flat()) material.dispose();
  openingEl.mesh = null;
};

// Positions the opening and records its world vertices; returns the hole to cut, if it has a portal.
const cutOpening = (span: WallSpan, openingEl: OpeningEl): Path | null => {
  const portalEl = openingEl.getPortal();
  positionOpening(span, openingEl, portalEl);
  openingEl.vertices = [];
  removeWindowBlocker(openingEl);
  if (!portalEl) return null;

  const cut: OpeningCut = { span, openingEl, portal: portalEl.getAttribute('portal') };
  const edges = { left: openingEdge(cut, -1), right: openingEdge(cut, 1) };
  if (cut.portal.floorHeight > 0) addWindowBlocker(cut, edges);
  return holePath(edges);
};

const buildWall = (wallEl: WallEl, nextWallEl: WallEl) => {
  const gapX = nextWallEl.object3D.position.x - wallEl.object3D.position.x;
  const gapY = nextWallEl.object3D.position.y - wallEl.object3D.position.y;
  const gapZ = nextWallEl.object3D.position.z - wallEl.object3D.position.z;
  const span: WallSpan = {
    wallEl,
    nextWallEl,
    length: Math.hypot(gapX, gapZ),
    gapY,
    heightGap: nextWallEl.getHeight() - wallEl.getHeight()
  };

  wallEl.object3D.rotation.y = -Math.atan2(gapZ, gapX);

  const wallShape = new THREE.Shape();
  wallShape.moveTo(0, wallEl.getHeight());
  wallShape.lineTo(0, 0);
  wallShape.lineTo(span.length, gapY);
  wallShape.lineTo(span.length, gapY + nextWallEl.getHeight());

  for (const openingEl of wallEl.openings) {
    const hole = cutOpening(span, openingEl);
    if (hole) wallShape.holes.push(hole);
  }

  const wallGeom = new THREE.ShapeGeometry(wallShape);
  const { uvScale } = wallEl.getAttribute('wall');
  makePlaneUvs(wallGeom, { uKey: 'x', vKey: 'y', uMult: uvScale, vMult: uvScale });
  finishGeometry(wallGeom);
  applyMesh(wallEl, 'wallMesh', wallGeom);
  wallEl.classList.add('collidable');
  (wallEl.builtPosition ??= new THREE.Vector3()).copy(wallEl.object3D.position);
};

const placeRectangleWalls = (walls: WallEl[], width: number, length: number) => {
  for (const [i, [u, v]] of RECTANGLE_CORNERS.entries()) {
    required(walls[i], 'rectangle wall').object3D.position.set(u * width, 0, v * length);
  }
};

const buildRoom = (roomEl: RoomEl) => {
  const { outside, length, width } = roomEl.getAttribute('room');
  if (width && length) placeRectangleWalls(roomEl.walls, width, length);

  const walls = wallsInBuildOrder(roomEl.walls, outside);

  for (const [i, wallEl] of walls.entries()) {
    const nextWallEl = nextWallOf(walls, i);
    wallEl.nextWallEl = nextWallEl;
    buildWall(wallEl, nextWallEl);
  }

  if (roomEl.floor) {
    buildCap({ walls, capEl: roomEl.floor, kind: 'floor', isOutside: outside });
    roomEl.floor.classList.add('walkable');
  }
  if (roomEl.ceiling) buildCap({ walls, capEl: roomEl.ceiling, kind: 'ceiling', isOutside: outside });
};

const toCorners = (vertices: Vector3[] | undefined): OpeningCorners | null => {
  const [leftBottom, leftTop, rightBottom, rightTop] = vertices ?? [];
  if (!leftBottom || !leftTop || !rightBottom || !rightTop) return null;
  return [leftBottom, leftTop, rightBottom, rightTop];
};

// UVs in meters: each quad's unit UVs times the lengths of the edges u and v run along.
const quadUvs = (corners: Vector3[], { uv, uEdge }: SurfaceLayout, uvScale: number) => corners.flatMap((_, i) => {
  const quadStart = i - (i % 4);
  const origin = required(corners[quadStart], 'quad corner');
  const uLength = origin.distanceTo(required(corners[quadStart + uEdge], 'quad corner'));
  const vLength = origin.distanceTo(required(corners[quadStart + 3 - uEdge], 'quad corner'));
  const [u, v] = uv(i % 4);
  return [u * uLength * uvScale, v * vLength * uvScale];
});

const buildPortalSurface = (childEl: BuildingEl, type: SurfaceType, { from, to, fallbackMaterial }: PortalSurfaceContext) => {
  const layout = SURFACE_LAYOUTS[type];
  const material = getMaterial(childEl) ?? getMaterial(childEl.parentEl) ?? fallbackMaterial;

  const geom = new THREE.BufferGeometry();
  geom.setIndex(layout.indices);

  // The previous surface's geometry was made here; its material belongs to the material component.
  childEl.mesh?.geometry.dispose();
  childEl.mesh = new THREE.Mesh(geom, material);
  childEl.setObject3D(type, childEl.mesh);

  const corners = layout.corners(from, to);
  const positions = corners.flatMap(vertex => toChildLocal(vertex, childEl));
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

  const { uvScale } = childEl.getAttribute(type);
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(quadUvs(corners, layout, uvScale)), 2));
  finishGeometry(geom);
  if (layout.className) childEl.classList.add(layout.className);
};

const buildPortal = (portalEl: PortalEl) => {
  const { from: fromEl, to: toEl } = portalEl.getAttribute('portal');
  const portalId = portalEl.id ? `#${portalEl.id}` : '<a-portal>';
  const from = toCorners(fromEl?.vertices);
  const to = toCorners(toEl?.vertices);
  if (!from || !to) {
    console.error(`${portalId}: opening vertices not found. Make sure both openings exist and their rooms have been built.`);
    return;
  }

  const fromWallEl = fromEl?.parentEl;
  const fallbackMaterial = getMaterial(fromWallEl) ?? getMaterial(fromWallEl?.parentEl);

  for (const childEl of portalEl.children) {
    const type = CHILD_TYPES.find(t => childEl.components[t]);
    if (type) buildPortalSurface(childEl, type, { from, to, fallbackMaterial });
  }
};

export { buildPortal, buildRoom };
