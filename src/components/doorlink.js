const SCENE = 'a-scene';
const WALL = 'a-wall';

AFRAME.registerComponent('doorlink', {
  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    height: { type: 'number', default: 2.0 },
    width: { type: 'number', default: 0.8 }
  },
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== SCENE && parentName !== WALL) {
      const message = `<a-doorlink> must be a child of a <${SCENE}> or <${WALL}>.`;
      throw new Error(message);
    }

    this.el.addEventListener('componentchanged', (e) => {
      if (e.detail.name === 'position' || e.detail.name === 'rotation' || e.detail.name === 'scale') {
        this.el.sceneEl.systems?.building?.buildDoorlink(this.el);
      }
    });
  },
  update: function () {
    this.el.sceneEl.systems?.building?.buildDoorlink(this.el);
  }
});
