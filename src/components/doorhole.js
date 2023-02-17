'use strict';

module.exports.Component = AFRAME.registerComponent('doorhole', {
  init: function () {
    console.info('registering doorhole');
  },
  update: function () {
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
