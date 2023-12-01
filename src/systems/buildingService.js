'use strict';

const HAIR = 0.0001;

const flipGeometry = (geom) => {
  const indices = geom.getIndex().array;
  for (let i = 0; i < indices.length; i += 3) {
    const tempIndex = indices[i + 2];
    indices[i + 2] = indices[i + 1];
    indices[i + 1] = tempIndex;
  }

  geom.getIndex().needsUpdate = true;
};

const makeGeometryUvs = (geom, callback) => {
  const indices = geom.getIndex().array;
  const uvs = [];
  for (const vertexIndex of indices) {
    const vertex = new THREE.Vector3(
      geom.attributes.position.getX(vertexIndex),
      geom.attributes.position.getY(vertexIndex),
      geom.attributes.position.getZ(vertexIndex)
    );

    const [u, v] = callback(vertex, vertexIndex % 3);
    uvs[vertexIndex * 2 + 0] = u;
    uvs[vertexIndex * 2 + 1] = v;
  }

  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
};

const makePlaneUvs = (geom, uKey, vKey, uMult, vMult) => {
  const callback = (point) => ([point[uKey] * uMult, point[vKey] * vMult]);
  makeGeometryUvs(geom, callback);
};

const finishGeometry = (geom) => {
  geom.computeVertexNormals();
  // geom.computeBoundingBox();
  // geom.computeBoundingSphere();
};

const addDoorlinkWorldVertex = (vertex, doorlinkChildEl, positions) => {
  const point = vertex.clone();
  doorlinkChildEl.object3D.worldToLocal(point);
  positions.push(point.x, point.y, point.z);
};

const addDoorholeWorldVertex = (wall, doorhole, ptX, ptY) => {
  const vertex = new THREE.Vector3(ptX, ptY, 0);
  wall.object3D.localToWorld(vertex);
  doorhole.vertices.push(vertex);
};

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
  const wallGapZ = nextWallWorldPosition.z - wallWorldPosition.z;

  const wallAngle = Math.atan2(wallGapZ, wallGapX);
  const wallLength = Math.sqrt(wallGapX * wallGapX + wallGapZ * wallGapZ);

  const doorHalf = doorlinkEl.getAttribute('doorlink')?.width / 2;

  let localLinkX = doorlinkGapX * Math.cos(-wallAngle) - doorlinkGapZ * Math.sin(-wallAngle);
  localLinkX = Math.max(localLinkX, doorHalf + HAIR);
  localLinkX = Math.min(localLinkX, wallLength - doorHalf - HAIR);
  // const localLinkZ = doorlinkGapX*Math.sin(-wallAngle) + doorlinkGapZ*Math.cos(-wallAngle);

  doorholeEl.object3D.position.set(localLinkX, 0, 0);
};

const sortWalls = (walls, isOutside) => {
  let cwSum = 0;
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const nextWallEl = walls[(i + 1) % walls.length];

    const { x: wallX, z: wallZ } = wallEl.object3D.position;
    const { x: nextWallX, z: nextWallZ } = nextWallEl.object3D.position;

    cwSum += (nextWallX - wallX) * (nextWallZ + wallZ);
  }

  let shouldReverse = false;
  if (cwSum > 0) { shouldReverse = !shouldReverse; }
  if (isOutside) { shouldReverse = !shouldReverse; }
  if (shouldReverse) { walls.reverse(); }
};

const buildCap = (walls, cap, isCeiling, isOutside) => {
  const shape = new THREE.Shape();
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const ptX = wallEl.object3D.position.x;
    const ptZ = wallEl.object3D.position.z;
    if (i) {
      shape.lineTo(ptX, ptZ);
    } else {
      shape.moveTo(ptX, ptZ);
    }
  }

  const geom = new THREE.ShapeGeometry(shape);
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const vertex = new THREE.Vector3(
      geom.attributes.position.getX(i),
      geom.attributes.position.getY(i),
      geom.attributes.position.getZ(i)
    );
    vertex.set(vertex.x, wallEl.object3D.position.y, vertex.y);
    if (isCeiling) { vertex.y += wallEl.getHeight(); }
    geom.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  let shouldReverse = false;
  if (!isCeiling) { shouldReverse = !shouldReverse; }
  if (isOutside) { shouldReverse = !shouldReverse; }
  if (shouldReverse) { flipGeometry(geom); }

  // makePlaneUvs(geom, 'x', 'z', isCeiling ? 1 : -1, 1);
  makePlaneUvs(geom, 'x', 'z', 1, 1);
  finishGeometry(geom);

  const material = cap?.components?.material?.material || cap?.parentEl?.components?.material?.material;
  if (cap.mesh) {
    cap.mesh.geometry = geom;
    cap.mesh.material = material;
  } else {
    const typeLabel = isCeiling ? 'ceiling' : 'floor';
    cap.mesh = new THREE.Mesh(geom, material);
    cap.setObject3D(typeLabel, cap.mesh);
  }
};

const buildRoom = (roomEl) => {
  const { outside, length, width } = roomEl?.getAttribute('room');
  const walls = roomEl?.walls;

  if (width && length) {
    walls[0].object3D.position.set(0, 0, 0);
    walls[1].object3D.position.set(width, 0, 0);
    walls[2].object3D.position.set(width, 0, length);
    walls[3].object3D.position.set(0, 0, length);
  }

  sortWalls(walls, outside);

  // build walls
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const nextWallEl = wallEl.nextWallEl = walls[(i + 1) % walls.length];

    const wallGapX = nextWallEl.object3D.position.x - wallEl.object3D.position.x;
    const wallGapY = nextWallEl.object3D.position.y - wallEl.object3D.position.y;
    const wallGapZ = nextWallEl.object3D.position.z - wallEl.object3D.position.z;

    const heightGap = nextWallEl.getHeight() - wallEl.getHeight();
    const wallAngle = Math.atan2(wallGapZ, wallGapX);
    const wallLength = Math.sqrt(wallGapX * wallGapX + wallGapZ * wallGapZ);

    wallEl.object3D.rotation.y = THREE.MathUtils.degToRad(-wallAngle / Math.PI * 180);

    const wallShape = new THREE.Shape();
    wallShape.moveTo(0, wallEl.getHeight());
    wallShape.lineTo(0, 0);

    // build doorholes
    for (const doorholeEl of wallEl.doorholes) {
      positionDoorhole(doorholeEl);

      const doorlinkEl = doorholeEl.getDoorlink();
      if (!doorlinkEl) { continue; }

      for (let holeSide = -1; holeSide <= 1; holeSide += 2) {
        const ptX = doorholeEl.object3D.position.x + doorlinkEl.getAttribute('doorlink').width / 2 * holeSide;
        const floorY = (ptX / wallLength) * wallGapY;
        let topY = floorY + doorlinkEl.getAttribute('doorlink').height;

        const ceiling = wallEl.getHeight() + (ptX / wallLength) * heightGap;
        const maxTopY = floorY + ceiling - HAIR; // will always be a seam
        if (topY > maxTopY) { topY = maxTopY; }

        addDoorholeWorldVertex(wallEl, doorholeEl, ptX, floorY);
        addDoorholeWorldVertex(wallEl, doorholeEl, ptX, topY);

        if (holeSide < 0) {
          wallShape.lineTo(ptX, floorY);
          wallShape.lineTo(ptX, topY);
        } else {
          wallShape.lineTo(ptX, topY);
          wallShape.lineTo(ptX, floorY);
        }
      }
    }

    wallShape.lineTo(
      wallLength,
      nextWallEl?.object3D?.position?.y - wallEl?.object3D?.position?.y
    );
    wallShape.lineTo(
      wallLength,
      (nextWallEl?.object3D?.position?.y - wallEl?.object3D?.position?.y) + nextWallEl.getHeight()
    );

    const wallGeom = new THREE.ShapeGeometry(wallShape);
    makePlaneUvs(wallGeom, 'x', 'y', 1, 1);
    finishGeometry(wallGeom);
    const material = wallEl?.components?.material?.material || wallEl?.parentEl?.components?.material?.material;
    if (wallEl.mesh) {
      wallEl.mesh.geometry = wallGeom;
      wallEl.mesh.material = material;
    } else {
      wallEl.mesh = new THREE.Mesh(wallGeom, material);
      wallEl.setObject3D('wallMesh', wallEl.mesh);
    }
  }

  // build ceiling and floor
  buildCap(walls, roomEl?.floor, false, outside);
  buildCap(walls, roomEl?.ceiling, true, outside);
};

const buildDoorlink = (doorlinkEl) => {
  const { from, to } = doorlinkEl.getAttribute('doorlink');
  const fromVerts = from?.vertices;
  const toVerts = to?.vertices;
  if (!fromVerts || !toVerts) { return; }

  for (const doorlinkChildEl of doorlinkEl.children) {
    const types = ['sides', 'floor', 'ceiling'];
    for (const type of types) {
      if (!doorlinkChildEl.components[type]) { continue; }

      const material = doorlinkChildEl?.components?.material?.material || doorlinkChildEl?.parentEl?.components?.material?.material;

      const indices = (type === 'sides') ? [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6] : [0, 1, 2, 1, 3, 2];
      const geom = new THREE.BufferGeometry();
      geom.setIndex(indices);

      doorlinkChildEl.mesh = new THREE.Mesh(geom, material);
      doorlinkChildEl.setObject3D(type, doorlinkChildEl.mesh);

      const positions = [];

      switch (type) {
        case 'floor':
          addDoorlinkWorldVertex(toVerts[0], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(toVerts[2], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(fromVerts[2], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(fromVerts[0], doorlinkChildEl, positions);

          geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

          makeGeometryUvs(geom, (point, vertIndex) => ([1 - (vertIndex % 2), 1 - Math.floor(vertIndex / 2)]));

          break;
        case 'ceiling':
          addDoorlinkWorldVertex(toVerts[3], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(toVerts[1], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(fromVerts[1], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(fromVerts[3], doorlinkChildEl, positions);

          geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

          makeGeometryUvs(geom, (point, vertIndex) => ([vertIndex % 2, 1 - Math.floor(vertIndex / 2)]));

          break;
        case 'sides':
          addDoorlinkWorldVertex(toVerts[2], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(toVerts[3], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(fromVerts[0], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(fromVerts[1], doorlinkChildEl, positions);

          addDoorlinkWorldVertex(fromVerts[2], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(fromVerts[3], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(toVerts[0], doorlinkChildEl, positions);
          addDoorlinkWorldVertex(toVerts[1], doorlinkChildEl, positions);

          geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

          makeGeometryUvs(geom, (point, vertIndex) => {
            const uv = [];
            uv[0] = Math.floor(vertIndex / 2);
            uv[1] = vertIndex % 2;
            if (vertIndex < 4) { uv[0] = 1 - uv[0]; }
            return uv;
          });

          break;
      }

      finishGeometry(geom);
    }
  }
};

module.exports = { buildDoorlink, buildRoom };
