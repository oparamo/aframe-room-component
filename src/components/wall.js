'use strict';

module.exports.Component = AFRAME.registerComponent('wall', {
  schema: {
    height: { type: 'number' }
  },
  init: function () {
    this.el.sceneEl.systems?.building?.registerWall(this);
  },
  update: function () {
    this.el.sceneEl.systems?.building?.examineBuilding();
  },
  remove: function () {
    this.el.sceneEl.systems?.building?.unregisterWall(this);
  }
});
