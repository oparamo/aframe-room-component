import type { Component } from '../types/aframe';
import type { OpeningEl } from '../types/elements';
import { requireParent } from './helpers/hierarchy';

AFRAME.registerComponent<Component<unknown, OpeningEl>>('opening', {
  init: function () {
    requireParent(this.el, 'a-wall');
  }
});
