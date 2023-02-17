'use strict';

module.exports.Component = AFRAME.registerComponent('sides', {
  init: function () {
    console.info('registering sides');
  },
  update: function () {
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
