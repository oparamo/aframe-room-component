'use strict';

const SCENE = 'a-scene';
const WALL = 'a-wall';

module.exports.Component = AFRAME.registerComponent('doorlink', {
  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    height: { type: 'number', default: 2.0 },
    width: { type: 'number', default: 0.8 }
  },
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== SCENE && parentName !== WALL) {
      const message = `<a-doorlink> must be a child of a <${SCENE}> or <${WALL}>.`;
      throw new Error(message);
    }
  },
  update: function () {
    this.el.sceneEl.systems?.building?.buildDoorlink(this.el);
  }
});
