'use strict';

module.exports.Component = AFRAME.registerComponent('doorlink', {
  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    height: { type: 'number', default: 2.0 },
    width: { type: 'number', default: 0.8 }
  },
  init: function () {
    console.info('registering doorlink');
  },
  update: function () {
    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
