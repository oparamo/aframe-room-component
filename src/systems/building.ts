import type { BuildingSystem } from '../types/elements';
import { buildPortal, buildRoom } from './buildingService';

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
    const data = portalEl.components.portal?.data;
    const roomA = data?.from?.parentEl.parentEl;
    const roomB = data?.to?.parentEl.parentEl;
    if (roomA) this.dirtyRooms.add(roomA);
    if (roomB) this.dirtyRooms.add(roomB);

    this.dirtyPortals.add(portalEl);
    this.requestBuild();
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
