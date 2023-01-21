AFRAME.registerSystem('building', {

  reexamineBuilding: function(){

    //console.log(" = REEVALUATION REQUESTED...");

    const buildingSelf = this;
    const HAIR = 0.0001;

    /*

		https://github.com/oparamo/aframe-room-component
		v0.4.1

		OPTIMIZATION:

		currently, the entire building is getting re-generated from scratch any time anything in it changes.
		obviously this is wasteful, but:
		- this library isn't particularly likely to be used in a context where these properties will be changing at runtime (at least outside of debugging)
		- right now I am more concerned with getting it out the door than making it perfect anyway

		PLANNED FEATURES TO COME (in order):
		- greater control over UV generation
		- automatic collision assignment
		- doors lifted above the ground (i.e. windows)
		- accept a shape to be extruded around a doorhole to make a doorframe (& around a floor to make a baseboard)

		KNOWN ISSUES (with no obvious solution that would preserve ease of use):
		- floor/ceiling triangulation is not controllable (and therefore varying wall verticality is nearly useless unless slope is consistent)
		- doorhole parenting is always level to the horizon even on slope-floored walls
		- the setTimeout thing results in a one-frame flash of invisible walls: is it worth it? (is there a smarter thing to listen for, maybe?)

		ISSUES THAT COULD THEORETICALLY BE FIXED BUT DON'T SEEM WORTH THE TROUBLE:
		- walls are internally rearranged to always wind CW, which means wall parenting will point towards the "previous" wall if you entered them in CCW order

		*/

    function flipGeom(geom){
      const indexCopy = geom.index;
      for (let curFaceIndex=0; curFaceIndex<indexCopy.count/3; curFaceIndex++){
        const bucket = indexCopy[curFaceIndex*3+2];
        indexCopy[curFaceIndex*3+2] = indexCopy[curFaceIndex*3+1];
        indexCopy[curFaceIndex*3+1] = bucket;
      }
      geom.setIndex(indexCopy);
    }

    function makeUvsForGeom(geom, callback){
      const allUVs = [];
      for (let faceVertIndex=0; faceVertIndex<geom.index.array.length; faceVertIndex++){
        const vertexIndex = geom.index.array[faceVertIndex];
        const vertex = new THREE.Vector3(
          geom.attributes.position.getX(vertexIndex),
          geom.attributes.position.getY(vertexIndex),
          geom.attributes.position.getZ(vertexIndex)
        );
        const uv = callback(vertex, faceVertIndex%3);
        allUVs[vertexIndex*2+0] = uv[0];
        allUVs[vertexIndex*2+1] = uv[1];
      }
      geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(allUVs), 2));
      geom.uvsNeedUpdate = true;

    }
    function makePlaneUvs(geom, uKey, vKey, uMult, vMult){
      makeUvsForGeom(geom, (pt) => {
        return [
          pt[uKey]*uMult,
          pt[vKey]*vMult
        ];
      });
    }

    function finishGeom(geom){
      geom.computeVertexNormals();
      // are these necessary?
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
    }

    function getUnsortedRoomWallArray(roomEl){
      const walls=[];
      for (let roomChildNodeIndex=0; roomChildNodeIndex<roomEl.children.length; roomChildNodeIndex++){
        const roomChildNode = roomEl.children[roomChildNodeIndex];
        if (roomChildNode.components.wall) { walls.push(roomChildNode); }
      }
      return walls;
    }

    function getRoomWallArray(roomEl){

      // the results of this not being saved anywhere is super wasteful,
      // but, see above; not worth worrying about yet

      const isOutside = roomEl.components.room.data.outside;

      const walls = getUnsortedRoomWallArray(roomEl);

      let cwSum=0;
      for (let wallIndex=0; wallIndex<walls.length; wallIndex++){
        const curWallNode = walls[wallIndex];
        const nextWallNode = walls[(wallIndex+1)%walls.length];
        const curWallPos = curWallNode.components.position.data;
        const nextWallPos = nextWallNode.components.position.data;

        cwSum += (nextWallPos.x - curWallPos.x) * (nextWallPos.z + curWallPos.z);

      }

      let shouldReverse = false;
      if (cwSum > 0) { shouldReverse = !shouldReverse; }
      if (isOutside) { shouldReverse = !shouldReverse; }
      if (shouldReverse) { walls.reverse(); }

      return walls;

    }
    function getNextWallEl(wallEl){
      const wallList = getRoomWallArray(wallEl.parentNode);
      const curWallIndex = wallList.indexOf(wallEl);
      return wallList[(curWallIndex+1)%wallList.length];
    }

    const worldWallPos = new THREE.Vector3();
    const worldNextPos = new THREE.Vector3();
    const worldLinkPos = new THREE.Vector3();
    function moveForLink(doorholeEl, doorlinkEl){

      const holeWallEl = doorholeEl.parentNode;
      const nextWallEl = getNextWallEl(holeWallEl);
      if (!nextWallEl) { return; }

      holeWallEl.object3D.getWorldPosition(worldWallPos);
      nextWallEl.object3D.getWorldPosition(worldNextPos);
      doorlinkEl.object3D.getWorldPosition(worldLinkPos);

      const linkGapX = worldLinkPos.x - worldWallPos.x;
      const linkGapZ = worldLinkPos.z - worldWallPos.z;

      const wallGapX = worldNextPos.x - worldWallPos.x;
      const wallGapZ = worldNextPos.z - worldWallPos.z;
      const wallAng = Math.atan2(wallGapZ, wallGapX);
      const wallLength = Math.sqrt(wallGapX*wallGapX + wallGapZ*wallGapZ);

      let localLinkX = linkGapX*Math.cos(-wallAng) - linkGapZ*Math.sin(-wallAng);
      //var localLinkZ = linkGapX*Math.sin(-wallAng) + linkGapZ*Math.cos(-wallAng);

      const doorHalf = doorlinkEl.components.doorlink.data.width / 2;
      localLinkX = Math.max(localLinkX, doorHalf+HAIR);
      localLinkX = Math.min(localLinkX, wallLength-doorHalf-HAIR);

      doorholeEl.setAttribute('position', { x: localLinkX, y: 0, z: 0 });
      doorholeEl.object3D.updateMatrixWorld();

    }

    function getHoleLink(doorholeEl){
      const doorlinks = buildingSelf.el.querySelectorAll('[doorlink]');
      for (let curLinkIndex=0; curLinkIndex<doorlinks.length; curLinkIndex++){
        const curLink = doorlinks[curLinkIndex];
        if (curLink.components.doorlink.data.from == doorholeEl) { return curLink; }
        if (curLink.components.doorlink.data.to == doorholeEl) { return curLink; }
      }
    }

    function getWallHeight(wallEl){
      if (wallEl.components.wall.data.height) { return wallEl.components.wall.data.height; }
      return wallEl.parentNode.components.room.data.height;
    }

    if (buildingSelf.dirty) { return; }
    buildingSelf.dirty = true;
    setTimeout(() => {

      //console.log(" == STARTING RE-EVALUATION...");

      // silly but necessary because of threeJS weirdness
      buildingSelf.el.object3D.updateMatrixWorld();

      // lay out walls' angles:

      for (var sceneChildNodeIndex=0; sceneChildNodeIndex<buildingSelf.el.children.length; sceneChildNodeIndex++){
        var sceneChildNode = buildingSelf.el.children[sceneChildNodeIndex];
        if (sceneChildNode.components && sceneChildNode.components.room) {

          const w = sceneChildNode.components.room.data.width;
          const l = sceneChildNode.components.room.data.length;
          if (w || l) {
            if (w && l) {
              const rawWalls = getUnsortedRoomWallArray(sceneChildNode);
              if (rawWalls.length >= 4) {
                if (rawWalls.length > 4) { console.error('rooms with WIDTH and LENGTH should only have four walls!'); }
                rawWalls[0].setAttribute('position', { x: 0, y: 0, z: 0 });
                rawWalls[1].setAttribute('position', { x: w, y: 0, z: 0 });
                rawWalls[2].setAttribute('position', { x: w, y: 0, z: l });
                rawWalls[3].setAttribute('position', { x: 0, y: 0, z: l });
              } else {
                console.error('rooms with WIDTH and LENGTH must have four walls!');
              }
            } else {
              console.error('rooms with WIDTH must also have LENGTH (and vice versa)');
            }
          }

          var walls=getRoomWallArray(sceneChildNode);
          if (walls.length > 2) {

            for (var wallIndex=0; wallIndex<walls.length; wallIndex++){
              var curWallNode = walls[wallIndex];
              var nextWallNode = walls[(wallIndex+1)%walls.length];

              var wallGapX = nextWallNode.components.position.data.x - curWallNode.components.position.data.x;
              var wallGapZ = nextWallNode.components.position.data.z - curWallNode.components.position.data.z;
              var wallAng = Math.atan2(wallGapZ, wallGapX);

              curWallNode.setAttribute('rotation', { x: 0, y: -wallAng/Math.PI*180, z: 0 });
              curWallNode.object3D.updateMatrixWorld();
            }

          }

        }
      }

      // position the door holes:

      const doorlinks = buildingSelf.el.querySelectorAll('[doorlink]');
      for (var curDoorlinkElIndex=0; curDoorlinkElIndex<doorlinks.length; curDoorlinkElIndex++){
        var curDoorlinkEl = doorlinks[curDoorlinkElIndex];
        var curDoorlink = curDoorlinkEl.components.doorlink;
        if (!curDoorlink) { return; }//still setting up, try again later

        moveForLink(curDoorlink.data.from, curDoorlink.el);
        moveForLink(curDoorlink.data.to, curDoorlink.el);

      }

      // generate the walls' geometry:

      for (var sceneChildNodeIndex=0; sceneChildNodeIndex<buildingSelf.el.children.length; sceneChildNodeIndex++){
        var sceneChildNode = buildingSelf.el.children[sceneChildNodeIndex];
        if (sceneChildNode.components && sceneChildNode.components.room) {

          const isOutside = sceneChildNode.components.room.data.outside;
          var walls=getRoomWallArray(sceneChildNode);

          if (walls.length > 2) {

            for (var wallIndex=0; wallIndex<walls.length; wallIndex++){
              var curWallNode = walls[wallIndex];
              var nextWallNode = walls[(wallIndex+1)%walls.length];

              var wallGapX = nextWallNode.components.position.data.x - curWallNode.components.position.data.x;
              var wallGapZ = nextWallNode.components.position.data.z - curWallNode.components.position.data.z;
              const wallLength = Math.sqrt(wallGapX*wallGapX + wallGapZ*wallGapZ);
              var wallAng = Math.atan2(wallGapZ, wallGapX);

              const wallGapY = nextWallNode.components.position.data.y - curWallNode.components.position.data.y;
              const heightGap = getWallHeight(nextWallNode) - getWallHeight(curWallNode);

              const orderedHoles=[];
              for (let wallChildNodeIndex=0; wallChildNodeIndex<curWallNode.children.length; wallChildNodeIndex++){
                const wallChildNode = curWallNode.children[wallChildNodeIndex];
                if (wallChildNode.components && wallChildNode.components.doorhole) {
                  orderedHoles.push(wallChildNode);
                }
              }
              orderedHoles.sort((a, b) => {
                return a.components.position.data.x - b.components.position.data.x;
              });

              const wallShape = new THREE.Shape();
              wallShape.moveTo(
                0,
                getWallHeight(curWallNode)
              );
              wallShape.lineTo(
                0,
                0
              );

              for (let holeIndex=0; holeIndex<orderedHoles.length; holeIndex++){

                var holeEl = orderedHoles[holeIndex];
                if (!holeEl.myVerts) { holeEl.myVerts = []; }
                holeEl.myVerts.length=0;

                const linkEl = getHoleLink(orderedHoles[holeIndex]);
                if (!linkEl) { continue; }

                const holeInfo = holeEl.components;
                const linkInfo = linkEl.components;

                for (let holeSide=-1; holeSide<=1; holeSide+=2){
                  var ptX = holeInfo.position.data.x + linkInfo.doorlink.data.width/2*holeSide;
                  const floorY = (ptX/wallLength)*wallGapY;
                  let topY = floorY + linkInfo.doorlink.data.height;

                  const curCeil = getWallHeight(curWallNode) + (ptX/wallLength)*heightGap;
                  const maxTopY = floorY + curCeil - HAIR;//will always be a seam, but, I'm not bothering to rewrite just for that
                  if (topY > maxTopY) { topY = maxTopY; }

                  function addWorldVert(ptY){
                    const tempPos = new THREE.Vector3(ptX, ptY, 0);
                    curWallNode.object3D.localToWorld(tempPos);
                    holeEl.myVerts.push(tempPos);
                  }
                  addWorldVert(floorY);
                  addWorldVert(topY);

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
                nextWallNode.components.position.data.y-curWallNode.components.position.data.y
              );
              wallShape.lineTo(
                wallLength,
                (nextWallNode.components.position.data.y-curWallNode.components.position.data.y)+getWallHeight(nextWallNode)
              );

              const wallGeom = new THREE.ShapeGeometry(wallShape);
              makePlaneUvs(wallGeom, 'x', 'y', 1, 1);
              finishGeom(wallGeom);
              var myMat = curWallNode.components.material ? curWallNode.components.material.material : curWallNode.parentNode.components.material.material;
              if (curWallNode.myMesh) {
                curWallNode.myMesh.geometry = wallGeom;
                curWallNode.myMesh.material = myMat;
              } else {
                curWallNode.myMesh = new THREE.Mesh(wallGeom, myMat);
                curWallNode.setObject3D('wallMesh', curWallNode.myMesh);
              }

            }

            const caps=[];
            for (let roomChildNodeIndex=0; roomChildNodeIndex<sceneChildNode.children.length; roomChildNodeIndex++){
              const roomChildNode = sceneChildNode.children[roomChildNodeIndex];
              if (roomChildNode.components) {
                if (roomChildNode.components.floor || roomChildNode.components.ceiling) { caps.push(roomChildNode); }
              }
            }
            for (let curCapNodeIndex=0; curCapNodeIndex<caps.length; curCapNodeIndex++){
              const curCapNode = caps[curCapNodeIndex];
              const isCeiling = curCapNode.components.ceiling;

              const capShape = new THREE.Shape();
              for (var wallIndex=0; wallIndex<walls.length; wallIndex++){
                var curWallNode = walls[wallIndex];
                var ptX = curWallNode.components.position.data.x;
                const ptZ = curWallNode.components.position.data.z;
                if (wallIndex) {
                  capShape.lineTo(ptX, ptZ);
                } else {
                  capShape.moveTo(ptX, ptZ);
                }
              }
              const capGeom = new THREE.ShapeGeometry(capShape);
              for (var wallIndex=0; wallIndex<walls.length; wallIndex++){
                var curWallNode = walls[wallIndex];
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
              if (shouldReverse) { flipGeom(capGeom); }

              makePlaneUvs(capGeom, 'x', 'z', isCeiling?1:-1, 1);
              finishGeom(capGeom);

              if (!curCapNode.myMeshes) { curCapNode.myMeshes=[]; }

              const typeLabel = isCeiling?'ceiling':'floor';
              var myMat = curCapNode.components.material ? curCapNode.components.material.material : curCapNode.parentNode.components.material.material;
              if (curCapNode.myMeshes[typeLabel]) {
                curCapNode.myMeshes[typeLabel].geometry = capGeom;
                curCapNode.myMeshes[typeLabel].material = myMat;
              } else {
                curCapNode.myMeshes[typeLabel] = new THREE.Mesh(capGeom, myMat);
                curCapNode.setObject3D(typeLabel, curCapNode.myMeshes[typeLabel]);
              }

            }

          }

        }
      }

      // generate the door tunnels' geometry:

      for (var curDoorlinkElIndex=0; curDoorlinkElIndex<doorlinks.length; curDoorlinkElIndex++){
        var curDoorlinkEl = doorlinks[curDoorlinkElIndex];

        var curDoorlink = curDoorlinkEl.components.doorlink;
        if (!curDoorlink.data.from) { continue; }
        if (!curDoorlink.data.to) { continue; }
        if (!curDoorlink.data.from.myVerts) { return; }
        if (!curDoorlink.data.to.myVerts) { return; }

        for (let doorLinkChildIndex=0; doorLinkChildIndex<curDoorlinkEl.children.length; doorLinkChildIndex++){
          var doorLinkChild = curDoorlinkEl.children[doorLinkChildIndex];
          if (!doorLinkChild.components) { continue; }

          const types=['sides', 'floor', 'ceiling'];
          for (let curTypeIndex=0; curTypeIndex<types.length; curTypeIndex++){
            const curType = types[curTypeIndex];

            if (!doorLinkChild.components[curType]) { continue; }

            var myMat = doorLinkChild.components.material?doorLinkChild.components.material.material:doorLinkChild.parentNode.components.material.material;

            if (!doorLinkChild.myGeoms) { doorLinkChild.myGeoms=[]; }
            if (!doorLinkChild.myGeoms[curType]) {
              var curGeom = new THREE.BufferGeometry();
              doorLinkChild.myGeoms[curType] = curGeom;
              const myMesh = new THREE.Mesh(
                curGeom,
                myMat
              );
              curGeom.meshRef = myMesh;
              doorLinkChild.setObject3D(curType, myMesh);
              const indexArray = [];
              indexArray.push( 0, 1, 2, 1, 3, 2 );
              if (curType=='sides') { indexArray.push( 4, 5, 6, 5, 7, 6 ); }
              curGeom.setIndex(indexArray);
            }

            var curGeom = doorLinkChild.myGeoms[curType];
            curGeom.meshRef.material = myMat;
            var positionArray = [];
            function addWorldVertex(pt){
              const localPt = pt.clone();
              doorLinkChild.object3D.worldToLocal(localPt);
              positionArray.push(localPt.x, localPt.y, localPt.z);
            }
            function commitVertices(){
              curGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positionArray), 3));
            }
            const fVerts=curDoorlink.data.from.myVerts;
            const tVerts=curDoorlink.data.to.myVerts;
            switch (curType){
            case 'floor':

              addWorldVertex(tVerts[0]);
              addWorldVertex(tVerts[2]);
              addWorldVertex(fVerts[2]);
              addWorldVertex(fVerts[0]);

              commitVertices();

              makeUvsForGeom(curGeom, (pt, vertIndex) => {
                return [
                  1-(vertIndex%2),
                  1-Math.floor(vertIndex/2)
                ];
              });

              break;
            case 'ceiling':

              addWorldVertex(tVerts[3]);
              addWorldVertex(tVerts[1]);
              addWorldVertex(fVerts[1]);
              addWorldVertex(fVerts[3]);

              commitVertices();

              makeUvsForGeom(curGeom, (pt, vertIndex) => {
                return [
                  vertIndex%2,
                  1-Math.floor(vertIndex/2)
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

              makeUvsForGeom(curGeom, (pt, vertIndex) => {
                const uv = [];
                uv[0] = Math.floor(vertIndex/2);
                uv[1] = vertIndex%2;
                if (vertIndex<4) { uv[0] = 1-uv[0]; }
                return uv;
              });

              break;
            }
            finishGeom(curGeom);

          }
        }

      }

      //console.log(" === RE-EVALUATION COMPLETE!");
      buildingSelf.dirty = false;

    });

  }

});

function updateScene(lastScene){
  if (lastScene && lastScene.systems.building) { lastScene.systems.building.reexamineBuilding(); }
}
function positionWatch(e){
  if (e.detail.name == 'position') { updateScene(e.detail.target.sceneEl); }
}

function nodeSceneInit(){
  this.lastScene = this.el.sceneEl;
  updateScene(this.lastScene);
  this.el.addEventListener('componentchanged', positionWatch);
}
function nodeSceneUpdate(){
  updateScene(this.lastScene);
}
function nodeSceneRemove(){
  updateScene(this.lastScene);
  this.lastScene = null;
  this.el.removeEventListener('componentchanged', positionWatch);
}

const refreshSceneConfig = {
  init: nodeSceneInit,
  update: nodeSceneUpdate,
  remove: nodeSceneRemove
};

AFRAME.registerComponent('room', Object.assign({

  schema: {
    outside: { type: 'boolean' },
    height: { type: 'number', default: 2.4 },
    width: { type: 'number' },
    length: { type: 'number' }
  }

}, refreshSceneConfig));

AFRAME.registerComponent('wall', Object.assign({

  schema: {
    height: { type: 'number' }
  }

}, refreshSceneConfig));

AFRAME.registerComponent('floor', refreshSceneConfig);
AFRAME.registerComponent('ceiling', refreshSceneConfig);

AFRAME.registerComponent('doorhole', refreshSceneConfig);

AFRAME.registerComponent('doorlink', Object.assign({

  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    height: { type: 'number', default: 2.0 },
    width: { type: 'number', default: 0.8 }
  }

}, refreshSceneConfig));

AFRAME.registerComponent('sides', refreshSceneConfig);

// could probably automate this rather than hard-coding it, but this'll do for now:

AFRAME.registerPrimitive('rw-room', {
  defaultComponents: { room: {} },
  mappings: {
    outside: 'room.outside',
    height: 'room.height',
    width: 'room.width',
    length: 'room.length'
  }
});

AFRAME.registerPrimitive('rw-wall', {
  defaultComponents: { wall: {} },
  mappings: {
    height: 'wall.height'
  }
});

AFRAME.registerPrimitive('rw-floor', {
  defaultComponents: { floor: {} },
  mappings: {}
});

AFRAME.registerPrimitive('rw-ceiling', {
  defaultComponents: { ceiling: {} },
  mappings: {}
});

AFRAME.registerPrimitive('rw-doorhole', {
  defaultComponents: { doorhole: {} },
  mappings: {}
});

AFRAME.registerPrimitive('rw-doorlink', {
  defaultComponents: { doorlink: {} },
  mappings: {
    from: 'doorlink.from',
    to: 'doorlink.to',
    height: 'doorlink.height',
    width: 'doorlink.width'
  }
});

AFRAME.registerPrimitive('rw-sides', {
  defaultComponents: { sides: {} },
  mappings: {}
});
