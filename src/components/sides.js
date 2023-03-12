'use strict';

const DOORLINK = 'a-doorlink';

module.exports.Component = AFRAME.registerComponent('sides', {
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK) {
      const message = `a-sides elements must have an "${DOORLINK}" parent`;
      throw new Error(message);
    }
  }
});
