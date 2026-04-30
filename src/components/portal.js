import { TRANSFORM_PROPS, requireParent } from './shared';

AFRAME.registerComponent('portal', {
  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    height: { type: 'number', default: 2.0 },
    width: { type: 'number', default: 0.8 },
    floorHeight: { type: 'number', default: 0 }
  },
  init: function () {
    requireParent(this.el, 'a-scene', 'a-wall');

    this._onTransformChanged = (e) => {
      if (TRANSFORM_PROPS.has(e.detail.name)) {
        this.el.sceneEl.systems?.building?.buildPortal(this.el);
      }
    };
    this.el.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function () {
    this.el.sceneEl.systems?.building?.buildPortal(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
  }
});
