import type { BufferGeometry, Vector3 } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingEl, OpeningEl, PortalEl, RoomEl, SurfaceType, WallEl } from '../types/elements';
import { required } from './required';

type UvCallback = (vertex: Vector3, vertIndex: number) => [number, number];
type Axis = 'x' | 'y' | 'z';
// Vertex layout per opening: [0]=left-bottom, [1]=left-top, [2]=right-bottom, [3]=right-top.
type OpeningCorners = readonly [Vector3, Vector3, Vector3, Vector3];

const HAIR = 0.0001; // Small epsilon to prevent z-fighting at opening edges.
const CHILD_TYPES: SurfaceType[] = ['sides', 'floor', 'ceiling'];

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
    const [u, v] = callback(vertex, vertexIndex % 3);
    uvs[vertexIndex * 2 + 0] = u;
    uvs[vertexIndex * 2 + 1] = v;
  }

  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
};

const makePlaneUvs = (geom: BufferGeometry, uKey: Axis, vKey: Axis, uMult: number, vMult: number) => {
  const callback: UvCallback = (point) => ([point[uKey] * uMult, point[vKey] * vMult]);
  makeGeometryUvs(geom, callback);
};

const finishGeometry = (geom: BufferGeometry) => {
  geom.computeVertexNormals();
};

const addPortalWorldVertex = (vertex: Vector3, childEl: Entity, positions: number[]) => {
  const point = vertex.clone();
  childEl.object3D.worldToLocal(point);
  positions.push(point.x, point.y, point.z);
};

const addOpeningWorldVertex = (wallEl: WallEl, openingEl: OpeningEl, ptX: number, ptY: number) => {
  const vertex = new THREE.Vector3(ptX, ptY, 0);
  wallEl.object3D.localToWorld(vertex);
  openingEl.vertices.push(vertex);
};

const positionOpening = (openingEl: OpeningEl, portalEl: PortalEl | null) => {
  const wallEl = openingEl.parentEl;
  const nextWallEl = wallEl?.nextWallEl;
  if (!portalEl || !nextWallEl) { return; }

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

  const portalHalfWidth = portalEl.getAttribute('portal')?.width / 2;

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

const sortWalls = (walls: WallEl[], isOutside: boolean) => {
  // Shoelace formula: positive sum means clockwise winding in XZ plane.
  let cwSum = 0;
  for (const [i, wallEl] of walls.entries()) {
    const nextWallEl = nextWallOf(walls, i);

    const { x: wallX, z: wallZ } = wallEl.object3D.position;
    const { x: nextWallX, z: nextWallZ } = nextWallEl.object3D.position;

    cwSum += (nextWallX - wallX) * (nextWallZ + wallZ);
  }

  if ((cwSum > 0) !== isOutside) { walls.reverse(); }
};

const getMaterial = (el: Entity | null) => el?.components.material?.material;

const buildCap = (walls: WallEl[], capEl: BuildingEl, isCeiling: boolean, isOutside: boolean) => {
  const n = walls.length;
  const positions: number[] = [];

  // Centroid vertex appended last; fan triangles reference it as vertex n.
  let cx = 0; let cy = 0; let cz = 0;
  for (const wallEl of walls) {
    const x = wallEl.object3D.position.x;
    const y = wallEl.object3D.position.y + (isCeiling ? wallEl.getHeight() : 0);
    const z = wallEl.object3D.position.z;
    positions.push(x, y, z);
    cx += x; cy += y; cz += z;
  }
  positions.push(cx / n, cy / n, cz / n);

  const indices: number[] = [];
  for (let i = 0; i < n; i++) indices.push(i, (i + 1) % n, n);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setIndex(indices);

  // Outside rooms have reversed wall order; ceilings face opposite from floors — flip when only one reversal applies.
  if (isCeiling === isOutside) { flipGeometry(geom); }

  const uvScale = capEl.getAttribute(isCeiling ? 'ceiling' : 'floor').uvScale;
  makePlaneUvs(geom, 'x', 'z', (isCeiling ? 1 : -1) * uvScale, uvScale);
  finishGeometry(geom);

  const material = getMaterial(capEl) || getMaterial(capEl.parentEl);
  if (capEl.mesh) {
    capEl.mesh.geometry = geom;
    // Same fallback new THREE.Mesh() applies when no material is found.
    capEl.mesh.material = material ?? new THREE.MeshBasicMaterial();
  } else {
    const type = isCeiling ? 'ceiling' : 'floor';
    capEl.mesh = new THREE.Mesh(geom, material);
    capEl.setObject3D(type, capEl.mesh);
  }
};

// Corners as fractions of (width, length). The room component guarantees four walls here.
const RECTANGLE_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;

const placeRectangleWalls = (walls: WallEl[], width: number, length: number) => {
  for (const [i, [u, v]] of RECTANGLE_CORNERS.entries()) {
    required(walls[i], 'rectangle wall').object3D.position.set(u * width, 0, v * length);
  }
};

const buildRoom = (roomEl: RoomEl) => {
  const { outside, length, width } = roomEl.getAttribute('room');
  const walls = roomEl.walls;

  if (width && length) placeRectangleWalls(walls, width, length);

  sortWalls(walls, outside);

  for (const [i, wallEl] of walls.entries()) {
    const nextWallEl = wallEl.nextWallEl = nextWallOf(walls, i);

    const wallGapX = nextWallEl.object3D.position.x - wallEl.object3D.position.x;
    const wallGapY = nextWallEl.object3D.position.y - wallEl.object3D.position.y;
    const wallGapZ = nextWallEl.object3D.position.z - wallEl.object3D.position.z;

    const heightGap = nextWallEl.getHeight() - wallEl.getHeight();
    const wallAngle = Math.atan2(wallGapZ, wallGapX);
    const wallLength = Math.hypot(wallGapX, wallGapZ);

    wallEl.object3D.rotation.y = -wallAngle;

    const wallShape = new THREE.Shape();
    wallShape.moveTo(0, wallEl.getHeight());
    wallShape.lineTo(0, 0);
    wallShape.lineTo(wallLength, wallGapY);
    wallShape.lineTo(wallLength, wallGapY + nextWallEl.getHeight());

    for (const openingEl of wallEl.openings) {
      const portalEl = openingEl.getPortal();
      positionOpening(openingEl, portalEl);
      openingEl.vertices = [];

      // Remove stale window-blocker mesh from a previous build.
      if (openingEl.mesh) {
        openingEl.mesh.parent?.remove(openingEl.mesh);
        openingEl.mesh = null;
      }

      if (!portalEl) { continue; }

      const { width: portalWidth, height: portalHeight, floorHeight = 0 } = portalEl.getAttribute('portal');
      // side = -1 is the left edge of the opening, side = +1 is the right edge.
      const openingEdge = (side: -1 | 1) => {
        const ptX = openingEl.object3D.position.x + portalWidth / 2 * side;
        // Interpolate wall-base Y for sloped walls (non-zero wallGapY).
        const baseY = (ptX / wallLength) * wallGapY;
        const bottomY = baseY + floorHeight;
        let topY = bottomY + portalHeight;

        // Clamp the top of the opening to the ceiling, leaving a HAIR seam.
        const ceilingY = wallEl.getHeight() + (ptX / wallLength) * heightGap;
        if (topY > baseY + ceilingY - HAIR) topY = baseY + ceilingY - HAIR;

        addOpeningWorldVertex(wallEl, openingEl, ptX, bottomY);
        addOpeningWorldVertex(wallEl, openingEl, ptX, topY);
        return { ptX, bottomY, topY };
      };
      const left = openingEdge(-1);
      const right = openingEdge(1);

      // Cut the opening as a Shape hole — correctly handles both doors (floorHeight=0)
      // and windows (floorHeight>0) without leaving unintended gaps in the wall mesh.
      const hole = new THREE.Path();
      hole.moveTo(left.ptX, left.bottomY);
      hole.lineTo(left.ptX, left.topY);
      hole.lineTo(right.ptX, right.topY);
      hole.lineTo(right.ptX, right.bottomY);
      hole.closePath();
      wallShape.holes.push(hole);

      // For windows (raised floor), add an invisible collidable blocker so the
      // player cannot walk through the opening at torso height.
      if (floorHeight > 0) {
        const blockGeom = new THREE.BufferGeometry();
        blockGeom.setIndex([0, 1, 2, 1, 3, 2]);
        blockGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          left.ptX, left.bottomY, 0,
          left.ptX, left.topY, 0,
          right.ptX, right.bottomY, 0,
          right.ptX, right.topY, 0
        ]), 3));
        // MeshBasicMaterial required — Mesh.raycast returns early if material===undefined.
        // DoubleSide so raycasts from both the room interior and exterior are caught.
        const blockMesh = new THREE.Mesh(blockGeom, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        blockMesh.visible = false;
        wallEl.object3D.add(blockMesh);
        openingEl.mesh = blockMesh;
        openingEl.classList.add('collidable');
      }
    }

    const wallGeom = new THREE.ShapeGeometry(wallShape);
    const uvScale = wallEl.getAttribute('wall').uvScale;
    makePlaneUvs(wallGeom, 'x', 'y', uvScale, uvScale);
    finishGeometry(wallGeom);
    const material = getMaterial(wallEl) || getMaterial(wallEl.parentEl);
    if (wallEl.mesh) {
      wallEl.mesh.geometry = wallGeom;
      // Same fallback new THREE.Mesh() applies when no material is found.
      wallEl.mesh.material = material ?? new THREE.MeshBasicMaterial();
    } else {
      wallEl.mesh = new THREE.Mesh(wallGeom, material);
      wallEl.setObject3D('wallMesh', wallEl.mesh);
    }
    wallEl.classList.add('collidable');
  }

  if (roomEl.floor) {
    buildCap(walls, roomEl.floor, false, outside);
    roomEl.floor.classList.add('walkable');
  }
  if (roomEl.ceiling) buildCap(walls, roomEl.ceiling, true, outside);
};

const toCorners = (vertices: Vector3[] | undefined): OpeningCorners | null => {
  const [leftBottom, leftTop, rightBottom, rightTop] = vertices ?? [];
  if (!leftBottom || !leftTop || !rightBottom || !rightTop) return null;
  return [leftBottom, leftTop, rightBottom, rightTop];
};

const buildPortal = (portalEl: PortalEl) => {
  const { from: fromEl, to: toEl } = portalEl.getAttribute('portal');
  const portalId = portalEl.id ? `#${portalEl.id}` : '<a-portal>';
  const fromVerts = toCorners(fromEl?.vertices);
  const toVerts = toCorners(toEl?.vertices);
  if (!fromVerts || !toVerts) {
    console.error(`${portalId}: opening vertices not found — ensure both openings exist and their rooms have been built.`);
    return;
  }

  const portalFallbackMaterial = getMaterial(fromEl?.parentEl ?? null) || getMaterial(fromEl?.parentEl?.parentEl ?? null);

  for (const childEl of portalEl.children) {
    const type = CHILD_TYPES.find(t => childEl.components[t]);
    if (!type) { continue; }

    const material = getMaterial(childEl) || getMaterial(childEl.parentEl) || portalFallbackMaterial;

    // sides needs two quads (left and right walls); floor and ceiling need one each.
    const indices = (type === 'sides') ? [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6] : [0, 1, 2, 1, 3, 2];
    const geom = new THREE.BufferGeometry();
    geom.setIndex(indices);

    childEl.mesh = new THREE.Mesh(geom, material);
    childEl.setObject3D(type, childEl.mesh);

    const positions: number[] = [];
    const uvScale = childEl.getAttribute(type).uvScale;
    let uvCallback: UvCallback;

    switch (type) {
      case 'floor':
        addPortalWorldVertex(toVerts[0], childEl, positions);
        addPortalWorldVertex(toVerts[2], childEl, positions);
        addPortalWorldVertex(fromVerts[2], childEl, positions);
        addPortalWorldVertex(fromVerts[0], childEl, positions);
        uvCallback = (point, vertIndex) => ([(1 - (vertIndex % 2)) * uvScale, (1 - Math.floor(vertIndex / 2)) * uvScale]);
        break;
      case 'ceiling':
        addPortalWorldVertex(toVerts[3], childEl, positions);
        addPortalWorldVertex(toVerts[1], childEl, positions);
        addPortalWorldVertex(fromVerts[1], childEl, positions);
        addPortalWorldVertex(fromVerts[3], childEl, positions);
        uvCallback = (point, vertIndex) => ([(vertIndex % 2) * uvScale, (1 - Math.floor(vertIndex / 2)) * uvScale]);
        break;
      case 'sides':
        addPortalWorldVertex(toVerts[2], childEl, positions);
        addPortalWorldVertex(toVerts[3], childEl, positions);
        addPortalWorldVertex(fromVerts[0], childEl, positions);
        addPortalWorldVertex(fromVerts[1], childEl, positions);

        addPortalWorldVertex(fromVerts[2], childEl, positions);
        addPortalWorldVertex(fromVerts[3], childEl, positions);
        addPortalWorldVertex(toVerts[0], childEl, positions);
        addPortalWorldVertex(toVerts[1], childEl, positions);
        uvCallback = (point, vertIndex) => {
          const u = 1 - Math.floor(vertIndex / 2);
          return [u * uvScale, (vertIndex % 2) * uvScale];
        };
        break;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    makeGeometryUvs(geom, uvCallback);
    finishGeometry(geom);
    if (type === 'sides') childEl.classList.add('collidable');
    else if (type === 'floor') childEl.classList.add('walkable');
  }
};

export { buildPortal, buildRoom };
