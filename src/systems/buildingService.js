const HAIR = 0.0001; // Small epsilon to prevent z-fighting at opening edges.
const CHILD_TYPES = ['sides', 'floor', 'ceiling'];

// Reverses face winding, flipping surfaces from outward- to inward-facing (or vice versa).
const flipGeometry = (geom) => {
  const indices = geom.getIndex().array;
  for (let i = 0; i < indices.length; i += 3) {
    const tempIndex = indices[i + 2];
    indices[i + 2] = indices[i + 1];
    indices[i + 1] = tempIndex;
  }

  geom.getIndex().needsUpdate = true;
};

// Calls callback(vertex, vertexIndex) for each indexed vertex to produce [u, v] pairs,
// then writes them as a uv attribute on the geometry.
const makeGeometryUvs = (geom, callback) => {
  const indices = geom.getIndex().array;
  const uvs = [];
  for (const vertexIndex of indices) {
    const vertex = new THREE.Vector3(
      geom.attributes.position.getX(vertexIndex),
      geom.attributes.position.getY(vertexIndex),
      geom.attributes.position.getZ(vertexIndex)
    );

    // vertexIndex % 3 gives position within triangle (0–2); callbacks use this
    // to derive UV coordinates. Note: for quads, vertex 3 maps to 0 — may need
    // revisiting if UV seams appear on portal surfaces.
    const [u, v] = callback(vertex, vertexIndex % 3);
    uvs[vertexIndex * 2 + 0] = u;
    uvs[vertexIndex * 2 + 1] = v;
  }

  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
};

// Convenience wrapper for simple planar UV projection along two axes.
const makePlaneUvs = (geom, uKey, vKey, uMult, vMult) => {
  const callback = (point) => ([point[uKey] * uMult, point[vKey] * vMult]);
  makeGeometryUvs(geom, callback);
};

const finishGeometry = (geom) => {
  geom.computeVertexNormals();
};

// Converts a world-space vertex into the local space of childEl and appends it
// to the positions array, ready for a BufferGeometry position attribute.
const addPortalWorldVertex = (vertex, childEl, positions) => {
  const point = vertex.clone();
  childEl.object3D.worldToLocal(point);
  positions.push(point.x, point.y, point.z);
};

// Converts a wall-local (ptX, ptY) coordinate to world space and stores it on
// the opening element so buildDoorlink can connect the two openings later.
const addOpeningWorldVertex = (wallEl, openingEl, ptX, ptY) => {
  const vertex = new THREE.Vector3(ptX, ptY, 0);
  wallEl.object3D.localToWorld(vertex);
  openingEl.vertices.push(vertex);
};

// Projects the portal's world position onto the wall's local X axis to find
// where along the wall the opening should be centred, then clamps it so the
// opening always fits within the wall bounds.
const positionOpening = (openingEl) => {
  const portalEl = openingEl.getPortal();
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

  // Project the portal offset onto the wall axis to get its local X position.
  const wallDir = new THREE.Vector2(wallGapX, wallGapZ).normalize();
  const portalOffset = new THREE.Vector2(portalGapX, portalGapZ);
  let portalLocalX = portalOffset.dot(wallDir);
  portalLocalX = Math.max(portalLocalX, portalHalfWidth + HAIR);
  portalLocalX = Math.min(portalLocalX, wallLength - portalHalfWidth - HAIR);

  const floorY = (portalLocalX / wallLength) * wallGapY;
  openingEl.object3D.position.set(portalLocalX, floorY, 0);
};

// Determines the correct winding order for walls so that faces point inward.
// Uses the shoelace formula to detect clockwise vs counterclockwise winding,
// then reverses the array if needed (also toggled for outside rooms).
const sortWalls = (walls, isOutside) => {
  // Shoelace formula: positive sum means clockwise winding in XZ plane.
  let cwSum = 0;
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const nextWallEl = walls[(i + 1) % walls.length];

    const { x: wallX, z: wallZ } = wallEl.object3D.position;
    const { x: nextWallX, z: nextWallZ } = nextWallEl.object3D.position;

    cwSum += (nextWallX - wallX) * (nextWallZ + wallZ);
  }

  if ((cwSum > 0) !== isOutside) { walls.reverse(); }
};

// Builds the floor or ceiling mesh for a room. Places corner vertices directly in
// 3D space and fans triangles from the centroid, producing smooth results for any
// convex room regardless of wall count or height variation.
const buildCap = (walls, capEl, isCeiling, isOutside) => {
  const n = walls.length;
  const positions = [];

  for (const wallEl of walls) {
    positions.push(
      wallEl.object3D.position.x,
      wallEl.object3D.position.y + (isCeiling ? wallEl.getHeight() : 0),
      wallEl.object3D.position.z
    );
  }

  // Centroid vertex appended last; fan triangles reference it as vertex n.
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < positions.length; i += 3) {
    cx += positions[i]; cy += positions[i + 1]; cz += positions[i + 2];
  }
  positions.push(cx / n, cy / n, cz / n);

  const indices = [];
  for (let i = 0; i < n; i++) indices.push(i, (i + 1) % n, n);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setIndex(indices);

  if (isCeiling === isOutside) { flipGeometry(geom); }

  const uvScale = capEl.getAttribute(isCeiling ? 'ceiling' : 'floor')?.uvScale ?? 1;
  makePlaneUvs(geom, 'x', 'z', (isCeiling ? 1 : -1) * uvScale, uvScale);
  finishGeometry(geom);

  const material = capEl.components?.material?.material || capEl.parentEl?.components?.material?.material;
  if (capEl.mesh) {
    capEl.mesh.geometry = geom;
    capEl.mesh.material = material;
  } else {
    const type = isCeiling ? 'ceiling' : 'floor';
    capEl.mesh = new THREE.Mesh(geom, material);
    capEl.setObject3D(type, capEl.mesh);
  }
};

const buildRoom = (roomEl) => {
  const { outside, length, width } = roomEl.getAttribute('room');
  const walls = roomEl.walls;
  const roomId = roomEl.id ? `#${roomEl.id}` : '<a-room>';

  if (!walls || walls.length < 3) {
    console.error(`${roomId}: a room needs at least 3 walls (found ${walls?.length ?? 0}).`);
    return;
  }

  // If width and length are set, auto-position the four wall corners as a rectangle.
  if (width && length) {
    walls[0].object3D.position.set(0, 0, 0);
    walls[1].object3D.position.set(width, 0, 0);
    walls[2].object3D.position.set(width, 0, length);
    walls[3].object3D.position.set(0, 0, length);
  }

  sortWalls(walls, outside);

  // Build each wall as a 2D shape profile in the wall's local XY plane (X along
  // the wall, Y upward). Openings are punched in as the shape is traced.
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    // Store a reference to the next wall so positionOpening can access it.
    const nextWallEl = wallEl.nextWallEl = walls[(i + 1) % walls.length];

    const wallGapX = nextWallEl.object3D.position.x - wallEl.object3D.position.x;
    const wallGapY = nextWallEl.object3D.position.y - wallEl.object3D.position.y;
    const wallGapZ = nextWallEl.object3D.position.z - wallEl.object3D.position.z;

    const heightGap = nextWallEl.getHeight() - wallEl.getHeight();
    const wallAngle = Math.atan2(wallGapZ, wallGapX);
    const wallLength = Math.hypot(wallGapX, wallGapZ);

    // Rotate the wall to face inward along its XZ direction.
    wallEl.object3D.rotation.y = -wallAngle;

    // Build the outer wall outline without opening cuts.
    const wallShape = new THREE.Shape();
    wallShape.moveTo(0, wallEl.getHeight());
    wallShape.lineTo(0, 0);
    wallShape.lineTo(wallLength, wallGapY);
    wallShape.lineTo(wallLength, wallGapY + nextWallEl.getHeight());

    for (const openingEl of wallEl.openings) {
      positionOpening(openingEl);
      openingEl.vertices = [];

      // Remove stale window-blocker mesh from a previous build.
      if (openingEl.mesh) {
        openingEl.mesh.parent?.remove(openingEl.mesh);
        openingEl.mesh = null;
      }

      const portalEl = openingEl.getPortal();
      if (!portalEl) { continue; }

      const { width: portalWidth, height: portalHeight, floorHeight = 0 } = portalEl.getAttribute('portal');
      const pts = [];
      // side = -1 is the left edge of the opening, side = +1 is the right edge.
      for (let side = -1; side <= 1; side += 2) {
        const ptX = openingEl.object3D.position.x + portalWidth / 2 * side;
        // Interpolate wall-base Y for sloped walls (non-zero wallGapY).
        const baseY = (ptX / wallLength) * wallGapY;
        const bottomY = baseY + floorHeight;
        let topY = bottomY + portalHeight;

        // Clamp the top of the opening to the ceiling, leaving a HAIR seam.
        const ceilingY = wallEl.getHeight() + (ptX / wallLength) * heightGap;
        if (topY > baseY + ceilingY - HAIR) topY = baseY + ceilingY - HAIR;

        // Record world-space vertices for buildPortal to use later.
        addOpeningWorldVertex(wallEl, openingEl, ptX, bottomY);
        addOpeningWorldVertex(wallEl, openingEl, ptX, topY);
        pts.push({ ptX, bottomY, topY });
      }

      // Cut the opening as a Shape hole — correctly handles both doors (floorHeight=0)
      // and windows (floorHeight>0) without leaving unintended gaps in the wall mesh.
      const hole = new THREE.Path();
      hole.moveTo(pts[0].ptX, pts[0].bottomY);
      hole.lineTo(pts[0].ptX, pts[0].topY);
      hole.lineTo(pts[1].ptX, pts[1].topY);
      hole.lineTo(pts[1].ptX, pts[1].bottomY);
      hole.closePath();
      wallShape.holes.push(hole);

      // For windows (raised floor), add an invisible collidable blocker so the
      // player cannot walk through the opening at torso height.
      if (floorHeight > 0) {
        const blockGeom = new THREE.BufferGeometry();
        blockGeom.setIndex([0, 1, 2, 1, 3, 2]);
        blockGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          pts[0].ptX, pts[0].bottomY, 0,
          pts[0].ptX, pts[0].topY,    0,
          pts[1].ptX, pts[1].bottomY, 0,
          pts[1].ptX, pts[1].topY,    0
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
    const uvScale = wallEl.getAttribute('wall')?.uvScale ?? 1;
    makePlaneUvs(wallGeom, 'x', 'y', uvScale, uvScale);
    finishGeometry(wallGeom);
    const material = wallEl.components?.material?.material || wallEl.parentEl?.components?.material?.material;
    if (wallEl.mesh) {
      wallEl.mesh.geometry = wallGeom;
      wallEl.mesh.material = material;
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

// Builds the tunnel geometry connecting two openings. The fromEl and toEl opening
// elements must already have their world-space vertices populated by buildRoom.
// Each child element (floor, ceiling, sides) gets its own quad mesh.
const buildPortal = (portalEl) => {
  const { from: fromEl, to: toEl } = portalEl.getAttribute('portal');
  const portalId = portalEl.id ? `#${portalEl.id}` : '<a-portal>';
  const fromVerts = fromEl?.vertices;
  const toVerts = toEl?.vertices;
  if (!fromVerts?.length || !toVerts?.length) {
    console.error(`${portalId}: opening vertices not found — ensure both openings exist and their rooms have been built.`);
    return;
  }

  for (const childEl of portalEl.children) {
    const type = CHILD_TYPES.find(t => childEl.components[t]);
    if (!type) { continue; }

    const material = childEl.components?.material?.material
      || childEl.parentEl?.components?.material?.material
      || fromEl?.parentEl?.components?.material?.material
      || fromEl?.parentEl?.parentEl?.components?.material?.material;

    // sides needs two quads (left and right walls); floor and ceiling need one each.
    const indices = (type === 'sides') ? [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6] : [0, 1, 2, 1, 3, 2];
    const geom = new THREE.BufferGeometry();
    geom.setIndex(indices);

    childEl.mesh = new THREE.Mesh(geom, material);
    childEl.setObject3D(type, childEl.mesh);

    // Collect vertex positions in world space, then convert to the child's local space.
    // Vertex layout per opening: [0]=left-bottom, [1]=left-top, [2]=right-bottom, [3]=right-top.
    const positions = [];
    const uvScale = childEl.getAttribute(type)?.uvScale ?? 1;
    let uvCallback;

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
          let u = Math.floor(vertIndex / 2);
          if (vertIndex < 4) { u = 1 - u; }
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
