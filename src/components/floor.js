const DOORLINK = 'a-doorlink';
const ROOM = 'a-room';

AFRAME.registerComponent('floor', {
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK && parentName !== ROOM) {
      const message = `<a-floor> must be a child of a <${DOORLINK}> or <${ROOM}>.`;
      throw new Error(message);
    }
  }
});
