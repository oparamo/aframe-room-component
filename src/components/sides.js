const PORTAL = 'a-portal';

AFRAME.registerComponent('sides', {
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== PORTAL) {
      const message = `<a-sides> must be a child of a <${PORTAL}>.`;
      throw new Error(message);
    }
  }
});
