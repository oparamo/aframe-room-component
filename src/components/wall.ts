import type { Component } from '../types/aframe';
import type { WallData, WallEl } from '../types/elements';
import { removeMesh, WALL_MESH } from '../builders/helpers/mesh';
import { checkParent, rebuildParent } from './helpers/hierarchy';
import { isTransformChange } from './helpers/transforms';

interface WallComponent extends Component<WallData, WallEl> {
  _onTransformChanged: (event: Event) => void;
}

AFRAME.registerComponent<WallComponent>('wall', {
  schema: {
    height: { type: 'number' },
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    checkParent(this.el, 'a-room');

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) rebuildParent(this.el);
    };
    this.el.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function () {
    rebuildParent(this.el);
  },
  // Catches moves that bypass setAttribute.
  tick: function () {
    if (this.el.sceneEl.systems.building?.hasWallMoved(this.el)) rebuildParent(this.el);
  },
  // A-Frame calls this when the wall leaves the document, so the room rebuilds without it.
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
    removeMesh(this.el, WALL_MESH);
    rebuildParent(this.el);
  }
});
