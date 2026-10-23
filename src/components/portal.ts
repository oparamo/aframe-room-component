import type { Component } from '../types/aframe';
import type { PortalData, PortalEl } from '../types/elements';
import { REBUILD_EVENT, isTransformChange, requireParent } from './shared';

interface PortalComponent extends Component<PortalData, PortalEl> {
  _onTransformChanged: (event: Event) => void;
  _onRebuildRequest: () => void;
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

    // Events bubble, so a request emitted on one of the portal's surfaces also lands here.
    this._onRebuildRequest = () => this.rebuild();
    this.el.addEventListener(REBUILD_EVENT, this._onRebuildRequest);
  },
  update: function () {
    this.rebuild();
  },
  // Public: queues this portal, and the rooms it cuts into, for the next build pass.
  rebuild: function () {
    this.el.sceneEl.systems.building?.buildPortal(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
    this.el.removeEventListener(REBUILD_EVENT, this._onRebuildRequest);
  }
});
