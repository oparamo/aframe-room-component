const SCENE = 'a-scene';
const WALL = 'a-wall';
const TRANSFORM_PROPS = new Set(['position', 'rotation', 'scale']);

AFRAME.registerComponent('portal', {
  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    height: { type: 'number', default: 2.0 },
    width: { type: 'number', default: 0.8 },
    floorHeight: { type: 'number', default: 0 }
  },
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== SCENE && parentName !== WALL) {
      const message = `<a-portal> must be a child of a <${SCENE}> or <${WALL}>.`;
      throw new Error(message);
    }

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
