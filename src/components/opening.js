const WALL = 'a-wall';

AFRAME.registerComponent('opening', {
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== WALL) {
      const message = `<a-opening> must be a child of a <${WALL}>.`;
      throw new Error(message);
    }

    this.el.vertices = [];
    this.el.getPortal = () => {
      for (const dl of this.el.sceneEl.querySelectorAll('a-portal')) {
        const data = dl.components?.portal?.data;
        if (data?.from === this.el || data?.to === this.el) return dl;
      }
      return null;
    };
  }
});
