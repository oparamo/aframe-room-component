'use strict';

const DOORLINK = 'a-doorlink';

module.exports.Component = AFRAME.registerComponent('sides', {
  update: function () {
    console.info('updating sides');

    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK) {
      const message = `a-sides elements must have an "${DOORLINK}" parent`;
      throw new Error(message);
    }
  }
});
