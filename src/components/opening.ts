import type { Component } from '../types/aframe';
import type { OpeningEl, PortalEl } from '../types/elements';
import { requireParent } from './shared';

AFRAME.registerComponent<Component<unknown, OpeningEl>>('opening', {
  init: function () {
    requireParent(this.el, 'a-wall');

    this.el.vertices = [];
    this.el.getPortal = () => {
      for (const portal of this.el.sceneEl.querySelectorAll<PortalEl>('a-portal')) {
        const data = portal.components.portal?.data;
        if (data?.from === this.el || data?.to === this.el) return portal;
      }
      return null;
    };
  }
});
