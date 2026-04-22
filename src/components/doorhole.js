const WALL = 'a-wall';

AFRAME.registerComponent('doorhole', {
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== WALL) {
      const message = `<a-doorhole> must be a child of a <${WALL}>.`;
      throw new Error(message);
    }

    this.el.vertices = [];
    this.el.getDoorlink = () => {
      for (const dl of this.el.sceneEl.querySelectorAll('a-doorlink')) {
        const data = dl.components?.doorlink?.data;
        if (data?.from === this.el || data?.to === this.el) return dl;
      }
      return null;
    };
  }
});
