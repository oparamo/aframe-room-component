import type { Component } from '../types/aframe';
import type { BuildingEl, SurfaceData } from '../types/elements';
import { rebuildParent, requireParent } from './shared';

AFRAME.registerComponent<Component<SurfaceData, BuildingEl>>('sides', {
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    requireParent(this.el, 'a-portal');
  },
  update: function () {
    rebuildParent(this.el);
  }
});
