import type { Component, ComponentDefinition } from '../../types/aframe';
import type { BuildingEl, SurfaceData } from '../../types/elements';
import { removeMesh } from '../../builders/helpers/mesh';
import { checkParent, rebuildParent } from './hierarchy';
import { isMaterialRemoval } from './material';

interface SurfaceComponent extends Component<SurfaceData, BuildingEl> {
  _onMaterialRemoved: (event: Event) => void;
}

// The floor, ceiling and sides components differ only in the parents they accept.
const surfaceComponent = (...parents: string[]): ComponentDefinition<SurfaceComponent> => ({
  schema: {
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    checkParent(this.el, ...parents);

    // A removed material component leaves a plain material on the mesh; the rebuild puts the inherited one back.
    this._onMaterialRemoved = (event) => {
      if (isMaterialRemoval(event)) rebuildParent(this.el);
    };
    this.el.addEventListener('componentremoved', this._onMaterialRemoved);
  },
  update: function () {
    rebuildParent(this.el);
  },
  // A-Frame calls this when the element leaves the document, so its parent rebuilds without it.
  remove: function () {
    this.el.removeEventListener('componentremoved', this._onMaterialRemoved);
    removeMesh(this.el);
    rebuildParent(this.el);
  }
});

export { surfaceComponent, type SurfaceComponent };
