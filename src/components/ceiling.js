'use strict';

module.exports.Component = AFRAME.registerComponent('ceiling', {
  init: function () {
    console.info('initializing ceiling');
  },
  update: function () {
    console.info('updating ceiling');
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
