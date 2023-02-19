'use strict';

module.exports.Component = AFRAME.registerComponent('doorlink', {
  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    height: { type: 'number', default: 2.0 },
    width: { type: 'number', default: 0.8 }
  },
  init: function () {
    console.info('initializing doorlink');
  },
  update: function () {
    console.info('updating doorlink');
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
