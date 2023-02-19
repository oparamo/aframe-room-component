'use strict';

module.exports.Component = AFRAME.registerComponent('floor', {
  init: function () {
    console.info('initializing floor');
  },
  update: function () {
    console.info('updating floor');
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
