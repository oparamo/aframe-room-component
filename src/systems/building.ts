import type { Matrix4 } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingSystem, OpeningEl, PortalEl } from '../types/elements';
import { nameOf, openingsOf, portalEnds, wallsOf } from '../builders/helpers/structure';
import { buildPortal } from '../builders/portal';
import { buildRoom } from '../builders/room';

// The openings a portal joins, leaving out ends that aren't openings.
const openingsJoinedBy = (portalEl: PortalEl) => {
  const { from, to } = portalEnds(portalEl.getAttribute('portal') ?? {});
  return [from, to].flatMap(openingEl => openingEl ? [openingEl] : []);
};

const roomOf = (openingEl: OpeningEl) => openingEl.parentEl.parentEl;

// The rooms whose walls hold the portal's openings.
const roomsOf = (portalEl: PortalEl) => openingsJoinedBy(portalEl).map(roomOf);

const snapshotMatrix = (el: Entity, matrixOf: WeakMap<Entity, Matrix4>) => {
  el.object3D.updateWorldMatrix(true, false);
  const snapshot = matrixOf.get(el) ?? new THREE.Matrix4();
  matrixOf.set(el, snapshot.copy(el.object3D.matrixWorld));
};

// Whether the element is still in the document with the component that queued it.
const isLive = (el: Entity, component: 'room' | 'portal') => el.isConnected && component in el.components;

// Builds the element, or logs the error and returns false, so one bad element never stops the rest.
const buildSafely = (el: Entity, build: () => void) => {
  try {
    build();
    return true;
  } catch (error) {
    console.error(`${nameOf(el)} failed to build and was skipped.`, el, error);
    return false;
  }
};

AFRAME.registerSystem<BuildingSystem>('room-building', {
  init: function () {
    this.buildPending = false;
    this.dirtyPortals = new Set();
    this.dirtyRooms = new Set();
    this.state = { portalOf: new WeakMap(), cornersOf: new WeakMap() };
    this.builtMatrixOf = new WeakMap();
    this.builtPositionOf = new WeakMap();
    this.hiddenRooms = new WeakSet();
  },
  // Runs a requested pass inside the scene's render loop, which in WebXR is the session's own frame
  // loop, so builds keep up in VR. The animation frame requestBuild asks for covers a paused scene.
  tick: function () {
    this._runPass();
  },
  // Hides the room until its first build, so it never shows with missing walls.
  hideUntilBuilt: function (roomEl) {
    roomEl.object3D.visible = false;
    this.hiddenRooms.add(roomEl);
  },
  buildRoom: function (roomEl) {
    this.dirtyRooms.add(roomEl);

    // Room rebuild recalculates opening corners, so connected portals need a matching rebuild.
    for (const wallEl of wallsOf(roomEl)) {
      for (const openingEl of openingsOf(wallEl)) {
        const portalEl = this.state.portalOf.get(openingEl);
        if (portalEl) this.dirtyPortals.add(portalEl);
      }
    }

    this.requestBuild();
  },
  buildPortal: function (portalEl) {
    // Portal width/height/position affects the wall cutout, so parent rooms must rebuild first.
    for (const roomEl of roomsOf(portalEl)) this.dirtyRooms.add(roomEl);

    this.dirtyPortals.add(portalEl);
    this.requestBuild();
  },
  // Points the portal's current openings at it, and releases the ones it joined before. Their
  // rooms rebuild, so the old holes fill back in.
  linkPortal: function (portalEl, previous) {
    const current = openingsJoinedBy(portalEl);
    const { from, to } = portalEnds(previous);
    for (const openingEl of [from, to]) {
      if (!openingEl || current.includes(openingEl) || this.state.portalOf.get(openingEl) !== portalEl) continue;
      this.state.portalOf.delete(openingEl);
      this.dirtyRooms.add(roomOf(openingEl));
    }
    for (const openingEl of current) this.state.portalOf.set(openingEl, portalEl);
  },
  // Rebuilds the portal's rooms. Their openings no longer have a portal, so they build as solid wall.
  removePortal: function (portalEl) {
    for (const openingEl of openingsJoinedBy(portalEl)) this.state.portalOf.delete(openingEl);
    for (const roomEl of roomsOf(portalEl)) this.dirtyRooms.add(roomEl);

    this.dirtyPortals.delete(portalEl);
    this.requestBuild();
  },
  // The pass that follows emits room-building-complete, so listeners see the scene without the room.
  removeRoom: function (roomEl) {
    this.dirtyRooms.delete(roomEl);
    this.requestBuild();
  },
  // Forgets the opening's corners and rebuilds its portal, which then finds that end missing.
  removeOpening: function (openingEl) {
    this.state.cornersOf.delete(openingEl);
    const portalEl = this.state.portalOf.get(openingEl);
    if (portalEl) this.buildPortal(portalEl);
  },
  requestBuild: function () {
    if (this.buildPending) return;
    this.buildPending = true;
    requestAnimationFrame(() => {
      this._runPass();
    });
  },
  // Whichever comes first, the system's tick or the animation frame, takes the pending pass.
  _runPass: function () {
    if (!this.buildPending) return;
    this.buildPending = false;

    // Copied and cleared first, so a build that queues more work queues it for the next pass.
    const rooms = [...this.dirtyRooms].filter(roomEl => isLive(roomEl, 'room'));
    const portals = [...this.dirtyPortals].filter(portalEl => isLive(portalEl, 'portal'));
    this.dirtyRooms.clear();
    this.dirtyPortals.clear();

    // Rooms must always build before portals, because room builds record the opening corners that portals join.
    const builtRooms = rooms.filter(roomEl => buildSafely(roomEl, () => {
      buildRoom(roomEl, this.state);
    }));
    for (const roomEl of builtRooms) this._show(roomEl);
    const builtPortals = portals.filter(portalEl => buildSafely(portalEl, () => {
      buildPortal(portalEl, this.state);
    }));
    this._recordBuilt(builtRooms, builtPortals);

    this.el.emit('room-building-complete', { rooms: builtRooms, portals: builtPortals });
  },
  // Shows a room the system hid, once it has built. A room hidden by its own markup stays hidden.
  _show: function (roomEl) {
    if (!this.hiddenRooms.delete(roomEl)) return;
    roomEl.object3D.visible = true;
  },
  // Snapshots what the pass built, after the whole pass, so a portal on a wall is measured after
  // the room build turned that wall.
  _recordBuilt: function (rooms, portals) {
    for (const roomEl of rooms) {
      snapshotMatrix(roomEl, this.builtMatrixOf);
      for (const wallEl of wallsOf(roomEl)) {
        const position = this.builtPositionOf.get(wallEl) ?? new THREE.Vector3();
        this.builtPositionOf.set(wallEl, position.copy(wallEl.object3D.position));
      }
    }
    for (const portalEl of portals) snapshotMatrix(portalEl, this.builtMatrixOf);
  },
  // Whether a room or portal has moved since it was built. Before its first build it hasn't.
  hasMoved: function (el) {
    const built = this.builtMatrixOf.get(el);
    return built !== undefined && !el.object3D.matrixWorld.equals(built);
  },
  // Whether a wall has moved within its room since it was built. The build sets each wall's
  // rotation itself, so only position counts.
  hasWallMoved: function (wallEl) {
    const built = this.builtPositionOf.get(wallEl);
    return built !== undefined && !built.equals(wallEl.object3D.position);
  }
});
