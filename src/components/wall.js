import { requireParent } from './shared';

AFRAME.registerComponent('wall', {
  schema: {
    height: { type: 'number' },
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    requireParent(this.el, 'a-room');

    const openings = Array.from(this.el.querySelectorAll('a-opening'));
    this.el.openings = openings.sort((a, b) => a.object3D.position.x - b.object3D.position.x);

    this.el.getHeight = () => this.el.getAttribute('wall').height || this.el.parentEl.getAttribute('room').height;
  }
});
