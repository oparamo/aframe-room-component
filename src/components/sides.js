'use strict';

const DOORLINK = 'a-doorlink';

module.exports.Component = AFRAME.registerComponent('sides', {
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK) {
      const message = `<a-sides> must be a child of a <${DOORLINK}>.`;
      throw new Error(message);
    }
  }
});
