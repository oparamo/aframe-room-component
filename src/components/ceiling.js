'use strict';

module.exports.Component = AFRAME.registerComponent('ceiling', {
  init: function () {
    console.info('registering ceiling');
  },
  update: function () {
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
