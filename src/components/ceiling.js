'use strict';

const DOORLINK = 'a-doorlink';
const ROOM = 'a-room';

module.exports.Component = AFRAME.registerComponent('ceiling', {
  update: function () {
    console.info('updating ceiling');

    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK && parentName !== ROOM) {
      const message = `a-ceiling elements must have an "${DOORLINK}" or "${ROOM}" parent`;
      throw new Error(message);
    }
  }
});
