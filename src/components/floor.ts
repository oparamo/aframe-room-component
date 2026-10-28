import type { Component } from '../types/aframe';
import type { BuildingEl, SurfaceData } from '../types/elements';
import { rebuildParent, requireParent } from './helpers/hierarchy';

AFRAME.registerComponent<Component<SurfaceData, BuildingEl>>('floor', {
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    requireParent(this.el, 'a-portal', 'a-room');
  },
  update: function () {
    rebuildParent(this.el);
  }
});
