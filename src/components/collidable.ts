import type { CollidableComponent } from '../types/collision';

// Marks an element whose mesh the player is stopped by and stands on. False switches it off for the
// element and everything inside it.
AFRAME.registerComponent<CollidableComponent>('room-collidable', {
  schema: { type: 'boolean', default: true },
  update: function () {
    this.el.sceneEl.systems['room-collision']?.updateSurface(this.el);
  },
  remove: function () {
    this.el.sceneEl.systems['room-collision']?.removeSurface(this.el);
  }
});
