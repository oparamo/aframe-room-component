'use strict';

const WALL = 'a-wall';

module.exports.Component = AFRAME.registerComponent('doorhole', {
  init: function () {
    console.info('initializing doorhole');

    const parentName = this.el.parentEl?.localName;
    if (parentName !== WALL) {
      const message = `a-doorhole elements must have an "${WALL}" parent`;
      throw new Error(message);
    }
  }
});
