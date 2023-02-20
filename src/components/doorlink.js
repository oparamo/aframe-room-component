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
    const doorlinkEl = this.el;

    doorlinkEl.ceiling = doorlinkEl.querySelector('a-ceiling');
    doorlinkEl.floor = doorlinkEl.querySelector('a-floor');
    doorlinkEl.sides = doorlinkEl.querySelector('a-sides');


    doorlinkEl.sceneEl.systems?.building?.registerDoorlink(doorlinkEl);
  },
  update: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== SCENE && parentName !== WALL) {
      const message = 'a-doorlink elements must have an "a-scene" or "a-wall" parent';
      throw new Error(message);
    }

    this.el.sceneEl.systems?.building?.examineBuilding();
  }
});
