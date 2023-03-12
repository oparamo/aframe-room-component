'use strict';

const DOORLINK = 'a-doorlink';
const ROOM = 'a-room';

module.exports.Component = AFRAME.registerComponent('floor', {
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK && parentName !== ROOM) {
      const message = `a-floor elements must have an "${DOORLINK}" or "${ROOM}" parent`;
      throw new Error(message);
    }
  }
});
