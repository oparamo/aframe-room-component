const HAIR = 0.0001; // Small epsilon to prevent z-fighting at doorhole edges.
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
    // revisiting if UV seams appear on doorlink surfaces.
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
const addDoorlinkWorldVertex = (vertex, childEl, positions) => {
  const point = vertex.clone();
  childEl.object3D.worldToLocal(point);
  positions.push(point.x, point.y, point.z);
};

// Converts a wall-local (ptX, ptY) coordinate to world space and stores it on
// the doorhole element so buildDoorlink can connect the two openings later.
const addDoorholeWorldVertex = (wallEl, doorholeEl, ptX, ptY) => {
  const vertex = new THREE.Vector3(ptX, ptY, 0);
  wallEl.object3D.localToWorld(vertex);
  doorholeEl.vertices.push(vertex);
};

// Projects the doorlink's world position onto the wall's local X axis to find
// where along the wall the doorhole should be centred, then clamps it so the
// opening always fits within the wall bounds.
const positionDoorhole = (doorholeEl) => {
  const doorlinkEl = doorholeEl.getDoorlink();
  const wallEl = doorholeEl.parentEl;
  const nextWallEl = wallEl?.nextWallEl;
  if (!doorlinkEl || !nextWallEl) { return; }

  const wallWorldPosition = new THREE.Vector3();
  wallEl.object3D.getWorldPosition(wallWorldPosition);

  const nextWallWorldPosition = new THREE.Vector3();
  nextWallEl.object3D.getWorldPosition(nextWallWorldPosition);

  const doorlinkWorldPosition = new THREE.Vector3();
  doorlinkEl.object3D.getWorldPosition(doorlinkWorldPosition);

  const doorlinkGapX = doorlinkWorldPosition.x - wallWorldPosition.x;
  const doorlinkGapZ = doorlinkWorldPosition.z - wallWorldPosition.z;

  const wallGapX = nextWallWorldPosition.x - wallWorldPosition.x;
  const wallGapY = nextWallWorldPosition.y - wallWorldPosition.y;
  const wallGapZ = nextWallWorldPosition.z - wallWorldPosition.z;

  const wallLength = Math.hypot(wallGapX, wallGapZ);

  const doorlinkHalfWidth = doorlinkEl.getAttribute('doorlink')?.width / 2;

  // Project the doorlink offset onto the wall axis to get its local X position.
  const wallDir = new THREE.Vector2(wallGapX, wallGapZ).normalize();
  const doorlinkOffset = new THREE.Vector2(doorlinkGapX, doorlinkGapZ);
  let doorlinkLocalX = doorlinkOffset.dot(wallDir);
  doorlinkLocalX = Math.max(doorlinkLocalX, doorlinkHalfWidth + HAIR);
  doorlinkLocalX = Math.min(doorlinkLocalX, wallLength - doorlinkHalfWidth - HAIR);

  const floorY = (doorlinkLocalX / wallLength) * wallGapY;
  doorholeEl.object3D.position.set(doorlinkLocalX, floorY, 0);
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

// Builds the floor or ceiling mesh for a room. Traces the wall corner positions
// as a 2D shape in the XZ plane, then lifts each vertex to the correct Y height.
// Ceiling vertices are raised by the wall height at that corner.
const buildCap = (walls, capEl, isCeiling, isOutside) => {
  const shape = new THREE.Shape();
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const x = wallEl.object3D.position.x;
    const z = wallEl.object3D.position.z;
    if (i) {
      shape.lineTo(x, z);
    } else {
      shape.moveTo(x, z);
    }
  }

  // ShapeGeometry is flat (XY plane); lift each vertex into the correct 3D position.
  const geom = new THREE.ShapeGeometry(shape);
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const vertex = new THREE.Vector3(
      geom.attributes.position.getX(i),
      geom.attributes.position.getY(i),
      geom.attributes.position.getZ(i)
    );
    // ShapeGeometry uses XY; remap to XZ, using the wall's Y as the base height.
    vertex.set(vertex.x, wallEl.object3D.position.y, vertex.y);
    if (isCeiling) { vertex.y += wallEl.getHeight(); }
    geom.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  // For quads the default fan triangulation (diagonal 0–2) may produce a visible seam
  // when the four cap vertices are non-coplanar (e.g. asymmetric wall heights). Compare
  // both diagonals and switch to 1–3 if its triangles are more coplanar.
  if (walls.length === 4) {
    const v = [0, 1, 2, 3].map(i => new THREE.Vector3(
      geom.attributes.position.getX(i),
      geom.attributes.position.getY(i),
      geom.attributes.position.getZ(i)
    ));
    const n = new THREE.Vector3(), m = new THREE.Vector3();
    new THREE.Triangle(v[0], v[1], v[2]).getNormal(n);
    new THREE.Triangle(v[0], v[2], v[3]).getNormal(m);
    const dot02 = n.dot(m);
    new THREE.Triangle(v[0], v[1], v[3]).getNormal(n);
    new THREE.Triangle(v[1], v[2], v[3]).getNormal(m);
    if (n.dot(m) > dot02) geom.setIndex([0, 1, 3, 1, 2, 3]);
  }

  // Floor and ceiling face opposite directions; outside rooms also flip normals.
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
  // the wall, Y upward). Doorhole openings are punched in as the shape is traced.
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    // Store a reference to the next wall so positionDoorhole can access it.
    const nextWallEl = wallEl.nextWallEl = walls[(i + 1) % walls.length];

    const wallGapX = nextWallEl.object3D.position.x - wallEl.object3D.position.x;
    const wallGapY = nextWallEl.object3D.position.y - wallEl.object3D.position.y;
    const wallGapZ = nextWallEl.object3D.position.z - wallEl.object3D.position.z;

    const heightGap = nextWallEl.getHeight() - wallEl.getHeight();
    const wallAngle = Math.atan2(wallGapZ, wallGapX);
    const wallLength = Math.hypot(wallGapX, wallGapZ);

    // Rotate the wall to face inward along its XZ direction.
    wallEl.object3D.rotation.y = -wallAngle;

    // Start the wall shape at the top-left corner, trace down to the bottom-left.
    const wallShape = new THREE.Shape();
    wallShape.moveTo(0, wallEl.getHeight());
    wallShape.lineTo(0, 0);

    for (const doorholeEl of wallEl.doorholes) {
      positionDoorhole(doorholeEl);
      doorholeEl.vertices = [];

      const doorlinkEl = doorholeEl.getDoorlink();
      if (!doorlinkEl) { continue; }

      const { width: doorlinkWidth, height: doorlinkHeight } = doorlinkEl.getAttribute('doorlink');
      // side = -1 is the left edge of the doorhole, side = +1 is the right edge.
      for (let side = -1; side <= 1; side += 2) {
        const ptX = doorholeEl.object3D.position.x + doorlinkWidth / 2 * side;
        // Interpolate floor Y for sloped walls (non-zero wallGapY).
        const floorY = (ptX / wallLength) * wallGapY;
        let topY = floorY + doorlinkHeight;

        // Clamp the top of the opening to the ceiling, leaving a HAIR seam.
        const ceilingY = wallEl.getHeight() + (ptX / wallLength) * heightGap;
        const maxTopY = floorY + ceilingY - HAIR;
        if (topY > maxTopY) { topY = maxTopY; }

        // Record world-space vertices for buildDoorlink to use later.
        addDoorholeWorldVertex(wallEl, doorholeEl, ptX, floorY);
        addDoorholeWorldVertex(wallEl, doorholeEl, ptX, topY);

        // Trace the opening into the shape: left side goes up, right side goes down.
        if (side < 0) {
          wallShape.lineTo(ptX, floorY);
          wallShape.lineTo(ptX, topY);
        } else {
          wallShape.lineTo(ptX, topY);
          wallShape.lineTo(ptX, floorY);
        }
      }
    }

    // Close the shape at the top-right and bottom-right corners.
    wallShape.lineTo(wallLength, wallGapY);
    wallShape.lineTo(wallLength, wallGapY + nextWallEl.getHeight());

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

// Builds the tunnel geometry connecting two doorhole openings. The fromEl and
// toEl doorhole elements must already have their world-space vertices populated
// by buildRoom. Each child element (floor, ceiling, sides) gets its own quad mesh.
const buildDoorlink = (doorlinkEl) => {
  const { from: fromEl, to: toEl } = doorlinkEl.getAttribute('doorlink');
  const doorlinkId = doorlinkEl.id ? `#${doorlinkEl.id}` : '<a-doorlink>';
  const fromVerts = fromEl?.vertices;
  const toVerts = toEl?.vertices;
  if (!fromVerts?.length || !toVerts?.length) {
    console.error(`${doorlinkId}: doorhole vertices not found — ensure both doorholes exist and their rooms have been built.`);
    return;
  }

  for (const childEl of doorlinkEl.children) {
    const type = CHILD_TYPES.find(t => childEl.components[t]);
    if (!type) { continue; }

    const material = childEl.components?.material?.material || childEl.parentEl?.components?.material?.material;

    // sides needs two quads (left and right walls); floor and ceiling need one each.
    const indices = (type === 'sides') ? [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6] : [0, 1, 2, 1, 3, 2];
    const geom = new THREE.BufferGeometry();
    geom.setIndex(indices);

    childEl.mesh = new THREE.Mesh(geom, material);
    childEl.setObject3D(type, childEl.mesh);

    // Collect vertex positions in world space, then convert to the child's local space.
    // Vertex layout per doorhole: [0]=left-floor, [1]=left-top, [2]=right-floor, [3]=right-top.
    const positions = [];
    const uvScale = childEl.getAttribute(type)?.uvScale ?? 1;
    let uvCallback;

    switch (type) {
      case 'floor':
        addDoorlinkWorldVertex(toVerts[0], childEl, positions);
        addDoorlinkWorldVertex(toVerts[2], childEl, positions);
        addDoorlinkWorldVertex(fromVerts[2], childEl, positions);
        addDoorlinkWorldVertex(fromVerts[0], childEl, positions);
        uvCallback = (point, vertIndex) => ([(1 - (vertIndex % 2)) * uvScale, (1 - Math.floor(vertIndex / 2)) * uvScale]);
        break;
      case 'ceiling':
        addDoorlinkWorldVertex(toVerts[3], childEl, positions);
        addDoorlinkWorldVertex(toVerts[1], childEl, positions);
        addDoorlinkWorldVertex(fromVerts[1], childEl, positions);
        addDoorlinkWorldVertex(fromVerts[3], childEl, positions);
        uvCallback = (point, vertIndex) => ([(vertIndex % 2) * uvScale, (1 - Math.floor(vertIndex / 2)) * uvScale]);
        break;
      case 'sides':
        addDoorlinkWorldVertex(toVerts[2], childEl, positions);
        addDoorlinkWorldVertex(toVerts[3], childEl, positions);
        addDoorlinkWorldVertex(fromVerts[0], childEl, positions);
        addDoorlinkWorldVertex(fromVerts[1], childEl, positions);

        addDoorlinkWorldVertex(fromVerts[2], childEl, positions);
        addDoorlinkWorldVertex(fromVerts[3], childEl, positions);
        addDoorlinkWorldVertex(toVerts[0], childEl, positions);
        addDoorlinkWorldVertex(toVerts[1], childEl, positions);
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

export { buildDoorlink, buildRoom };
