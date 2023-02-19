'use strict';

module.exports.Component = AFRAME.registerComponent('wall', {
  schema: {
    height: { type: 'number' }
  },
  init: function () {
    console.info('initializing wall');
    this.el.sceneEl.systems?.building?.registerWall(this.el);
  },
  update: function () {
    console.info('updating wall');
    this.el.sceneEl.systems?.building?.examineBuilding();
  },
  remove: function () {
    this.el.sceneEl.systems?.building?.unregisterWall(this.el);
  }
});
