'use strict';

module.exports.Component = AFRAME.registerComponent('doorhole', {
  init: function () {
    console.info('initializing doorhole');
  },
  update: function () {
    console.info('updating doorhole');
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
