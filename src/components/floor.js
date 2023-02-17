'use strict';

module.exports.Component = AFRAME.registerComponent('floor', {
  init: function () {
    console.info('registering floor');
  },
  update: function () {
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
