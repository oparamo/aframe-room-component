(function(factory) {
	typeof define === "function" && define.amd ? define([], factory) : factory();
})(function() {
	//#region src/components/ceiling.js
	var DOORLINK$2 = "a-doorlink";
	var ROOM$2 = "a-room";
	AFRAME.registerComponent("ceiling", { init: function() {
		const parentName = this.el.parentEl?.localName;
		if (parentName !== DOORLINK$2 && parentName !== ROOM$2) {
			const message = `<a-ceiling> must be a child of a <${DOORLINK$2}> or <${ROOM$2}>.`;
			throw new Error(message);
		}
	} });
	//#endregion
	//#region src/components/doorhole.js
	var WALL$1 = "a-wall";
	AFRAME.registerComponent("doorhole", { init: function() {
		if (this.el.parentEl?.localName !== WALL$1) {
			const message = `<a-doorhole> must be a child of a <${WALL$1}>.`;
			throw new Error(message);
		}
		this.el.vertices = [];
		this.el.getDoorlink = () => this.el.sceneEl.querySelector(`a-doorlink[from="#${this.el.id}"], a-doorlink[to="#${this.el.id}"]`);
	} });
	//#endregion
	//#region src/components/doorlink.js
	var SCENE = "a-scene";
	var WALL = "a-wall";
	AFRAME.registerComponent("doorlink", {
		schema: {
			from: { type: "selector" },
			to: { type: "selector" },
			height: {
				type: "number",
				default: 2
			},
			width: {
				type: "number",
				default: .8
			}
		},
		init: function() {
			const parentName = this.el.parentEl?.localName;
			if (parentName !== SCENE && parentName !== WALL) {
				const message = `<a-doorlink> must be a child of a <${SCENE}> or <${WALL}>.`;
				throw new Error(message);
			}
		},
		update: function() {
			this.el.sceneEl.systems?.building?.buildDoorlink(this.el);
		}
	});
	//#endregion
	//#region src/components/floor.js
	var DOORLINK$1 = "a-doorlink";
	var ROOM$1 = "a-room";
	AFRAME.registerComponent("floor", { init: function() {
		const parentName = this.el.parentEl?.localName;
		if (parentName !== DOORLINK$1 && parentName !== ROOM$1) {
			const message = `<a-floor> must be a child of a <${DOORLINK$1}> or <${ROOM$1}>.`;
			throw new Error(message);
		}
	} });
	//#endregion
	//#region src/components/room.js
	AFRAME.registerComponent("room", {
		schema: {
			outside: { type: "boolean" },
			height: {
				type: "number",
				default: 2.4
			},
			width: { type: "number" },
			length: { type: "number" }
		},
		init: function() {
			const roomEl = this.el;
			const { length, width } = roomEl?.getAttribute("room");
			const walls = Array.from(roomEl.querySelectorAll("a-wall"));
			if ((width || length) && !(width && length)) {
				const message = "<a-room> with WIDTH must also have LENGTH (and vice versa).";
				console.error(message);
				throw new Error(message);
			}
			if (width && length && walls.length !== 4) {
				const message = "<a-room> with WIDTH and LENGTH must have four walls.";
				console.error(message);
				throw new Error(message);
			}
			roomEl.ceiling = roomEl.querySelector("a-ceiling");
			roomEl.floor = roomEl.querySelector("a-floor");
			roomEl.walls = walls;
		},
		update: function() {
			this.el.sceneEl.systems?.building?.buildRoom(this.el);
		}
	});
	//#endregion
	//#region src/components/sides.js
	var DOORLINK = "a-doorlink";
	AFRAME.registerComponent("sides", { init: function() {
		if (this.el.parentEl?.localName !== DOORLINK) {
			const message = `<a-sides> must be a child of a <${DOORLINK}>.`;
			throw new Error(message);
		}
	} });
	//#endregion
	//#region src/components/wall.js
	var ROOM = "a-room";
	AFRAME.registerComponent("wall", {
		schema: { height: { type: "number" } },
		init: function() {
			if (this.el.parentEl?.localName !== ROOM) {
				const message = `<a-wall> must be a child of a <${ROOM}>`;
				throw new Error(message);
			}
			const doorholes = Array.from(this.el.querySelectorAll("a-doorhole"));
			this.el.doorholes = doorholes.sort((a, b) => a?.object3D?.position?.x - b?.object3D?.position?.x);
			this.el.getHeight = () => this.el.getAttribute("wall")?.height || this.el.parentEl?.getAttribute("room")?.height;
		}
	});
	//#endregion
	//#region src/primitives/a-ceiling.js
	AFRAME.registerPrimitive("a-ceiling", {
		defaultComponents: { ceiling: {} },
		mappings: {}
	});
	//#endregion
	//#region src/primitives/a-doorhole.js
	AFRAME.registerPrimitive("a-doorhole", {
		defaultComponents: { doorhole: {} },
		mappings: {}
	});
	//#endregion
	//#region src/primitives/a-doorlink.js
	AFRAME.registerPrimitive("a-doorlink", {
		defaultComponents: { doorlink: {} },
		mappings: {
			from: "doorlink.from",
			to: "doorlink.to",
			height: "doorlink.height",
			width: "doorlink.width"
		}
	});
	//#endregion
	//#region src/primitives/a-floor.js
	AFRAME.registerPrimitive("a-floor", {
		defaultComponents: { floor: {} },
		mappings: {}
	});
	//#endregion
	//#region src/primitives/a-room.js
	AFRAME.registerPrimitive("a-room", {
		defaultComponents: { room: {} },
		mappings: {
			outside: "room.outside",
			height: "room.height",
			width: "room.width",
			length: "room.length"
		}
	});
	//#endregion
	//#region src/primitives/a-sides.js
	AFRAME.registerPrimitive("a-sides", {
		defaultComponents: { sides: {} },
		mappings: {}
	});
	//#endregion
	//#region src/primitives/a-wall.js
	AFRAME.registerPrimitive("a-wall", {
		defaultComponents: { wall: {} },
		mappings: { height: "wall.height" }
	});
	//#endregion
	//#region src/systems/buildingService.js
	var HAIR = 1e-4;
	var flipGeometry = (geom) => {
		const indices = geom.getIndex().array;
		for (let i = 0; i < indices.length; i += 3) {
			const tempIndex = indices[i + 2];
			indices[i + 2] = indices[i + 1];
			indices[i + 1] = tempIndex;
		}
		geom.getIndex().needsUpdate = true;
	};
	var makeGeometryUvs = (geom, callback) => {
		const indices = geom.getIndex().array;
		const uvs = [];
		for (const vertexIndex of indices) {
			const [u, v] = callback(new THREE.Vector3(geom.attributes.position.getX(vertexIndex), geom.attributes.position.getY(vertexIndex), geom.attributes.position.getZ(vertexIndex)), vertexIndex % 3);
			uvs[vertexIndex * 2 + 0] = u;
			uvs[vertexIndex * 2 + 1] = v;
		}
		geom.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
	};
	var makePlaneUvs = (geom, uKey, vKey, uMult, vMult) => {
		const callback = (point) => [point[uKey] * uMult, point[vKey] * vMult];
		makeGeometryUvs(geom, callback);
	};
	var finishGeometry = (geom) => {
		geom.computeVertexNormals();
	};
	var addDoorlinkWorldVertex = (vertex, doorlinkChildEl, positions) => {
		const point = vertex.clone();
		doorlinkChildEl.object3D.worldToLocal(point);
		positions.push(point.x, point.y, point.z);
	};
	var addDoorholeWorldVertex = (wall, doorhole, ptX, ptY) => {
		const vertex = new THREE.Vector3(ptX, ptY, 0);
		wall.object3D.localToWorld(vertex);
		doorhole.vertices.push(vertex);
	};
	var positionDoorhole = (doorholeEl) => {
		const doorlinkEl = doorholeEl.getDoorlink();
		const wallEl = doorholeEl.parentEl;
		const nextWallEl = wallEl?.nextWallEl;
		if (!doorlinkEl || !nextWallEl) return;
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
		const doorHalf = doorlinkEl.getAttribute("doorlink")?.width / 2;
		let localLinkX = doorlinkGapX * Math.cos(-wallAngle) - doorlinkGapZ * Math.sin(-wallAngle);
		localLinkX = Math.max(localLinkX, doorHalf + HAIR);
		localLinkX = Math.min(localLinkX, wallLength - doorHalf - HAIR);
		doorholeEl.object3D.position.set(localLinkX, 0, 0);
	};
	var sortWalls = (walls, isOutside) => {
		let cwSum = 0;
		for (let i = 0; i < walls.length; i++) {
			const wallEl = walls[i];
			const nextWallEl = walls[(i + 1) % walls.length];
			const { x: wallX, z: wallZ } = wallEl.object3D.position;
			const { x: nextWallX, z: nextWallZ } = nextWallEl.object3D.position;
			cwSum += (nextWallX - wallX) * (nextWallZ + wallZ);
		}
		let shouldReverse = false;
		if (cwSum > 0) shouldReverse = !shouldReverse;
		if (isOutside) shouldReverse = !shouldReverse;
		if (shouldReverse) walls.reverse();
	};
	var buildCap = (walls, cap, isCeiling, isOutside) => {
		const shape = new THREE.Shape();
		for (let i = 0; i < walls.length; i++) {
			const wallEl = walls[i];
			const ptX = wallEl.object3D.position.x;
			const ptZ = wallEl.object3D.position.z;
			if (i) shape.lineTo(ptX, ptZ);
			else shape.moveTo(ptX, ptZ);
		}
		const geom = new THREE.ShapeGeometry(shape);
		for (let i = 0; i < walls.length; i++) {
			const wallEl = walls[i];
			const vertex = new THREE.Vector3(geom.attributes.position.getX(i), geom.attributes.position.getY(i), geom.attributes.position.getZ(i));
			vertex.set(vertex.x, wallEl.object3D.position.y, vertex.y);
			if (isCeiling) vertex.y += wallEl.getHeight();
			geom.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z);
		}
		let shouldReverse = false;
		if (!isCeiling) shouldReverse = !shouldReverse;
		if (isOutside) shouldReverse = !shouldReverse;
		if (shouldReverse) flipGeometry(geom);
		makePlaneUvs(geom, "x", "z", isCeiling ? 1 : -1, 1);
		finishGeometry(geom);
		const material = cap?.components?.material?.material || cap?.parentEl?.components?.material?.material;
		if (cap.mesh) {
			cap.mesh.geometry = geom;
			cap.mesh.material = material;
		} else {
			const typeLabel = isCeiling ? "ceiling" : "floor";
			cap.mesh = new THREE.Mesh(geom, material);
			cap.setObject3D(typeLabel, cap.mesh);
		}
	};
	var buildRoom = (roomEl) => {
		const { outside, length, width } = roomEl?.getAttribute("room");
		const walls = roomEl?.walls;
		if (width && length) {
			walls[0].object3D.position.set(0, 0, 0);
			walls[1].object3D.position.set(width, 0, 0);
			walls[2].object3D.position.set(width, 0, length);
			walls[3].object3D.position.set(0, 0, length);
		}
		sortWalls(walls, outside);
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
			for (const doorholeEl of wallEl.doorholes) {
				positionDoorhole(doorholeEl);
				const doorlinkEl = doorholeEl.getDoorlink();
				if (!doorlinkEl) continue;
				for (let holeSide = -1; holeSide <= 1; holeSide += 2) {
					const ptX = doorholeEl.object3D.position.x + doorlinkEl.getAttribute("doorlink").width / 2 * holeSide;
					const floorY = ptX / wallLength * wallGapY;
					let topY = floorY + doorlinkEl.getAttribute("doorlink").height;
					const maxTopY = floorY + (wallEl.getHeight() + ptX / wallLength * heightGap) - HAIR;
					if (topY > maxTopY) topY = maxTopY;
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
			wallShape.lineTo(wallLength, nextWallEl?.object3D?.position?.y - wallEl?.object3D?.position?.y);
			wallShape.lineTo(wallLength, nextWallEl?.object3D?.position?.y - wallEl?.object3D?.position?.y + nextWallEl.getHeight());
			const wallGeom = new THREE.ShapeGeometry(wallShape);
			makePlaneUvs(wallGeom, "x", "y", 1, 1);
			finishGeometry(wallGeom);
			const material = wallEl?.components?.material?.material || wallEl?.parentEl?.components?.material?.material;
			if (wallEl.mesh) {
				wallEl.mesh.geometry = wallGeom;
				wallEl.mesh.material = material;
			} else {
				wallEl.mesh = new THREE.Mesh(wallGeom, material);
				wallEl.setObject3D("wallMesh", wallEl.mesh);
			}
		}
		buildCap(walls, roomEl?.floor, false, outside);
		buildCap(walls, roomEl?.ceiling, true, outside);
	};
	var buildDoorlink = (doorlinkEl) => {
		const { from, to } = doorlinkEl.getAttribute("doorlink");
		const fromVerts = from?.vertices;
		const toVerts = to?.vertices;
		if (!fromVerts || !toVerts) return;
		for (const doorlinkChildEl of doorlinkEl.children) for (const type of [
			"sides",
			"floor",
			"ceiling"
		]) {
			if (!doorlinkChildEl.components[type]) continue;
			const material = doorlinkChildEl?.components?.material?.material || doorlinkChildEl?.parentEl?.components?.material?.material;
			const indices = type === "sides" ? [
				0,
				1,
				2,
				1,
				3,
				2,
				4,
				5,
				6,
				5,
				7,
				6
			] : [
				0,
				1,
				2,
				1,
				3,
				2
			];
			const geom = new THREE.BufferGeometry();
			geom.setIndex(indices);
			doorlinkChildEl.mesh = new THREE.Mesh(geom, material);
			doorlinkChildEl.setObject3D(type, doorlinkChildEl.mesh);
			const positions = [];
			switch (type) {
				case "floor":
					addDoorlinkWorldVertex(toVerts[0], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(toVerts[2], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(fromVerts[2], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(fromVerts[0], doorlinkChildEl, positions);
					geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
					makeGeometryUvs(geom, (point, vertIndex) => [1 - vertIndex % 2, 1 - Math.floor(vertIndex / 2)]);
					break;
				case "ceiling":
					addDoorlinkWorldVertex(toVerts[3], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(toVerts[1], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(fromVerts[1], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(fromVerts[3], doorlinkChildEl, positions);
					geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
					makeGeometryUvs(geom, (point, vertIndex) => [vertIndex % 2, 1 - Math.floor(vertIndex / 2)]);
					break;
				case "sides":
					addDoorlinkWorldVertex(toVerts[2], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(toVerts[3], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(fromVerts[0], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(fromVerts[1], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(fromVerts[2], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(fromVerts[3], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(toVerts[0], doorlinkChildEl, positions);
					addDoorlinkWorldVertex(toVerts[1], doorlinkChildEl, positions);
					geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
					makeGeometryUvs(geom, (point, vertIndex) => {
						const uv = [];
						uv[0] = Math.floor(vertIndex / 2);
						uv[1] = vertIndex % 2;
						if (vertIndex < 4) uv[0] = 1 - uv[0];
						return uv;
					});
					break;
			}
			finishGeometry(geom);
		}
	};
	//#endregion
	//#region src/systems/building.js
	AFRAME.registerSystem("building", {
		init: function() {
			this.el.addEventListener("loaded", this.initialBuild);
			this.el.updateReady = false;
		},
		initialBuild: function() {
			const doorlinks = this.querySelectorAll("a-doorlink");
			const rooms = this.querySelectorAll("a-room");
			this.object3D.updateMatrixWorld();
			for (const roomEl of rooms) buildRoom(roomEl);
			for (const doorlinkEl of doorlinks) buildDoorlink(doorlinkEl);
			this.updateReady = true;
		},
		buildRoom: function(roomEl) {
			if (this.el.updateReady) buildRoom(roomEl);
		},
		buildDoorlink: function(doorlinkEl) {
			if (this.el.updateReady) buildDoorlink(doorlinkEl);
		}
	});
	//#endregion
});

//# sourceMappingURL=aframe-room-component.js.map