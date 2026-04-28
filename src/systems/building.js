import { buildDoorlink, buildRoom } from './buildingService';

AFRAME.registerSystem('building', {
  init: function () {
    this.buildPending = false;
    this.dirtyDoorlinks = new Set();
    this.dirtyRooms = new Set();
  },
  buildRoom: function (roomEl) {
    this.dirtyRooms.add(roomEl);

    // Room rebuild recalculates opening vertices, so connected doorlinks need a matching rebuild.
    for (const wall of roomEl.walls || []) {
      for (const opening of wall.openings || []) {
        const dl = opening.getDoorlink();
        if (dl) this.dirtyDoorlinks.add(dl);
      }
    }

    this.requestBuild();
  },
  buildDoorlink: function (doorlinkEl) {
    // Doorlink width/height/position affects the wall cutout, so parent rooms must rebuild first.
    const { from, to } = doorlinkEl.components?.doorlink?.data || {};
    const roomA = from?.parentEl?.parentEl;
    const roomB = to?.parentEl?.parentEl;
    if (roomA) this.dirtyRooms.add(roomA);
    if (roomB) this.dirtyRooms.add(roomB);

    this.dirtyDoorlinks.add(doorlinkEl);
    this.requestBuild();
  },
  requestBuild: function () {
    if (this.buildPending) return;
    this.buildPending = true;

    requestAnimationFrame(() => {
      this.buildPending = false;

      // Rooms must always build before doorlinks — room builds populate the opening vertices that doorlinks consume.
      for (const roomEl of this.dirtyRooms) {
        buildRoom(roomEl);
        roomEl.object3D.visible = true;
      }
      for (const doorlinkEl of this.dirtyDoorlinks) {
        buildDoorlink(doorlinkEl);
      }

      this.dirtyRooms.clear();
      this.dirtyDoorlinks.clear();
      this.el.emit('room-building-complete');
    });
  }
});
