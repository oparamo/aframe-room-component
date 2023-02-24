'use strict';

const ROOM = 'a-room';

module.exports.Component = AFRAME.registerComponent('wall', {
  schema: {
    height: { type: 'number' }
  },
  init: function () {
    console.info('initializing wall');

    const parentName = this.el.parentEl?.localName;
    if (parentName !== ROOM) {
      const message = `a-wall elements must have an "${ROOM}" parent`;
      throw new Error(message);
    }

    const doorholes = Array.from(this.el.querySelectorAll('a-doorhole'));
    this.el.doorholes = doorholes.sort((a, b) => a?.object3D?.position?.x - b?.object3D?.position?.x);
  }
});
