'use strict';

const DOORLINK = 'a-doorlink';
const ROOM = 'a-room';

module.exports.Component = AFRAME.registerComponent('ceiling', {
  init: function () {
    console.info('initializing ceiling');

    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK && parentName !== ROOM) {
      const message = `a-ceiling elements must have an "${DOORLINK}" or "${ROOM}" parent`;
      throw new Error(message);
    }
  }
});
