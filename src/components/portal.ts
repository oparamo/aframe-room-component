import type { Component } from '../types/aframe';
import type { PortalData, PortalEl } from '../types/elements';
import { requireParent } from './helpers/hierarchy';
import { isTransformChange } from './helpers/transforms';

interface PortalComponent extends Component<PortalData, PortalEl> {
  _onTransformChanged: (event: Event) => void;
  rebuild(): void;
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

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) this.rebuild();
    };
    this.el.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function (oldData) {
    this.el.sceneEl.systems.building?.linkPortal(this.el, oldData);
    this.rebuild();
  },
  // Catches movement that bypasses setAttribute, such as the animation component since A-Frame 1.7.
  // The componentchanged listener stays for the inspector, which pauses the scene and with it tick.
  tick: function () {
    if (this.el.sceneEl.systems.building?.hasMoved(this.el)) this.rebuild();
  },
  // Public: queues this portal, and the rooms it cuts into, for the next build pass.
  rebuild: function () {
    this.el.sceneEl.systems.building?.buildPortal(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
    this.el.sceneEl.systems.building?.removePortal(this.el);
  }
});
