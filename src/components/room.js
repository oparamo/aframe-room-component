'use strict';

module.exports.Component = AFRAME.registerComponent('room', {
  schema: {
    outside: { type: 'boolean' },
    height: { type: 'number', default: 2.4 },
    width: { type: 'number' },
    length: { type: 'number' }
  },
  // TODO: move most of this to update function
  init: function () {
    console.info('initializing room');

    const roomEl = this.el;
    const { outside, length, width } = roomEl?.getAttribute('room');
    const walls = Array.from(roomEl.querySelectorAll('a-wall'));

    if ((width || length) && (!width || !length)) {
      const message = 'rooms with WIDTH must also have LENGTH (and vice versa)';
      console.error(message);
      throw new Error(message);
    }

    if (width && length) {
      if (walls.length !== 4) {
        const message = 'rooms with WIDTH and LENGTH must have four walls!';
        console.error(message);
        throw new Error(message);
      }

      // TODO: avoid using setAttribute for position
      walls[0].setAttribute('position', { x: 0, y: 0, z: 0 });
      walls[1].setAttribute('position', { x: width, y: 0, z: 0 });
      walls[2].setAttribute('position', { x: width, y: 0, z: length });
      walls[3].setAttribute('position', { x: 0, y: 0, z: length });
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

    // lay out walls' angles:
    // link next wall for convenience
    for (let i = 0; i < walls.length; i++) {
      const currentWall = walls[i];
      const nextWall = walls[(i + 1) % walls.length];

      currentWall.nextWall = nextWall;

      const wallGapX = nextWall.components.position.data.x - currentWall.components.position.data.x;
      const wallGapZ = nextWall.components.position.data.z - currentWall.components.position.data.z;
      const wallAngle = Math.atan2(wallGapZ, wallGapX);

      // TODO: avoid using set attribute for rotation
      currentWall.setAttribute('rotation', { x: 0, y: -wallAngle / Math.PI * 180, z: 0 });
      currentWall.object3D.updateMatrixWorld();
    }

    roomEl.ceiling = roomEl.querySelector('a-ceiling');
    roomEl.floor = roomEl.querySelector('a-floor');
    roomEl.walls = walls;

    roomEl.sceneEl.systems?.building?.registerRoom(roomEl);

    this.el.sceneEl.systems?.building?.examineBuilding();
  },
  remove: function () {
    this.el.sceneEl.systems?.building?.unregisterRoom(this.el);
  }
});
