(function(factory) {
	typeof define === "function" && define.amd ? define([], factory) : factory();
})(function() {
	//#region src/components/ceiling.js
	var PORTAL$2 = "a-portal";
	var ROOM$2 = "a-room";
	AFRAME.registerComponent("ceiling", {
		schema: { uvScale: {
			type: "number",
			default: 1
		} },
		init: function() {
			const parentName = this.el.parentEl?.localName;
			if (parentName !== PORTAL$2 && parentName !== ROOM$2) {
				const message = `<a-ceiling> must be a child of a <${PORTAL$2}> or <${ROOM$2}>.`;
				throw new Error(message);
			}
		}
	});
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
	//#region src/components/floor.js
	var PORTAL$1 = "a-portal";
	var ROOM$1 = "a-room";
	AFRAME.registerComponent("floor", {
		schema: { uvScale: {
			type: "number",
			default: 1
		} },
		init: function() {
			const parentName = this.el.parentEl?.localName;
			if (parentName !== PORTAL$1 && parentName !== ROOM$1) {
				const message = `<a-floor> must be a child of a <${PORTAL$1}> or <${ROOM$1}>.`;
				throw new Error(message);
			}
		}
	});
	//#endregion
	//#region src/components/opening.js
	var WALL$1 = "a-wall";
	AFRAME.registerComponent("opening", { init: function() {
		if (this.el.parentEl?.localName !== WALL$1) {
			const message = `<a-opening> must be a child of a <${WALL$1}>.`;
			throw new Error(message);
		}
		this.el.vertices = [];
		this.el.getPortal = () => {
			for (const dl of this.el.sceneEl.querySelectorAll("a-portal")) {
				const data = dl.components?.portal?.data;
				if (data?.from === this.el || data?.to === this.el) return dl;
			}
			return null;
		};
	} });
	//#endregion
	//#region src/components/portal.js
	var SCENE = "a-scene";
	var WALL = "a-wall";
	var TRANSFORM_PROPS$1 = new Set([
		"position",
		"rotation",
		"scale"
	]);
	AFRAME.registerComponent("portal", {
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
			},
			floorHeight: {
				type: "number",
				default: 0
			}
		},
		init: function() {
			const parentName = this.el.parentEl?.localName;
			if (parentName !== SCENE && parentName !== WALL) {
				const message = `<a-portal> must be a child of a <${SCENE}> or <${WALL}>.`;
				throw new Error(message);
			}
			this._onTransformChanged = (e) => {
				if (TRANSFORM_PROPS$1.has(e.detail.name)) this.el.sceneEl.systems?.building?.buildPortal(this.el);
			};
			this.el.addEventListener("componentchanged", this._onTransformChanged);
		},
		update: function() {
			this.el.sceneEl.systems?.building?.buildPortal(this.el);
		},
		remove: function() {
			this.el.removeEventListener("componentchanged", this._onTransformChanged);
		}
	});
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
	var PORTAL = "a-portal";
	AFRAME.registerComponent("sides", {
		schema: { uvScale: {
			type: "number",
			default: 1
		} },
		init: function() {
			if (this.el.parentEl?.localName !== PORTAL) {
				const message = `<a-sides> must be a child of a <${PORTAL}>.`;
				throw new Error(message);
			}
		}
	});
	//#endregion
	//#region src/components/wall.js
	var ROOM = "a-room";
	AFRAME.registerComponent("wall", {
		schema: {
			height: { type: "number" },
			uvScale: {
				type: "number",
				default: 1
			}
		},
		init: function() {
			if (this.el.parentEl?.localName !== ROOM) {
				const message = `<a-wall> must be a child of a <${ROOM}>`;
				throw new Error(message);
			}
			const openings = Array.from(this.el.querySelectorAll("a-opening"));
			this.el.openings = openings.sort((a, b) => a.object3D.position.x - b.object3D.position.x);
			this.el.getHeight = () => this.el.getAttribute("wall").height || this.el.parentEl.getAttribute("room").height;
		}
	});
	//#endregion
	//#region src/primitives/a-ceiling.js
	AFRAME.registerPrimitive("a-ceiling", {
		defaultComponents: { ceiling: {} },
		mappings: { "uv-scale": "ceiling.uvScale" }
	});
	//#endregion
	//#region src/primitives/a-floor.js
	AFRAME.registerPrimitive("a-floor", {
		defaultComponents: { floor: {} },
		mappings: { "uv-scale": "floor.uvScale" }
	});
	//#endregion
	//#region src/primitives/a-opening.js
	AFRAME.registerPrimitive("a-opening", { defaultComponents: { opening: {} } });
	//#endregion
	//#region src/primitives/a-portal.js
	AFRAME.registerPrimitive("a-portal", {
		defaultComponents: { portal: {} },
		mappings: {
			from: "portal.from",
			to: "portal.to",
			height: "portal.height",
			width: "portal.width",
			"floor-height": "portal.floorHeight"
		}
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
		mappings: { "uv-scale": "sides.uvScale" }
	});
	//#endregion
	//#region src/primitives/a-wall.js
	AFRAME.registerPrimitive("a-wall", {
		defaultComponents: { wall: {} },
		mappings: {
			height: "wall.height",
			"uv-scale": "wall.uvScale"
		}
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
	var addPortalWorldVertex = (vertex, childEl, positions) => {
		const point = vertex.clone();
		childEl.object3D.worldToLocal(point);
		positions.push(point.x, point.y, point.z);
	};
	var addOpeningWorldVertex = (wallEl, openingEl, ptX, ptY) => {
		const vertex = new THREE.Vector3(ptX, ptY, 0);
		wallEl.object3D.localToWorld(vertex);
		openingEl.vertices.push(vertex);
	};
	var positionOpening = (openingEl) => {
		const portalEl = openingEl.getPortal();
		const wallEl = openingEl.parentEl;
		const nextWallEl = wallEl?.nextWallEl;
		if (!portalEl || !nextWallEl) return;
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
		const portalHalfWidth = portalEl.getAttribute("portal")?.width / 2;
		const wallDir = new THREE.Vector2(wallGapX, wallGapZ).normalize();
		let portalLocalX = new THREE.Vector2(portalGapX, portalGapZ).dot(wallDir);
		portalLocalX = Math.max(portalLocalX, portalHalfWidth + HAIR);
		portalLocalX = Math.min(portalLocalX, wallLength - portalHalfWidth - HAIR);
		const floorY = portalLocalX / wallLength * wallGapY;
		openingEl.object3D.position.set(portalLocalX, floorY, 0);
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
		const n = walls.length;
		const positions = [];
		for (const wallEl of walls) positions.push(wallEl.object3D.position.x, wallEl.object3D.position.y + (isCeiling ? wallEl.getHeight() : 0), wallEl.object3D.position.z);
		let cx = 0, cy = 0, cz = 0;
		for (let i = 0; i < positions.length; i += 3) {
			cx += positions[i];
			cy += positions[i + 1];
			cz += positions[i + 2];
		}
		positions.push(cx / n, cy / n, cz / n);
		const indices = [];
		for (let i = 0; i < n; i++) indices.push(i, (i + 1) % n, n);
		const geom = new THREE.BufferGeometry();
		geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
		geom.setIndex(indices);
		if (isCeiling === isOutside) flipGeometry(geom);
		const uvScale = capEl.getAttribute(isCeiling ? "ceiling" : "floor")?.uvScale ?? 1;
		makePlaneUvs(geom, "x", "z", (isCeiling ? 1 : -1) * uvScale, uvScale);
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
			wallShape.lineTo(wallLength, wallGapY);
			wallShape.lineTo(wallLength, wallGapY + nextWallEl.getHeight());
			for (const openingEl of wallEl.openings) {
				positionOpening(openingEl);
				openingEl.vertices = [];
				if (openingEl.mesh) {
					openingEl.mesh.parent?.remove(openingEl.mesh);
					openingEl.mesh = null;
				}
				const portalEl = openingEl.getPortal();
				if (!portalEl) continue;
				const { width: portalWidth, height: portalHeight, floorHeight = 0 } = portalEl.getAttribute("portal");
				const pts = [];
				for (let side = -1; side <= 1; side += 2) {
					const ptX = openingEl.object3D.position.x + portalWidth / 2 * side;
					const baseY = ptX / wallLength * wallGapY;
					const bottomY = baseY + floorHeight;
					let topY = bottomY + portalHeight;
					const ceilingY = wallEl.getHeight() + ptX / wallLength * heightGap;
					if (topY > baseY + ceilingY - HAIR) topY = baseY + ceilingY - HAIR;
					addOpeningWorldVertex(wallEl, openingEl, ptX, bottomY);
					addOpeningWorldVertex(wallEl, openingEl, ptX, topY);
					pts.push({
						ptX,
						bottomY,
						topY
					});
				}
				const hole = new THREE.Path();
				hole.moveTo(pts[0].ptX, pts[0].bottomY);
				hole.lineTo(pts[0].ptX, pts[0].topY);
				hole.lineTo(pts[1].ptX, pts[1].topY);
				hole.lineTo(pts[1].ptX, pts[1].bottomY);
				hole.closePath();
				wallShape.holes.push(hole);
				if (floorHeight > 0) {
					const blockGeom = new THREE.BufferGeometry();
					blockGeom.setIndex([
						0,
						1,
						2,
						1,
						3,
						2
					]);
					blockGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
						pts[0].ptX,
						pts[0].bottomY,
						0,
						pts[0].ptX,
						pts[0].topY,
						0,
						pts[1].ptX,
						pts[1].bottomY,
						0,
						pts[1].ptX,
						pts[1].topY,
						0
					]), 3));
					const blockMesh = new THREE.Mesh(blockGeom, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
					blockMesh.visible = false;
					wallEl.object3D.add(blockMesh);
					openingEl.mesh = blockMesh;
					openingEl.classList.add("collidable");
				}
			}
			const wallGeom = new THREE.ShapeGeometry(wallShape);
			const uvScale = wallEl.getAttribute("wall")?.uvScale ?? 1;
			makePlaneUvs(wallGeom, "x", "y", uvScale, uvScale);
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
	var buildPortal = (portalEl) => {
		const { from: fromEl, to: toEl } = portalEl.getAttribute("portal");
		const portalId = portalEl.id ? `#${portalEl.id}` : "<a-portal>";
		const fromVerts = fromEl?.vertices;
		const toVerts = toEl?.vertices;
		if (!fromVerts?.length || !toVerts?.length) {
			console.error(`${portalId}: opening vertices not found — ensure both openings exist and their rooms have been built.`);
			return;
		}
		for (const childEl of portalEl.children) {
			const type = CHILD_TYPES.find((t) => childEl.components[t]);
			if (!type) continue;
			const material = childEl.components?.material?.material || childEl.parentEl?.components?.material?.material || fromEl?.parentEl?.components?.material?.material || fromEl?.parentEl?.parentEl?.components?.material?.material;
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
			const uvScale = childEl.getAttribute(type)?.uvScale ?? 1;
			let uvCallback;
			switch (type) {
				case "floor":
					addPortalWorldVertex(toVerts[0], childEl, positions);
					addPortalWorldVertex(toVerts[2], childEl, positions);
					addPortalWorldVertex(fromVerts[2], childEl, positions);
					addPortalWorldVertex(fromVerts[0], childEl, positions);
					uvCallback = (point, vertIndex) => [(1 - vertIndex % 2) * uvScale, (1 - Math.floor(vertIndex / 2)) * uvScale];
					break;
				case "ceiling":
					addPortalWorldVertex(toVerts[3], childEl, positions);
					addPortalWorldVertex(toVerts[1], childEl, positions);
					addPortalWorldVertex(fromVerts[1], childEl, positions);
					addPortalWorldVertex(fromVerts[3], childEl, positions);
					uvCallback = (point, vertIndex) => [vertIndex % 2 * uvScale, (1 - Math.floor(vertIndex / 2)) * uvScale];
					break;
				case "sides":
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
						if (vertIndex < 4) u = 1 - u;
						return [u * uvScale, vertIndex % 2 * uvScale];
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
			this.dirtyPortals = /* @__PURE__ */ new Set();
			this.dirtyRooms = /* @__PURE__ */ new Set();
		},
		buildRoom: function(roomEl) {
			this.dirtyRooms.add(roomEl);
			for (const wall of roomEl.walls || []) for (const opening of wall.openings || []) {
				const portal = opening.getPortal();
				if (portal) this.dirtyPortals.add(portal);
			}
			this.requestBuild();
		},
		buildPortal: function(portalEl) {
			const { from, to } = portalEl.components?.portal?.data || {};
			const roomA = from?.parentEl?.parentEl;
			const roomB = to?.parentEl?.parentEl;
			if (roomA) this.dirtyRooms.add(roomA);
			if (roomB) this.dirtyRooms.add(roomB);
			this.dirtyPortals.add(portalEl);
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
				for (const portalEl of this.dirtyPortals) buildPortal(portalEl);
				this.dirtyRooms.clear();
				this.dirtyPortals.clear();
				this.el.emit("room-building-complete");
			});
		}
	});
	//#endregion
});

//# sourceMappingURL=aframe-room-component.js.map