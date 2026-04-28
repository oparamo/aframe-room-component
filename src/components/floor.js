const DOORLINK = 'a-doorlink';
const ROOM = 'a-room';

AFRAME.registerComponent('floor', {
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK && parentName !== ROOM) {
      const message = `<a-floor> must be a child of a <${DOORLINK}> or <${ROOM}>.`;
      throw new Error(message);
    }
  }
});
