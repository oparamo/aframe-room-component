import type { Component } from '../types/aframe';
import type { OpeningEl } from '../types/elements';
import { disableCollision } from '../builders/helpers/mesh';
import { COLLIDABLE } from '../utils/surfaceClasses';
import { checkParent, rebuildParent } from './helpers/hierarchy';

AFRAME.registerComponent<Component<unknown, OpeningEl>>('opening', {
  init: function () {
    checkParent(this.el, 'a-wall');
  },
  // A-Frame calls this when the opening leaves the document. Its wall's room rebuilds without the
  // hole, and its portal finds that end gone.
  remove: function () {
    disableCollision(this.el, COLLIDABLE);
    this.el.sceneEl.systems['room-building']?.removeOpening(this.el);
    rebuildParent(this.el.parentEl);
  }
});
