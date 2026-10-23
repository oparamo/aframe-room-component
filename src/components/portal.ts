import type { Matrix4 } from 'three';
import type { Component } from '../types/aframe';
import type { PortalData, PortalEl } from '../types/elements';
import { hasMovedSince, requireParent, snapshotWorldMatrix } from './shared';

interface PortalComponent extends Component<PortalData, PortalEl> {
  _onComponentChanged: () => void;
  _builtMatrix: Matrix4;
  rebuild(): void;
  _rebuildIfMoved(): void;
}

AFRAME.registerComponent<PortalComponent>('portal', {
  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    height: { type: 'number', default: 2.0 },
    width: { type: 'number', default: 0.8 },
    floorHeight: { type: 'number', default: 0 }
  },
  init: function () {
    requireParent(this.el, 'a-scene', 'a-wall');

    this._builtMatrix = new THREE.Matrix4();

    this._onComponentChanged = () => {
      this._rebuildIfMoved();
    };
    this.el.addEventListener('componentchanged', this._onComponentChanged);
  },
  update: function () {
    this.rebuild();
  },
  tick: function () {
    this._rebuildIfMoved();
  },
  // Public: queues this portal, and the rooms it cuts into, for the next build pass.
  rebuild: function () {
    snapshotWorldMatrix(this.el, this._builtMatrix);
    this.el.sceneEl.systems.building?.buildPortal(this.el);
  },
  // tick catches movement that bypasses setAttribute, such as the animation component since
  // A-Frame 1.7. componentchanged covers the inspector, which pauses the scene and with it tick.
  _rebuildIfMoved: function () {
    if (hasMovedSince(this.el, this._builtMatrix)) this.rebuild();
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onComponentChanged);
  }
});
