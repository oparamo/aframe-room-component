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
	//#region src/components/collision.js
	var DOWN = new THREE.Vector3(0, -1, 0);
	var FLOOR_SEARCH_HEIGHT = 1.5;
	var MIN_MOVE_SQ = 1e-6;
	var MIN_SLIDE_SQ = 1e-4;
	var TORSO_OFFSET = .6;
	AFRAME.registerComponent("room-collision", {
		schema: { radius: {
			type: "number",
			default: .4
		} },
		init: function() {
			this.wallMeshes = [];
			this.floorMeshes = [];
			this._cameraEl = this.el.querySelector("[camera]") || this.el;
			this._isRig = this._cameraEl !== this.el;
			this._raycaster = new THREE.Raycaster();
			this._floorRaycaster = new THREE.Raycaster();
			this._previousPosition = new THREE.Vector3();
			this._move = new THREE.Vector3();
			this._direction = new THREE.Vector3();
			this._origin = new THREE.Vector3();
			this._cameraPosition = new THREE.Vector3();
			this._slideDirection = new THREE.Vector3();
			this._normal = new THREE.Vector3();
			this._normalMatrix = new THREE.Matrix3();
			this._floorOrigin = new THREE.Vector3();
			this._onLoaded = () => {
				this._previousPosition.copy(this.el.object3D.position);
				this._eyeHeight = this._isRig ? 0 : this._cameraEl.object3D.position.y;
				this._refreshMeshes();
			};
			this._onBuildComplete = () => this._refreshMeshes();
			this.el.sceneEl.addEventListener("loaded", this._onLoaded);
			this.el.sceneEl.addEventListener("room-building-complete", this._onBuildComplete);
		},
		remove: function() {
			this.el.sceneEl.removeEventListener("loaded", this._onLoaded);
			this.el.sceneEl.removeEventListener("room-building-complete", this._onBuildComplete);
		},
		_refreshMeshes: function() {
			this.wallMeshes = [...this.el.sceneEl.querySelectorAll(".collidable")].flatMap((el) => el.mesh ? [el.mesh] : []);
			this.floorMeshes = [...this.el.sceneEl.querySelectorAll(".walkable")].flatMap((el) => el.mesh ? [el.mesh] : []);
		},
		tick: function() {
			const position = this.el.object3D.position;
			this._move.subVectors(position, this._previousPosition);
			if (this._move.lengthSq() < MIN_MOVE_SQ) return;
			this._cameraEl.object3D.getWorldPosition(this._cameraPosition);
			this._origin.set(this._previousPosition.x, this._cameraPosition.y - TORSO_OFFSET, this._previousPosition.z);
			position.copy(this._previousPosition);
			if (!this._tryMove(this._move, position)) {
				this._slideDirection.copy(this._move).projectOnPlane(this._normal);
				if (this._slideDirection.lengthSq() > MIN_SLIDE_SQ) this._tryMove(this._slideDirection, position);
			}
			this._snapToFloor(position);
			this._previousPosition.copy(position);
		},
		_snapToFloor: function(position) {
			this._floorOrigin.set(position.x, position.y + FLOOR_SEARCH_HEIGHT, position.z);
			this._floorRaycaster.set(this._floorOrigin, DOWN);
			const hits = this._floorRaycaster.intersectObjects(this.floorMeshes);
			if (hits.length === 0) return;
			position.y = hits[0].point.y + this._eyeHeight;
		},
		_tryMove: function(moveVector, position) {
			this._raycaster.set(this._origin, this._direction.copy(moveVector).normalize());
			const hits = this._raycaster.intersectObjects(this.wallMeshes);
			if (hits.length > 0 && hits[0].distance < this.data.radius + moveVector.length()) {
				this._normalMatrix.getNormalMatrix(hits[0].object.matrixWorld);
				this._normal.copy(hits[0].face.normal).applyMatrix3(this._normalMatrix).normalize();
				this._normal.y = 0;
				return false;
			}
			position.add(moveVector);
			return true;
		}
	});
	//#endregion
	//#region src/components/doorhole.js
	var WALL$1 = "a-wall";
	AFRAME.registerComponent("doorhole", { init: function() {
		if (this.el.parentEl?.localName !== WALL$1) {
			const message = `<a-doorhole> must be a child of a <${WALL$1}>.`;
			throw new Error(message);
		}
		this.el.vertices = [];
		this.el.getDoorlink = () => {
			for (const dl of this.el.sceneEl.querySelectorAll("a-doorlink")) {
				const data = dl.components?.doorlink?.data;
				if (data?.from === this.el || data?.to === this.el) return dl;
			}
			return null;
		};
	} });
	//#endregion
	//#region src/components/doorlink.js
	var SCENE = "a-scene";
	var WALL = "a-wall";
	var TRANSFORM_PROPS$1 = new Set([
		"position",
		"rotation",
		"scale"
	]);
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
			this._onTransformChanged = (e) => {
				if (TRANSFORM_PROPS$1.has(e.detail.name)) this.el.sceneEl.systems?.building?.buildDoorlink(this.el);
			};
			this.el.addEventListener("componentchanged", this._onTransformChanged);
		},
		update: function() {
			this.el.sceneEl.systems?.building?.buildDoorlink(this.el);
		},
		remove: function() {
			this.el.removeEventListener("componentchanged", this._onTransformChanged);
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
	var TRANSFORM_PROPS = new Set([
		"position",
		"rotation",
		"scale"
	]);
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
			const { length, width } = this.data;
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
			roomEl.object3D.visible = false;
			this._onTransformChanged = (e) => {
				if (TRANSFORM_PROPS.has(e.detail.name)) roomEl.sceneEl.systems?.building?.buildRoom(roomEl);
			};
			roomEl.addEventListener("componentchanged", this._onTransformChanged);
		},
		update: function() {
			this.el.sceneEl.systems?.building?.buildRoom(this.el);
		},
		remove: function() {
			this.el.removeEventListener("componentchanged", this._onTransformChanged);
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
			this.el.doorholes = doorholes.sort((a, b) => a.object3D.position.x - b.object3D.position.x);
			this.el.getHeight = () => this.el.getAttribute("wall").height || this.el.parentEl.getAttribute("room").height;
		}
	});
	//#endregion
	//#region src/primitives/a-ceiling.js
	AFRAME.registerPrimitive("a-ceiling", { defaultComponents: { ceiling: {} } });
	//#endregion
	//#region src/primitives/a-doorhole.js
	AFRAME.registerPrimitive("a-doorhole", { defaultComponents: { doorhole: {} } });
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
	AFRAME.registerPrimitive("a-floor", { defaultComponents: { floor: {} } });
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
	AFRAME.registerPrimitive("a-sides", { defaultComponents: { sides: {} } });
	//#endregion
	//#region src/primitives/a-wall.js
	AFRAME.registerPrimitive("a-wall", {
		defaultComponents: { wall: {} },
		mappings: { height: "wall.height" }
	});
	//#endregion
	//#region src/systems/buildingService.js
	var HAIR = 1e-4;
	var CHILD_TYPES = [
		"sides",
		"floor",
		"ceiling"
	];
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
	var addDoorlinkWorldVertex = (vertex, childEl, positions) => {
		const point = vertex.clone();
		childEl.object3D.worldToLocal(point);
		positions.push(point.x, point.y, point.z);
	};
	var addDoorholeWorldVertex = (wallEl, doorholeEl, ptX, ptY) => {
		const vertex = new THREE.Vector3(ptX, ptY, 0);
		wallEl.object3D.localToWorld(vertex);
		doorholeEl.vertices.push(vertex);
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
		const wallGapY = nextWallWorldPosition.y - wallWorldPosition.y;
		const wallGapZ = nextWallWorldPosition.z - wallWorldPosition.z;
		const wallLength = Math.hypot(wallGapX, wallGapZ);
		const doorlinkHalfWidth = doorlinkEl.getAttribute("doorlink")?.width / 2;
		const wallDir = new THREE.Vector2(wallGapX, wallGapZ).normalize();
		let doorlinkLocalX = new THREE.Vector2(doorlinkGapX, doorlinkGapZ).dot(wallDir);
		doorlinkLocalX = Math.max(doorlinkLocalX, doorlinkHalfWidth + HAIR);
		doorlinkLocalX = Math.min(doorlinkLocalX, wallLength - doorlinkHalfWidth - HAIR);
		const floorY = doorlinkLocalX / wallLength * wallGapY;
		doorholeEl.object3D.position.set(doorlinkLocalX, floorY, 0);
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
		if (cwSum > 0 !== isOutside) walls.reverse();
	};
	var buildCap = (walls, capEl, isCeiling, isOutside) => {
		const shape = new THREE.Shape();
		for (let i = 0; i < walls.length; i++) {
			const wallEl = walls[i];
			const x = wallEl.object3D.position.x;
			const z = wallEl.object3D.position.z;
			if (i) shape.lineTo(x, z);
			else shape.moveTo(x, z);
		}
		const geom = new THREE.ShapeGeometry(shape);
		for (let i = 0; i < walls.length; i++) {
			const wallEl = walls[i];
			const vertex = new THREE.Vector3(geom.attributes.position.getX(i), geom.attributes.position.getY(i), geom.attributes.position.getZ(i));
			vertex.set(vertex.x, wallEl.object3D.position.y, vertex.y);
			if (isCeiling) vertex.y += wallEl.getHeight();
			geom.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z);
		}
		if (isCeiling === isOutside) flipGeometry(geom);
		makePlaneUvs(geom, "x", "z", isCeiling ? 1 : -1, 1);
		finishGeometry(geom);
		const material = capEl.components?.material?.material || capEl.parentEl?.components?.material?.material;
		if (capEl.mesh) {
			capEl.mesh.geometry = geom;
			capEl.mesh.material = material;
		} else {
			const type = isCeiling ? "ceiling" : "floor";
			capEl.mesh = new THREE.Mesh(geom, material);
			capEl.setObject3D(type, capEl.mesh);
		}
	};
	var buildRoom = (roomEl) => {
		const { outside, length, width } = roomEl.getAttribute("room");
		const walls = roomEl.walls;
		const roomId = roomEl.id ? `#${roomEl.id}` : "<a-room>";
		if (!walls || walls.length < 3) {
			console.error(`${roomId}: a room needs at least 3 walls (found ${walls?.length ?? 0}).`);
			return;
		}
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
			const wallLength = Math.hypot(wallGapX, wallGapZ);
			wallEl.object3D.rotation.y = -wallAngle;
			const wallShape = new THREE.Shape();
			wallShape.moveTo(0, wallEl.getHeight());
			wallShape.lineTo(0, 0);
			for (const doorholeEl of wallEl.doorholes) {
				positionDoorhole(doorholeEl);
				doorholeEl.vertices = [];
				const doorlinkEl = doorholeEl.getDoorlink();
				if (!doorlinkEl) continue;
				const { width: doorlinkWidth, height: doorlinkHeight } = doorlinkEl.getAttribute("doorlink");
				for (let side = -1; side <= 1; side += 2) {
					const ptX = doorholeEl.object3D.position.x + doorlinkWidth / 2 * side;
					const floorY = ptX / wallLength * wallGapY;
					let topY = floorY + doorlinkHeight;
					const maxTopY = floorY + (wallEl.getHeight() + ptX / wallLength * heightGap) - HAIR;
					if (topY > maxTopY) topY = maxTopY;
					addDoorholeWorldVertex(wallEl, doorholeEl, ptX, floorY);
					addDoorholeWorldVertex(wallEl, doorholeEl, ptX, topY);
					if (side < 0) {
						wallShape.lineTo(ptX, floorY);
						wallShape.lineTo(ptX, topY);
					} else {
						wallShape.lineTo(ptX, topY);
						wallShape.lineTo(ptX, floorY);
					}
				}
			}
			wallShape.lineTo(wallLength, wallGapY);
			wallShape.lineTo(wallLength, wallGapY + nextWallEl.getHeight());
			const wallGeom = new THREE.ShapeGeometry(wallShape);
			makePlaneUvs(wallGeom, "x", "y", 1, 1);
			finishGeometry(wallGeom);
			const material = wallEl.components?.material?.material || wallEl.parentEl?.components?.material?.material;
			if (wallEl.mesh) {
				wallEl.mesh.geometry = wallGeom;
				wallEl.mesh.material = material;
			} else {
				wallEl.mesh = new THREE.Mesh(wallGeom, material);
				wallEl.setObject3D("wallMesh", wallEl.mesh);
			}
			wallEl.classList.add("collidable");
		}
		if (roomEl.floor) {
			buildCap(walls, roomEl.floor, false, outside);
			roomEl.floor.classList.add("walkable");
		}
		if (roomEl.ceiling) buildCap(walls, roomEl.ceiling, true, outside);
	};
	var buildDoorlink = (doorlinkEl) => {
		const { from: fromEl, to: toEl } = doorlinkEl.getAttribute("doorlink");
		const doorlinkId = doorlinkEl.id ? `#${doorlinkEl.id}` : "<a-doorlink>";
		const fromVerts = fromEl?.vertices;
		const toVerts = toEl?.vertices;
		if (!fromVerts?.length || !toVerts?.length) {
			console.error(`${doorlinkId}: doorhole vertices not found — ensure both doorholes exist and their rooms have been built.`);
			return;
		}
		for (const childEl of doorlinkEl.children) {
			const type = CHILD_TYPES.find((t) => childEl.components[t]);
			if (!type) continue;
			const material = childEl.components?.material?.material || childEl.parentEl?.components?.material?.material;
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
			childEl.mesh = new THREE.Mesh(geom, material);
			childEl.setObject3D(type, childEl.mesh);
			const positions = [];
			let uvCallback;
			switch (type) {
				case "floor":
					addDoorlinkWorldVertex(toVerts[0], childEl, positions);
					addDoorlinkWorldVertex(toVerts[2], childEl, positions);
					addDoorlinkWorldVertex(fromVerts[2], childEl, positions);
					addDoorlinkWorldVertex(fromVerts[0], childEl, positions);
					uvCallback = (point, vertIndex) => [1 - vertIndex % 2, 1 - Math.floor(vertIndex / 2)];
					break;
				case "ceiling":
					addDoorlinkWorldVertex(toVerts[3], childEl, positions);
					addDoorlinkWorldVertex(toVerts[1], childEl, positions);
					addDoorlinkWorldVertex(fromVerts[1], childEl, positions);
					addDoorlinkWorldVertex(fromVerts[3], childEl, positions);
					uvCallback = (point, vertIndex) => [vertIndex % 2, 1 - Math.floor(vertIndex / 2)];
					break;
				case "sides":
					addDoorlinkWorldVertex(toVerts[2], childEl, positions);
					addDoorlinkWorldVertex(toVerts[3], childEl, positions);
					addDoorlinkWorldVertex(fromVerts[0], childEl, positions);
					addDoorlinkWorldVertex(fromVerts[1], childEl, positions);
					addDoorlinkWorldVertex(fromVerts[2], childEl, positions);
					addDoorlinkWorldVertex(fromVerts[3], childEl, positions);
					addDoorlinkWorldVertex(toVerts[0], childEl, positions);
					addDoorlinkWorldVertex(toVerts[1], childEl, positions);
					uvCallback = (point, vertIndex) => {
						const uv = [];
						uv[0] = Math.floor(vertIndex / 2);
						uv[1] = vertIndex % 2;
						if (vertIndex < 4) uv[0] = 1 - uv[0];
						return uv;
					};
					break;
			}
			geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
			makeGeometryUvs(geom, uvCallback);
			finishGeometry(geom);
			if (type === "sides") childEl.classList.add("collidable");
			else if (type === "floor") childEl.classList.add("walkable");
		}
	};
	//#endregion
	//#region src/systems/building.js
	AFRAME.registerSystem("building", {
		init: function() {
			this.buildPending = false;
			this.dirtyDoorlinks = /* @__PURE__ */ new Set();
			this.dirtyRooms = /* @__PURE__ */ new Set();
		},
		buildRoom: function(roomEl) {
			this.dirtyRooms.add(roomEl);
			for (const wall of roomEl.walls || []) for (const doorhole of wall.doorholes || []) {
				const dl = doorhole.getDoorlink();
				if (dl) this.dirtyDoorlinks.add(dl);
			}
			this.requestBuild();
		},
		buildDoorlink: function(doorlinkEl) {
			const { from, to } = doorlinkEl.components?.doorlink?.data || {};
			const roomA = from?.parentEl?.parentEl;
			const roomB = to?.parentEl?.parentEl;
			if (roomA) this.dirtyRooms.add(roomA);
			if (roomB) this.dirtyRooms.add(roomB);
			this.dirtyDoorlinks.add(doorlinkEl);
			this.requestBuild();
		},
		requestBuild: function() {
			if (this.buildPending) return;
			this.buildPending = true;
			requestAnimationFrame(() => {
				this.buildPending = false;
				for (const roomEl of this.dirtyRooms) {
					buildRoom(roomEl);
					roomEl.object3D.visible = true;
				}
				for (const doorlinkEl of this.dirtyDoorlinks) buildDoorlink(doorlinkEl);
				this.dirtyRooms.clear();
				this.dirtyDoorlinks.clear();
				this.el.emit("room-building-complete");
			});
		}
	});
	//#endregion
});

//# sourceMappingURL=aframe-room-component.js.map