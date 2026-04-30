import { requireParent } from './shared';

AFRAME.registerComponent('ceiling', {
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    requireParent(this.el, 'a-portal', 'a-room');
  }
});
