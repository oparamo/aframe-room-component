import type { Matrix4 } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingSystem, PortalEl } from '../types/elements';
import { openingsOf, portalEnds, wallsOf } from '../builders/helpers/structure';
import { buildPortal } from '../builders/portal';
import { buildRoom } from '../builders/room';

// The openings a portal joins, leaving out ends that aren't openings.
const openingsJoinedBy = (portalEl: PortalEl) => {
  const { from, to } = portalEnds(portalEl.getAttribute('portal') ?? {});
  return [from, to].flatMap(openingEl => openingEl ? [openingEl] : []);
};

// The rooms whose walls hold the portal's openings.
const roomsOf = (portalEl: PortalEl) => openingsJoinedBy(portalEl).map(openingEl => openingEl.parentEl.parentEl);

const snapshotMatrix = (el: Entity, matrixOf: WeakMap<Entity, Matrix4>) => {
  el.object3D.updateWorldMatrix(true, false);
  const snapshot = matrixOf.get(el) ?? new THREE.Matrix4();
  matrixOf.set(el, snapshot.copy(el.object3D.matrixWorld));
};

AFRAME.registerSystem<BuildingSystem>('building', {
  init: function () {
    this.buildPending = false;
    this.dirtyPortals = new Set();
    this.dirtyRooms = new Set();
    this.state = { portalOf: new WeakMap(), cornersOf: new WeakMap() };
    this.builtMatrixOf = new WeakMap();
    this.builtPositionOf = new WeakMap();
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
  // Points the portal's current openings at it, and releases the ones it joined before.
  linkPortal: function (portalEl, previous) {
    const { from, to } = portalEnds(previous);
    for (const openingEl of [from, to]) {
      if (openingEl && this.state.portalOf.get(openingEl) === portalEl) this.state.portalOf.delete(openingEl);
    }
    for (const openingEl of openingsJoinedBy(portalEl)) this.state.portalOf.set(openingEl, portalEl);
  },
  // Rebuilds the portal's rooms. Their openings no longer have a portal, so they build as solid wall.
  removePortal: function (portalEl) {
    for (const openingEl of openingsJoinedBy(portalEl)) this.state.portalOf.delete(openingEl);
    for (const roomEl of roomsOf(portalEl)) this.dirtyRooms.add(roomEl);

    this.dirtyPortals.delete(portalEl);
    this.requestBuild();
  },
  removeRoom: function (roomEl) {
    this.dirtyRooms.delete(roomEl);
  },
  requestBuild: function () {
    if (this.buildPending) return;
    this.buildPending = true;

    requestAnimationFrame(() => {
      this.buildPending = false;

      // Rooms must always build before portals, because room builds record the opening corners that portals join.
      for (const roomEl of this.dirtyRooms) {
        buildRoom(roomEl, this.state);
        roomEl.object3D.visible = true;
      }
      for (const portalEl of this.dirtyPortals) {
        buildPortal(portalEl, this.state);
      }
      this._recordBuilt();

      this.dirtyRooms.clear();
      this.dirtyPortals.clear();
      this.el.emit('room-building-complete');
    });
  },
  // Snapshots what the pass built, after the whole pass, so a portal on a wall is measured after
  // the room build turned that wall.
  _recordBuilt: function () {
    for (const roomEl of this.dirtyRooms) {
      snapshotMatrix(roomEl, this.builtMatrixOf);
      for (const wallEl of wallsOf(roomEl)) {
        const position = this.builtPositionOf.get(wallEl) ?? new THREE.Vector3();
        this.builtPositionOf.set(wallEl, position.copy(wallEl.object3D.position));
      }
    }
    for (const portalEl of this.dirtyPortals) snapshotMatrix(portalEl, this.builtMatrixOf);
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
