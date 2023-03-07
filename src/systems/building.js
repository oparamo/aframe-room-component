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
  makeGeometryUvs(geom, (point) => {
    return [
      point[uKey] * uMult,
      point[vKey] * vMult
    ];
  });
};

const finishGeometry = (geom) => {
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
};

const addWorldVert = (wall, hole, ptX, ptY) => {
  const tempPos = new THREE.Vector3(ptX, ptY, 0);
  wall.object3D.localToWorld(tempPos);
  hole.verts.push(tempPos);
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

  // var localLinkZ = doorlinkGapX*Math.sin(-wallAngle) + doorlinkGapZ*Math.cos(-wallAngle);

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
  const capShape = new THREE.Shape();
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const ptX = wallEl.object3D.position.x;
    const ptZ = wallEl.object3D.position.z;
    if (i) {
      capShape.lineTo(ptX, ptZ);
    } else {
      capShape.moveTo(ptX, ptZ);
    }
  }

  const capGeom = new THREE.ShapeGeometry(capShape);
  for (let i = 0; i < walls.length; i++) {
    const wallEl = walls[i];
    const curVert = new THREE.Vector3(
      capGeom.attributes.position.getX(i),
      capGeom.attributes.position.getY(i),
      capGeom.attributes.position.getZ(i)
    );
    curVert.set(curVert.x, wallEl.object3D.position.y, curVert.y);
    if (isCeiling) { curVert.y += wallEl.getHeight(); }
    capGeom.attributes.position.setXYZ(i, curVert.x, curVert.y, curVert.z);
  }

  let shouldReverse = false;
  if (!isCeiling) { shouldReverse = !shouldReverse; }
  if (isOutside) { shouldReverse = !shouldReverse; }
  if (shouldReverse) { flipGeometry(capGeom); }

  makePlaneUvs(capGeom, 'x', 'z', isCeiling ? 1 : -1, 1);
  finishGeometry(capGeom);

  if (!cap.myMeshes) { cap.myMeshes = []; }

  const typeLabel = isCeiling ? 'ceiling' : 'floor';
  const myMat = cap?.components?.material?.material || cap?.parentEl?.components?.material?.material;
  if (cap.myMeshes[typeLabel]) {
    cap.myMeshes[typeLabel].geometry = capGeom;
    cap.myMeshes[typeLabel].material = myMat;
  } else {
    cap.myMeshes[typeLabel] = new THREE.Mesh(capGeom, myMat);
    cap.setObject3D(typeLabel, cap.myMeshes[typeLabel]);
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

        const curCeil = wallEl.getHeight() + (ptX / wallLength) * heightGap;
        const maxTopY = floorY + curCeil - HAIR;// will always be a seam, but, I'm not bothering to rewrite just for that
        if (topY > maxTopY) { topY = maxTopY; }

        addWorldVert(wallEl, doorholeEl, ptX, floorY);
        addWorldVert(wallEl, doorholeEl, ptX, topY);

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
    const myMat = wallEl?.components?.material?.material || wallEl?.parentEl?.components?.material?.material;
    if (wallEl.myMesh) {
      wallEl.myMesh.geometry = wallGeom;
      wallEl.myMesh.material = myMat;
    } else {
      wallEl.myMesh = new THREE.Mesh(wallGeom, myMat);
      wallEl.setObject3D('wallMesh', wallEl.myMesh);
    }
  }

  // build ceiling and floor
  buildCap(walls, roomEl?.floor, false, outside);
  buildCap(walls, roomEl?.ceiling, true, outside);
};

const buildDoorlink = (doorlinkEl) => {
  const { from, to } = doorlinkEl.getAttribute('doorlink');
  const fromVerts = from?.verts;
  const toVerts = to?.verts;
  if (!fromVerts || !toVerts) { return; }

  for (const doorLinkChild of doorlinkEl.children) {
    if (!doorLinkChild.components) { continue; }

    const types = ['sides', 'floor', 'ceiling'];
    for (const curType of types) {
      if (!doorLinkChild.components[curType]) { continue; }

      const myMat = doorLinkChild?.components?.material?.material || doorLinkChild?.parentEl?.components?.material?.material;

      if (!doorLinkChild.myGeoms) { doorLinkChild.myGeoms = []; }
      if (!doorLinkChild.myGeoms[curType]) {
        const curGeom = new THREE.BufferGeometry();
        doorLinkChild.myGeoms[curType] = curGeom;
        const myMesh = new THREE.Mesh(curGeom, myMat);
        curGeom.meshRef = myMesh;
        doorLinkChild.setObject3D(curType, myMesh);
        const indexArray = [];
        indexArray.push(0, 1, 2, 1, 3, 2);
        if (curType === 'sides') { indexArray.push(4, 5, 6, 5, 7, 6); }
        curGeom.setIndex(indexArray);
      }

      const curGeom = doorLinkChild.myGeoms[curType];
      curGeom.meshRef.material = myMat;
      const positionArray = [];

      const addWorldVertex = (vertex) => {
        const point = vertex.clone();
        doorLinkChild.object3D.worldToLocal(point);
        positionArray.push(point.x, point.y, point.z);
      };

      const commitVertices = () => {
        curGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positionArray), 3));
      };

      switch (curType) {
        case 'floor':

          addWorldVertex(toVerts[0]);
          addWorldVertex(toVerts[2]);
          addWorldVertex(fromVerts[2]);
          addWorldVertex(fromVerts[0]);

          commitVertices();

          makeGeometryUvs(curGeom, (point, vertIndex) => {
            return [
              1 - (vertIndex % 2),
              1 - Math.floor(vertIndex / 2)
            ];
          });

          break;
        case 'ceiling':

          addWorldVertex(toVerts[3]);
          addWorldVertex(toVerts[1]);
          addWorldVertex(fromVerts[1]);
          addWorldVertex(fromVerts[3]);

          commitVertices();

          makeGeometryUvs(curGeom, (point, vertIndex) => {
            return [
              vertIndex % 2,
              1 - Math.floor(vertIndex / 2)
            ];
          });

          break;
        case 'sides':

          addWorldVertex(toVerts[2]);
          addWorldVertex(toVerts[3]);
          addWorldVertex(fromVerts[0]);
          addWorldVertex(fromVerts[1]);

          addWorldVertex(fromVerts[2]);
          addWorldVertex(fromVerts[3]);
          addWorldVertex(toVerts[0]);
          addWorldVertex(toVerts[1]);

          commitVertices();

          makeGeometryUvs(curGeom, (point, vertIndex) => {
            const uv = [];
            uv[0] = Math.floor(vertIndex / 2);
            uv[1] = vertIndex % 2;
            if (vertIndex < 4) { uv[0] = 1 - uv[0]; }
            return uv;
          });

          break;
      }
      finishGeometry(curGeom);
    }
  }
};

AFRAME.registerSystem('building', {
  init: function () {
    console.log('initializing building');

    this.el.rooms = this.el.querySelectorAll('a-room');
    this.el.doorlinks = this.el.querySelectorAll('a-doorlink');
    this.el.updateReady = false;

    this.el.addEventListener('loaded', this.initialBuild);
  },
  initialBuild: function () {
    console.info('building...');

    this.object3D.updateMatrixWorld();

    for (const roomEl of this.rooms) {
      buildRoom(roomEl);
    }

    for (const doorlinkEl of this.doorlinks) {
      buildDoorlink(doorlinkEl);
    }

    this.updateReady = true;
  },
  buildRoom: function (roomEl) {
    if (this.el.updateReady) buildRoom(roomEl);
  },
  buildDoorlink: function (doorlinkEl) {
    if (this.el.updateReady) buildDoorlink(doorlinkEl);
  }
});
