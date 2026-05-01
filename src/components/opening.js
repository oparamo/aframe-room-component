import { requireParent } from './shared';

AFRAME.registerComponent('opening', {
  init: function () {
    requireParent(this.el, 'a-wall');

    this.el.vertices = [];
    this.el._portalEl = undefined;
    this.el.getPortal = () => {
      if (this.el._portalEl !== undefined) return this.el._portalEl;
      for (const portal of this.el.sceneEl.querySelectorAll('a-portal')) {
        const data = portal.components?.portal?.data;
        if (data?.from === this.el || data?.to === this.el) {
          this.el._portalEl = portal;
          return portal;
        }
      }
      this.el._portalEl = null;
      return null;
    };
  }
});
