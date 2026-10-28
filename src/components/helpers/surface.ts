import type { Component, ComponentDefinition } from '../../types/aframe';
import type { BuildingEl, SurfaceData } from '../../types/elements';
import type { SurfaceType } from '../../types/geometry';
import { removeMesh } from '../../builders/helpers/mesh';
import { checkParent, rebuildParent } from './hierarchy';

// The floor, ceiling and sides components differ only in their name and the parents they accept.
// Each mesh is stored under the component's name.
const surfaceComponent = (name: SurfaceType, ...parents: string[]): ComponentDefinition<Component<SurfaceData, BuildingEl>> => ({
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    checkParent(this.el, ...parents);
  },
  update: function () {
    rebuildParent(this.el);
  },
  // A-Frame calls this when the element leaves the document, so its parent rebuilds without it.
  remove: function () {
    removeMesh(this.el, name);
    rebuildParent(this.el);
  }
});

export { surfaceComponent };
