import type { BuildingSystem, PortalEl } from '../types/elements';
import { buildPortal, buildRoom } from './buildingService';

// The rooms whose walls hold the portal's openings.
const roomsOf = (portalEl: PortalEl) => {
  const data = portalEl.components.portal?.data;
  return [data?.from, data?.to].flatMap(openingEl => openingEl ? [openingEl.parentEl.parentEl] : []);
};

AFRAME.registerSystem<BuildingSystem>('building', {
  init: function () {
    this.buildPending = false;
    this.dirtyPortals = new Set();
    this.dirtyRooms = new Set();
  },
  buildRoom: function (roomEl) {
    this.dirtyRooms.add(roomEl);

    // Room rebuild recalculates opening vertices, so connected portals need a matching rebuild.
    for (const wall of roomEl.walls) {
      for (const opening of wall.openings) {
        const portal = opening.getPortal();
        if (portal) this.dirtyPortals.add(portal);
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
  // Rebuilds the portal's rooms. By then the portal has left the scene or lost its portal component,
  // so its openings build as solid wall.
  removePortal: function (portalEl) {
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

      // Rooms must always build before portals, because room builds populate the opening vertices that portals consume.
      for (const roomEl of this.dirtyRooms) {
        buildRoom(roomEl);
        roomEl.object3D.visible = true;
      }
      for (const portalEl of this.dirtyPortals) {
        buildPortal(portalEl);
      }

      this.dirtyRooms.clear();
      this.dirtyPortals.clear();
      this.el.emit('room-building-complete');
    });
  }
});
