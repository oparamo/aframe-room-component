const DOORLINK = 'a-doorlink';

AFRAME.registerComponent('sides', {
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== DOORLINK) {
      const message = `<a-sides> must be a child of a <${DOORLINK}>.`;
      throw new Error(message);
    }
  }
});
