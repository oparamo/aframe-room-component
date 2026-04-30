import { requireParent } from './shared';

AFRAME.registerComponent('opening', {
  init: function () {
    requireParent(this.el, 'a-wall');

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
