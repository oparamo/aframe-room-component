const TRANSFORM_PROPS = new Set(['position', 'rotation', 'scale']);

AFRAME.registerComponent('room', {
  schema: {
    outside: { type: 'boolean' },
    height: { type: 'number', default: 2.4 },
    width: { type: 'number' },
    length: { type: 'number' }
  },
  init: function () {
    const roomEl = this.el;
    const { length, width } = this.data;
    const walls = Array.from(roomEl.querySelectorAll('a-wall'));

    if ((width || length) && !(width && length)) {
      const message = '<a-room> with WIDTH must also have LENGTH (and vice versa).';
      console.error(message);
      throw new Error(message);
    }

    if (width && length && walls.length !== 4) {
      const message = '<a-room> with WIDTH and LENGTH must have four walls.';
      console.error(message);
      throw new Error(message);
    }

    roomEl.ceiling = roomEl.querySelector('a-ceiling');
    roomEl.floor = roomEl.querySelector('a-floor');
    roomEl.walls = walls;
    roomEl.object3D.visible = false;

    this._onTransformChanged = (e) => {
      if (TRANSFORM_PROPS.has(e.detail.name)) {
        roomEl.sceneEl.systems?.building?.buildRoom(roomEl);
      }
    };
    roomEl.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function () {
    this.el.sceneEl.systems?.building?.buildRoom(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
  }
});
