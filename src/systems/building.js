'use strict';

let examineBuildingCount = 0;

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
  const uvs = indices.reduce((uvs, vertexIndex) => {
    const vertex = new THREE.Vector3(
      geom.attributes.position.getX(vertexIndex),
      geom.attributes.position.getY(vertexIndex),
      geom.attributes.position.getZ(vertexIndex)
    );

    const [u, v] = callback(vertex, vertexIndex % 3);
    uvs[vertexIndex * 2 + 0] = u;
    uvs[vertexIndex * 2 + 1] = v;

    return uvs;
  }, []);

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
  // TODO: remove completely or make optional
  // geom.computeBoundingBox();
  // geom.computeBoundingSphere();
};

const moveForLink = (doorhole, doorlink) => {
  const wall = doorhole.parentEl;
  const nextWall = wall.nextWall;
  if (!nextWall) { return; }

  const wallWorldPosition = new THREE.Vector3();
  wall.object3D.getWorldPosition(wallWorldPosition);

  const nextWallWorldPosition = new THREE.Vector3();
  nextWall.object3D.getWorldPosition(nextWallWorldPosition);

  const doorlinkWorldPosition = new THREE.Vector3();
  doorlink.object3D.getWorldPosition(doorlinkWorldPosition);

  const linkGapX = doorlinkWorldPosition.x - wallWorldPosition.x;
  const linkGapZ = doorlinkWorldPosition.z - wallWorldPosition.z;

  const wallGapX = nextWallWorldPosition.x - wallWorldPosition.x;
  const wallGapZ = nextWallWorldPosition.z - wallWorldPosition.z;

  const wallAngle = Math.atan2(wallGapZ, wallGapX);
  const wallLength = Math.sqrt(wallGapX * wallGapX + wallGapZ * wallGapZ);

  const doorHalf = doorlink.components.doorlink.data.width / 2;

  let localLinkX = linkGapX * Math.cos(-wallAngle) - linkGapZ * Math.sin(-wallAngle);
  localLinkX = Math.max(localLinkX, doorHalf + HAIR);
  localLinkX = Math.min(localLinkX, wallLength - doorHalf - HAIR);

  // var localLinkZ = linkGapX*Math.sin(-wallAngle) + linkGapZ*Math.cos(-wallAngle);

  doorhole.object3D.position.set(localLinkX, 0, 0);
  doorhole.object3D.updateMatrixWorld();
};

const getWallHeight = (wall) => {
  return wall?.getAttribute('wall')?.height || wall?.parentNode?.getAttribute('room')?.height;
};

const getDoorholeLink = (doorhole, doorlinks) => {
  return doorlinks.find((link) => link?.components?.doorlink?.data?.from === doorhole || link?.components?.doorlink?.data?.to === doorhole);
};

const positionDoorholes = (doorlinks) => {
  for (const doorlinkEl of doorlinks) {
    const { from, to } = doorlinkEl.getAttribute('doorlink');

    moveForLink(from, doorlinkEl);
    moveForLink(to, doorlinkEl);
  }
};

const addWorldVert = (wall, hole, ptX, ptY) => {
  const tempPos = new THREE.Vector3(ptX, ptY, 0);
  wall.object3D.localToWorld(tempPos);
  hole.myVerts.push(tempPos);
};

const generateWallGeometry = (rooms, doorlinks) => {
  for (const roomEl of rooms) {
    const { outside } = roomEl?.getAttribute('room');
    const walls = roomEl?.walls;

    for (let i = 0; i < walls.length; i++) {
      const currentWall = walls[i];
      const nextWall = currentWall.nextWall;

      const wallGapX = nextWall.components.position.data.x - currentWall.components.position.data.x;
      const wallGapZ = nextWall.components.position.data.z - currentWall.components.position.data.z;
      const wallLength = Math.sqrt(wallGapX * wallGapX + wallGapZ * wallGapZ);
      // var wallAngle = Math.atan2(wallGapZ, wallGapX);

      const wallGapY = nextWall.components.position.data.y - currentWall.components.position.data.y;
      const heightGap = getWallHeight(nextWall) - getWallHeight(currentWall);

      const wallShape = new THREE.Shape();
      wallShape.moveTo(0, getWallHeight(currentWall));
      wallShape.lineTo(0, 0);

      for (const hole of currentWall.doorholes) {
        if (!hole.myVerts) { hole.myVerts = []; }
        hole.myVerts.length = 0;

        const doorholeLink = getDoorholeLink(hole, doorlinks);
        if (!doorholeLink) { continue; }

        const linkInfo = doorholeLink.components;

        for (let holeSide = -1; holeSide <= 1; holeSide += 2) {
          const ptX = hole.object3D.position.x + linkInfo.doorlink.data.width / 2 * holeSide;
          const floorY = (ptX / wallLength) * wallGapY;
          let topY = floorY + linkInfo.doorlink.data.height;

          const curCeil = getWallHeight(currentWall) + (ptX / wallLength) * heightGap;
          const maxTopY = floorY + curCeil - HAIR;// will always be a seam, but, I'm not bothering to rewrite just for that
          if (topY > maxTopY) { topY = maxTopY; }

          addWorldVert(currentWall, hole, ptX, floorY);
          addWorldVert(currentWall, hole, ptX, topY);

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
        nextWall?.components?.position?.data?.y - currentWall?.components?.position?.data?.y
      );
      wallShape.lineTo(
        wallLength,
        (nextWall?.components?.position?.data?.y - currentWall?.components?.position?.data?.y) + getWallHeight(nextWall)
      );

      const wallGeom = new THREE.ShapeGeometry(wallShape);
      makePlaneUvs(wallGeom, 'x', 'y', 1, 1);
      finishGeometry(wallGeom);
      const myMat = currentWall?.components?.material?.material || currentWall?.parentNode?.components?.material?.material;
      if (currentWall.myMesh) {
        currentWall.myMesh.geometry = wallGeom;
        currentWall.myMesh.material = myMat;
      } else {
        currentWall.myMesh = new THREE.Mesh(wallGeom, myMat);
        currentWall.setObject3D('wallMesh', currentWall.myMesh);
      }
    }

    Array.from(roomEl.children)
      .filter(roomChild => roomChild?.components?.floor || roomChild?.components?.ceiling)
      .forEach(cap => {
        const isCeiling = cap?.components?.ceiling;

        const capShape = new THREE.Shape();
        for (let i = 0; i < walls.length; i++) {
          const currentWall = walls[i];
          const ptX = currentWall.components.position.data.x;
          const ptZ = currentWall.components.position.data.z;
          if (i) {
            capShape.lineTo(ptX, ptZ);
          } else {
            capShape.moveTo(ptX, ptZ);
          }
        }

        const capGeom = new THREE.ShapeGeometry(capShape);
        for (let i = 0; i < walls.length; i++) {
          const currentWall = walls[i];
          const curVert = new THREE.Vector3(
            capGeom.attributes.position.getX(i),
            capGeom.attributes.position.getY(i),
            capGeom.attributes.position.getZ(i)
          );
          curVert.set(curVert.x, currentWall.components.position.data.y, curVert.y);
          if (isCeiling) { curVert.y += getWallHeight(currentWall); }
          capGeom.attributes.position.setXYZ(i, curVert.x, curVert.y, curVert.z);
        }

        let shouldReverse = false;
        if (!isCeiling) { shouldReverse = !shouldReverse; }
        if (outside) { shouldReverse = !shouldReverse; }
        if (shouldReverse) { flipGeometry(capGeom); }

        makePlaneUvs(capGeom, 'x', 'z', isCeiling ? 1 : -1, 1);
        finishGeometry(capGeom);

        if (!cap.myMeshes) { cap.myMeshes = []; }

        const typeLabel = isCeiling ? 'ceiling' : 'floor';
        const myMat = cap?.components?.material?.material || cap?.parentNode?.components?.material?.material;
        if (cap.myMeshes[typeLabel]) {
          cap.myMeshes[typeLabel].geometry = capGeom;
          cap.myMeshes[typeLabel].material = myMat;
        } else {
          cap.myMeshes[typeLabel] = new THREE.Mesh(capGeom, myMat);
          cap.setObject3D(typeLabel, cap.myMeshes[typeLabel]);
        }
      });
  }
};

const generateDoorlinkGeometry = (doorlinks) => {
  for (const doorlinkEl of doorlinks) {
    const doorlink = doorlinkEl.components.doorlink;
    const fVerts = doorlink?.data?.from?.myVerts;
    const tVerts = doorlink?.data?.to?.myVerts;
    if (!fVerts || !tVerts) { return; }

    for (const doorLinkChild of doorlinkEl.children) {
      if (!doorLinkChild.components) { continue; }

      const types = ['sides', 'floor', 'ceiling'];
      for (const curType of types) {
        if (!doorLinkChild.components[curType]) { continue; }

        const myMat = doorLinkChild?.components?.material?.material || doorLinkChild?.parentNode?.components?.material?.material;

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

            addWorldVertex(tVerts[0]);
            addWorldVertex(tVerts[2]);
            addWorldVertex(fVerts[2]);
            addWorldVertex(fVerts[0]);

            commitVertices();

            makeGeometryUvs(curGeom, (point, vertIndex) => {
              return [
                1 - (vertIndex % 2),
                1 - Math.floor(vertIndex / 2)
              ];
            });

            break;
          case 'ceiling':

            addWorldVertex(tVerts[3]);
            addWorldVertex(tVerts[1]);
            addWorldVertex(fVerts[1]);
            addWorldVertex(fVerts[3]);

            commitVertices();

            makeGeometryUvs(curGeom, (point, vertIndex) => {
              return [
                vertIndex % 2,
                1 - Math.floor(vertIndex / 2)
              ];
            });

            break;
          case 'sides':

            addWorldVertex(tVerts[2]);
            addWorldVertex(tVerts[3]);
            addWorldVertex(fVerts[0]);
            addWorldVertex(fVerts[1]);

            addWorldVertex(fVerts[2]);
            addWorldVertex(fVerts[3]);
            addWorldVertex(tVerts[0]);
            addWorldVertex(tVerts[1]);

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
  }
};

AFRAME.registerSystem('building', {
  init: function () {
    this.rooms = [];
    this.doorlinks = [];
  },
  examineBuilding: function () {
    if (this.dirty) { return; }
    this.dirty = true;

    examineBuildingCount++;

    setTimeout(() => {
      console.info('examineBuildingCount: ', examineBuildingCount);

      this.el.object3D.updateMatrixWorld();

      positionDoorholes(this.doorlinks);

      generateWallGeometry(this.rooms, this.doorlinks);

      generateDoorlinkGeometry(this.doorlinks);

      this.dirty = false;
    });
  },
  registerRoom: function (room) {
    this.rooms.push(room);
  },
  unregisterRoom: function (room) {
    // TODO: write a proper unregister function
    // const roomId = room?.object3D?.uuid;
    // this.rooms.delete(roomId);
  },
  registerDoorlink: function (doorlink) {
    this.doorlinks.push(doorlink);
  },
  unregisterDoorlink: function (doorlink) {
    // TODO: write a proper unregister function
    // const doorlinkId = doorlink?.object3D?.uuid;
    // this.doorlinks.delete(doorlinkId);
  }
});
