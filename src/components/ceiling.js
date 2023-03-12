'use strict';

const DOORLINK = 'a-doorlink';
const ROOM = 'a-room';

module.exports.Component = AFRAME.registerComponent('ceiling', {
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK && parentName !== ROOM) {
      const message = `<a-ceiling> must be a child of a <${DOORLINK}> or <${ROOM}>.`;
      throw new Error(message);
    }
  }
});
