import { buildDoorlink, buildRoom } from './buildingService';

// Orchestrates geometry builds for all rooms and doorlinks in the scene.
// On load, rooms are built first (which populates doorhole world-space vertices),
// then doorlinks are built (which consume those vertices to form tunnel geometry).
// At runtime, components call buildRoom/buildDoorlink to request a rebuild;
// these are coalesced into a single pass per frame via requestAnimationFrame.
AFRAME.registerSystem('building', {
  init: function () {
    this.updateReady = false;
    this.dirtyRooms = new Set();
    this.dirtyDoorlinks = new Set();
    this.buildPending = false;

    this.el.addEventListener('loaded', () => {
      const rooms = this.el.querySelectorAll('a-room');
      const doorlinks = this.el.querySelectorAll('a-doorlink');

      // Ensure world matrices are current before geometry is placed in world space.
      this.el.object3D.updateMatrixWorld();

      for (const roomEl of rooms) {
        buildRoom(roomEl);
        roomEl.object3D.visible = true;
      }

      for (const doorlinkEl of doorlinks) {
        buildDoorlink(doorlinkEl);
      }

      // Allow runtime rebuilds only after the initial build completes, so that
      // component update() calls during init don't trigger premature rebuilds.
      this.updateReady = true;
    });
  },
  buildRoom: function (roomEl) {
    if (!this.updateReady) return;
    this.dirtyRooms.add(roomEl);
    // Rebuilding a room recalculates doorhole vertices, so any connected doorlinks
    // must also be rebuilt to stay in sync with the new opening positions.
    for (const wall of roomEl.walls || []) {
      for (const doorhole of wall.doorholes || []) {
        const dl = doorhole.getDoorlink();
        if (dl) this.dirtyDoorlinks.add(dl);
      }
    }
    this.requestBuild();
  },
  buildDoorlink: function (doorlinkEl) {
    if (!this.updateReady) return;
    // Rooms must rebuild before the doorlink so doorhole vertices are current.
    const { from, to } = doorlinkEl.components?.doorlink?.data || {};
    const roomA = from?.parentEl?.parentEl;
    const roomB = to?.parentEl?.parentEl;
    if (roomA) this.dirtyRooms.add(roomA);
    if (roomB) this.dirtyRooms.add(roomB);
    this.dirtyDoorlinks.add(doorlinkEl);
    this.requestBuild();
  },
  // Coalesces multiple rebuild requests into one pass at the start of the next frame.
  requestBuild: function () {
    if (this.buildPending) return;
    this.buildPending = true;
    requestAnimationFrame(() => {
      this.buildPending = false;
      for (const roomEl of this.dirtyRooms) {
        buildRoom(roomEl);
        roomEl.object3D.visible = true;
      }
      for (const doorlinkEl of this.dirtyDoorlinks) {
        buildDoorlink(doorlinkEl);
      }
      this.dirtyRooms.clear();
      this.dirtyDoorlinks.clear();
    });
  }
});
