'use strict';

const { buildDoorlink, buildRoom } = require('./buildingService');

module.exports.System = AFRAME.registerSystem('building', {
  init: function () {
    this.el.addEventListener('loaded', this.initialBuild);
    this.el.updateReady = false;
  },
  initialBuild: function () {
    const doorlinks = this.querySelectorAll('a-doorlink');
    const rooms = this.querySelectorAll('a-room');

    this.object3D.updateMatrixWorld();

    for (const roomEl of rooms) {
      buildRoom(roomEl);
    }

    for (const doorlinkEl of doorlinks) {
      buildDoorlink(doorlinkEl);
    }

    this.updateReady = true;
  },
  buildRoom: function (roomEl) {
    if (this.el.updateReady) buildRoom(roomEl);
  },
  buildDoorlink: function (doorlinkEl) {
    if (this.el.updateReady) buildDoorlink(doorlinkEl);
  }
});
