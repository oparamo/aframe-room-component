'use strict';

module.exports.Component = AFRAME.registerComponent('room', {
  schema: {
    outside: { type: 'boolean' },
    height: { type: 'number', default: 2.4 },
    width: { type: 'number' },
    length: { type: 'number' }
  },
  init: function () {
    const roomEl = this.el;
    const { outside, length, width } = roomEl?.getAttribute('room');
    const walls = Array.from(roomEl.querySelectorAll('a-wall'));

    // validate room wall count
    if (width || length) {
      if (width && length) {
        if (walls.length >= 4) {
          if (walls.length > 4) { console.warn('rooms with WIDTH and LENGTH should only have four walls!'); }
          // TODO: avoid using setAttribute for position
          // TODO: move to update function
          walls[0].setAttribute('position', { x: 0, y: 0, z: 0 });
          walls[1].setAttribute('position', { x: width, y: 0, z: 0 });
          walls[2].setAttribute('position', { x: width, y: 0, z: length });
          walls[3].setAttribute('position', { x: 0, y: 0, z: length });
        } else {
          const message = 'rooms with WIDTH and LENGTH must have four walls!';
          console.error(message);
          throw new Error(message);
        }
      } else {
        const message = 'rooms with WIDTH must also have LENGTH (and vice versa)';
        console.error(message);
        throw new Error(message);
      }
    }

    let cwSum = 0;
    for (let i = 0; i < walls.length; i++) {
      const currentWall = walls[i];
      const nextWall = walls[(i + 1) % walls.length];

      const { x: currentWallX, z: currentWallZ } = currentWall.components.position.data;
      const { x: nextWallX, z: nextWallZ } = nextWall.components.position.data;

      cwSum += (nextWallX - currentWallX) * (nextWallZ + currentWallZ);
    }

    let shouldReverse = false;
    if (cwSum > 0) { shouldReverse = !shouldReverse; }
    if (outside) { shouldReverse = !shouldReverse; }
    if (shouldReverse) { walls.reverse(); }

    // link next wall for convenience
    for (let i = 0; i < walls.length; i++) {
      const currentWall = walls[i];
      const nextWall = walls[(i + 1) % walls.length];

      currentWall.nextWall = nextWall;
    }

    roomEl.ceiling = roomEl.querySelector('a-ceiling');
    roomEl.floor = roomEl.querySelector('a-floor');
    roomEl.walls = walls;

    roomEl.sceneEl.systems?.building?.registerRoom(roomEl);
  },
  update: function () {
    console.info('updating room');
    this.el.sceneEl.systems?.building?.examineBuilding();
  },
  remove: function () {
    this.el.sceneEl.systems?.building?.unregisterRoom(this.el);
  }
});
