'use strict';

require('./components');
require('./primitives');

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

// TODO: remove these completely by hooking into aframe lifecycles
const getUnsortedRoomWalls = (room) => {
  return Array.from(room?.children).filter(child => child?.components?.wall);
};

// TODO: remove these completely by hooking into aframe lifecycles
const getRoomWalls = (room) => {
  const isOutside = room?.components?.room?.data?.outside;
  const walls = getUnsortedRoomWalls(room);

  let cwSum = 0;
  for (let i = 0; i < walls.length; i++) {
    const currentWall = walls[i];
    const nextWall = walls[(i + 1) % walls.length];
    const { x: currentWallX, z: currentWallZ } = currentWall.components.position.data;
    const { x: nextWallX, z: nextWallZ } = nextWall.components.position.data;

    cwSum += (nextWallX - currentWallX) * (nextWallZ + currentWallZ);
  }

  let shouldReverse = false;
  if (cwSum > 0) { shouldReverse = !shouldReverse; }
  if (isOutside) { shouldReverse = !shouldReverse; }
  if (shouldReverse) { walls.reverse(); }

  return walls;
};

const getNextWall = (wall) => {
  const roomWalls = getRoomWalls(wall.parentNode);
  return roomWalls[(roomWalls.indexOf(wall) + 1) % roomWalls.length];
};

const moveForLink = (doorhole, doorlink) => {
  const wall = doorhole.parentNode;
  const nextWall = getNextWall(wall);
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
  return wall?.components?.wall?.data?.height || wall?.parentNode?.components?.room?.data?.height;
};

const getDoorholeLink = (doorhole, doorlinks) => {
  return doorlinks.find((link) => link?.components?.doorlink?.data?.from === doorhole || link?.components?.doorlink?.data?.to === doorhole);
};

AFRAME.registerSystem('building', {
  init: function () {
    this.rooms = {};
  },
  examineBuilding: function () {
    if (this.dirty) { return; }
    this.dirty = true;

    setTimeout(() => {
      examineBuildingCount++;
      console.info('examineBuildingCount: ', examineBuildingCount);

      // silly but necessary because of threeJS weirdness
      this.el.object3D.updateMatrixWorld();

      const doorlinks = Array.from(this.el.querySelectorAll('[doorlink]'));

      // lay out walls' angles:
      for (const sceneChild of this.el.children) {
        if (sceneChild?.components?.room) {
          // TODO: move this validation to the room component
          const { width, length } = sceneChild?.components?.room?.data;
          if (width || length) {
            if (width && length) {
              const rawWalls = getUnsortedRoomWalls(sceneChild);
              if (rawWalls.length >= 4) {
                if (rawWalls.length > 4) { console.error('rooms with WIDTH and LENGTH should only have four walls!'); }
                rawWalls[0].setAttribute('position', { x: 0, y: 0, z: 0 });
                rawWalls[1].setAttribute('position', { x: width, y: 0, z: 0 });
                rawWalls[2].setAttribute('position', { x: width, y: 0, z: length });
                rawWalls[3].setAttribute('position', { x: 0, y: 0, z: length });
              } else {
                console.error('rooms with WIDTH and LENGTH must have four walls!');
              }
            } else {
              console.error('rooms with WIDTH must also have LENGTH (and vice versa)');
            }
          }

          const walls = getRoomWalls(sceneChild);
          if (walls.length > 2) {
            for (let i = 0; i < walls.length; i++) {
              const currentWall = walls[i];
              const nextWall = walls[(i + 1) % walls.length];

              const wallGapX = nextWall.components.position.data.x - currentWall.components.position.data.x;
              const wallGapZ = nextWall.components.position.data.z - currentWall.components.position.data.z;
              const wallAngle = Math.atan2(wallGapZ, wallGapX);

              currentWall.setAttribute('rotation', { x: 0, y: -wallAngle / Math.PI * 180, z: 0 });
              currentWall.object3D.updateMatrixWorld();
            }
          }
        }
      }

      // position the door holes:
      doorlinks
        .filter((doorlinkEl) => doorlinkEl?.components?.doorlink)
        .forEach(({ components: { doorlink } }) => {
          moveForLink(doorlink?.data?.from, doorlink.el);
          moveForLink(doorlink?.data?.to, doorlink.el);
        });

      // generate the walls' geometry:
      for (const sceneChild of this.el.children) {
        if (sceneChild?.components?.room) {
          const isOutside = sceneChild?.components?.room?.data?.outside;
          const walls = getRoomWalls(sceneChild);

          if (walls.length > 2) {
            for (let wallIndex = 0; wallIndex < walls.length; wallIndex++) {
              const curWallNode = walls[wallIndex];
              const nextWallNode = walls[(wallIndex + 1) % walls.length];

              const wallGapX = nextWallNode.components.position.data.x - curWallNode.components.position.data.x;
              const wallGapZ = nextWallNode.components.position.data.z - curWallNode.components.position.data.z;
              const wallLength = Math.sqrt(wallGapX * wallGapX + wallGapZ * wallGapZ);
              // var wallAngle = Math.atan2(wallGapZ, wallGapX);

              const wallGapY = nextWallNode.components.position.data.y - curWallNode.components.position.data.y;
              const heightGap = getWallHeight(nextWallNode) - getWallHeight(curWallNode);

              const orderedHoles = Array.from(curWallNode.children)
                .filter((wallChild) => wallChild?.components?.doorhole)
                .sort((a, b) => a?.components?.position?.data?.x - b?.components?.position?.data?.x);

              const wallShape = new THREE.Shape();
              wallShape.moveTo(0, getWallHeight(curWallNode));
              wallShape.lineTo(0, 0);

              for (const hole of orderedHoles) {
                if (!hole.myVerts) { hole.myVerts = []; }
                hole.myVerts.length = 0;

                const doorholeLink = getDoorholeLink(hole, doorlinks);
                if (!doorholeLink) { continue; }

                const linkInfo = doorholeLink.components;

                for (let holeSide = -1; holeSide <= 1; holeSide += 2) {
                  const ptX = hole.object3D.position.x + linkInfo.doorlink.data.width / 2 * holeSide;
                  const floorY = (ptX / wallLength) * wallGapY;
                  let topY = floorY + linkInfo.doorlink.data.height;

                  const curCeil = getWallHeight(curWallNode) + (ptX / wallLength) * heightGap;
                  const maxTopY = floorY + curCeil - HAIR;// will always be a seam, but, I'm not bothering to rewrite just for that
                  if (topY > maxTopY) { topY = maxTopY; }

                  const addWorldVert = (ptX, ptY) => {
                    const tempPos = new THREE.Vector3(ptX, ptY, 0);
                    curWallNode.object3D.localToWorld(tempPos);
                    hole.myVerts.push(tempPos);
                  };
                  addWorldVert(ptX, floorY);
                  addWorldVert(ptX, topY);

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
                nextWallNode?.components?.position?.data?.y - curWallNode?.components?.position?.data?.y
              );
              wallShape.lineTo(
                wallLength,
                (nextWallNode?.components?.position?.data?.y - curWallNode?.components?.position?.data?.y) + getWallHeight(nextWallNode)
              );

              const wallGeom = new THREE.ShapeGeometry(wallShape);
              makePlaneUvs(wallGeom, 'x', 'y', 1, 1);
              finishGeometry(wallGeom);
              const myMat = curWallNode?.components?.material?.material || curWallNode?.parentNode?.components?.material?.material;
              if (curWallNode.myMesh) {
                curWallNode.myMesh.geometry = wallGeom;
                curWallNode.myMesh.material = myMat;
              } else {
                curWallNode.myMesh = new THREE.Mesh(wallGeom, myMat);
                curWallNode.setObject3D('wallMesh', curWallNode.myMesh);
              }
            }

            Array.from(sceneChild.children)
              .filter(roomChild => roomChild?.components?.floor || roomChild?.components?.ceiling)
              .forEach(cap => {
                const isCeiling = cap?.components?.ceiling;

                const capShape = new THREE.Shape();
                for (let wallIndex = 0; wallIndex < walls.length; wallIndex++) {
                  const curWallNode = walls[wallIndex];
                  const ptX = curWallNode.components.position.data.x;
                  const ptZ = curWallNode.components.position.data.z;
                  if (wallIndex) {
                    capShape.lineTo(ptX, ptZ);
                  } else {
                    capShape.moveTo(ptX, ptZ);
                  }
                }

                const capGeom = new THREE.ShapeGeometry(capShape);
                for (let wallIndex = 0; wallIndex < walls.length; wallIndex++) {
                  const curWallNode = walls[wallIndex];
                  const curVert = new THREE.Vector3(
                    capGeom.attributes.position.getX(wallIndex),
                    capGeom.attributes.position.getY(wallIndex),
                    capGeom.attributes.position.getZ(wallIndex)
                  );
                  curVert.set(curVert.x, curWallNode.components.position.data.y, curVert.y);
                  if (isCeiling) { curVert.y += getWallHeight(curWallNode); }
                  capGeom.attributes.position.setXYZ(wallIndex, curVert.x, curVert.y, curVert.z);
                }

                let shouldReverse = false;
                if (!isCeiling) { shouldReverse = !shouldReverse; }
                if (isOutside) { shouldReverse = !shouldReverse; }
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
        }
      }

      // generate the door tunnels' geometry:
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

      this.dirty = false;
    });
  },
  registerRoom: function (room) {
    const roomId = room?.el?.object3D?.uuid;
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = { walls: {} };
    }

    // this.rooms[roomId] = Object.assign(this.rooms[roomId], ...room.data);
  },
  unregisterRoom: function (room) {
    const roomId = room?.el?.object3D?.uuid;

    delete this.rooms[roomId];
  },
  registerWall: function (wall) {
    const roomId = wall?.el?.parentEl?.object3D?.uuid;
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = { walls: {} };
    }

    const wallId = wall?.el?.object3D?.uuid;
    this.rooms[roomId].walls[wallId] = { ...wall.data };
  },
  unregisterWall: function (wall) {
    const roomId = wall?.el?.parentEl?.object3D?.uuid;
    const wallId = wall?.el?.object3D?.uuid;

    delete this.rooms[roomId].walls[wallId];
  }
});
