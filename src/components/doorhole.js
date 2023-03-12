'use strict';

const WALL = 'a-wall';

module.exports.Component = AFRAME.registerComponent('doorhole', {
  init: function () {
    const parentName = this.el.parentEl?.localName;
    if (parentName !== WALL) {
      const message = `a-doorhole elements must have an "${WALL}" parent`;
      throw new Error(message);
    }

    this.el.vertices = [];
    this.el.getDoorlink = () => this.el.sceneEl.querySelector(`a-doorlink[from="#${this.el.id}"], a-doorlink[to="#${this.el.id}"]`);
  }
});
