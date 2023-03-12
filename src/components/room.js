'use strict';

module.exports.Component = AFRAME.registerComponent('room', {
  schema: {
    outside: { type: 'boolean' },
    height: { type: 'number', default: 2.4 },
    width: { type: 'number' },
    length: { type: 'number' }
  },
  init: function () {
    const roomEl = this.el;
    const { length, width } = roomEl?.getAttribute('room');
    const walls = Array.from(roomEl.querySelectorAll('a-wall'));

    if ((width || length) && !(width && length)) {
      const message = 'rooms with WIDTH must also have LENGTH (and vice versa)';
      console.error(message);
      throw new Error(message);
    }

    if (width && length && walls.length !== 4) {
      const message = 'rooms with WIDTH and LENGTH must have four walls!';
      console.error(message);
      throw new Error(message);
    }

    roomEl.ceiling = roomEl.querySelector('a-ceiling');
    roomEl.floor = roomEl.querySelector('a-floor');
    roomEl.walls = walls;
  },
  update: function () {
    this.el.sceneEl.systems?.building?.buildRoom(this.el);
  }
});
