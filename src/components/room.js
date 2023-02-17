'use strict';

module.exports.Component = AFRAME.registerComponent('room', {
  schema: {
    outside: { type: 'boolean' },
    height: { type: 'number', default: 2.4 },
    width: { type: 'number' },
    length: { type: 'number' }
  },
  init: function () {
    console.info('registering room');
    this.el.sceneEl.systems?.building?.registerRoom(this.el);
  },
  update: function () {
    console.info('updating room');
    this.el.sceneEl.systems?.building?.examineBuilding();
  },
  remove: function () {
    this.el.sceneEl.systems?.building?.unregisterRoom(this.el);
  }
});
