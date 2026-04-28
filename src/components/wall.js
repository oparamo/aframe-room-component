const ROOM = 'a-room';

AFRAME.registerComponent('wall', {
  schema: {
    height: { type: 'number' },
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== ROOM) {
      const message = `<a-wall> must be a child of a <${ROOM}>`;
      throw new Error(message);
    }

    const doorholes = Array.from(this.el.querySelectorAll('a-doorhole'));
    this.el.doorholes = doorholes.sort((a, b) => a.object3D.position.x - b.object3D.position.x);

    this.el.getHeight = () => this.el.getAttribute('wall').height || this.el.parentEl.getAttribute('room').height;
  }
});
