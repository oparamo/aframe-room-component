'use strict';

module.exports.Component = AFRAME.registerComponent('sides', {
  init: function () {
    console.info('initializing sides');
  },
  update: function () {
    console.info('updating sides');
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
