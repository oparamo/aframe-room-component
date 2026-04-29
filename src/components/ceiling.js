const PORTAL = 'a-portal';
const ROOM = 'a-room';

AFRAME.registerComponent('ceiling', {
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== PORTAL && parentName !== ROOM) {
      const message = `<a-ceiling> must be a child of a <${PORTAL}> or <${ROOM}>.`;
      throw new Error(message);
    }
  }
});
