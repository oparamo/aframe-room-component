import type { Component } from '../types/aframe';
import type { WallData, WallEl } from '../types/elements';
import { removeMesh } from '../builders/helpers/mesh';
import { checkParent, rebuildParent } from './helpers/hierarchy';
import { isMaterialRemoval } from './helpers/material';
import { isTransformChange } from './helpers/transforms';

interface WallComponent extends Component<WallData, WallEl> {
  _onTransformChanged: (event: Event) => void;
  _onMaterialRemoved: (event: Event) => void;
}

AFRAME.registerComponent<WallComponent>('wall', {
  schema: {
    height: { type: 'number' },
    uvScale: { type: 'number', default: 1 },
    collidable: { type: 'boolean', default: true }
  },
  init: function () {
    checkParent(this.el, 'a-room');

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) rebuildParent(this.el);
    };
    this.el.addEventListener('componentchanged', this._onTransformChanged);
    // A removed material component leaves a plain material on the mesh; the rebuild puts the room's back.
    this._onMaterialRemoved = (event) => {
      if (isMaterialRemoval(event)) rebuildParent(this.el);
    };
    this.el.addEventListener('componentremoved', this._onMaterialRemoved);
  },
  update: function () {
    rebuildParent(this.el);
  },
  // Catches moves that bypass setAttribute.
  tick: function () {
    if (this.el.sceneEl.systems['room-building']?.hasWallMoved(this.el)) rebuildParent(this.el);
  },
  // A-Frame calls this when the wall leaves the document, so the room rebuilds without it.
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
    this.el.removeEventListener('componentremoved', this._onMaterialRemoved);
    removeMesh(this.el);
    rebuildParent(this.el);
  }
});
