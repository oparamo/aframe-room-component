import { requireParent } from './shared';

AFRAME.registerComponent('sides', {
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    requireParent(this.el, 'a-portal');
  }
});
