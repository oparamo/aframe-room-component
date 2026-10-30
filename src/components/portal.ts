import type { Component } from '../types/aframe';
import type { PortalData, PortalEl } from '../types/elements';
import { nameOf } from '../builders/helpers/structure';
import { isTransformChange } from './helpers/transforms';

interface PortalComponent extends Component<PortalData, PortalEl> {
  _onTransformChanged: (event: Event) => void;
  _misplaced: boolean;
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
  // A portal can sit anywhere but inside an opening: the build places the opening at the portal, so
  // a portal inside one would move every time it was built.
  init: function () {
    this._misplaced = this.el.parentEl?.localName === 'a-opening';
    if (this._misplaced) console.error(`${nameOf(this.el)} can't be a child of an <a-opening>; it was skipped.`, this.el);

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) this.rebuild();
    };
    this.el.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function (oldData) {
    if (this._misplaced) return;
    this.el.sceneEl.systems['room-building']?.linkPortal(this.el, oldData);
    this.rebuild();
  },
  // Catches movement that bypasses setAttribute, such as the animation component since A-Frame 1.7.
  // The componentchanged listener stays for the inspector, which pauses the scene and with it tick.
  tick: function () {
    if (this.el.sceneEl.systems['room-building']?.hasMoved(this.el)) this.rebuild();
  },
  // Public: queues this portal, and the rooms it cuts into, for the next build pass.
  rebuild: function () {
    if (this._misplaced) return;
    this.el.sceneEl.systems['room-building']?.buildPortal(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
    this.el.sceneEl.systems['room-building']?.removePortal(this.el);
  }
});
