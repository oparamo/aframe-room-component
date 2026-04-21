import { buildDoorlink, buildRoom } from './buildingService';

AFRAME.registerSystem('building', {
  init: function () {
    this.updateReady = false;
    this.el.addEventListener('loaded', () => {
      const rooms = this.el.querySelectorAll('a-room');
      const doorlinks = this.el.querySelectorAll('a-doorlink');

      this.el.object3D.updateMatrixWorld();

      for (const roomEl of rooms) {
        buildRoom(roomEl);
        roomEl.object3D.visible = true;
      }

      for (const doorlinkEl of doorlinks) {
        buildDoorlink(doorlinkEl);
      }

      this.updateReady = true;
    });
  },
  buildRoom: function (roomEl) {
    if (this.updateReady) buildRoom(roomEl);
  },
  buildDoorlink: function (doorlinkEl) {
    if (this.updateReady) buildDoorlink(doorlinkEl);
  }
});
