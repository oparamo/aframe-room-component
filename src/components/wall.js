'use strict';

const ROOM = 'a-room';

module.exports.Component = AFRAME.registerComponent('wall', {
  schema: {
    height: { type: 'number' }
  },
  update: function () {
    console.info('updating wall');

    const parentName = this.el.parentEl?.localName;
    if (parentName !== ROOM) {
      const message = 'a-wall elements must have an "a-room" parent';
      throw new Error(message);
    }
  }
});
