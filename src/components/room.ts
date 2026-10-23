import type { Component } from '../types/aframe';
import type { BuildingEl, RoomData, RoomEl, WallEl } from '../types/elements';
import { isTransformChange } from './shared';

interface RoomComponent extends Component<RoomData, RoomEl> {
  _onTransformChanged: (event: Event) => void;
}

// Why the room's dimensions and wall count don't fit together, or null when they do.
const roomShapeError = ({ width, length }: RoomData, wallCount: number): string | null => {
  const dimensions = [width, length].filter(Boolean).length;
  if (dimensions === 1) return '<a-room> with WIDTH must also have LENGTH (and vice versa).';
  if (dimensions === 2 && wallCount !== 4) return '<a-room> with WIDTH and LENGTH must have four walls.';
  if (dimensions === 0 && wallCount < 3) return '<a-room> needs at least 3 walls.';
  return null;
};

AFRAME.registerComponent<RoomComponent>('room', {
  schema: {
    outside: { type: 'boolean' },
    height: { type: 'number', default: 2.4 },
    width: { type: 'number' },
    length: { type: 'number' }
  },
  init: function () {
    const roomEl = this.el;
    const walls = Array.from(roomEl.querySelectorAll<WallEl>('a-wall'));

    const error = roomShapeError(this.data, walls.length);
    if (error) {
      console.error(error);
      throw new Error(error);
    }

    roomEl.ceiling = roomEl.querySelector<BuildingEl>('a-ceiling');
    roomEl.floor = roomEl.querySelector<BuildingEl>('a-floor');
    roomEl.walls = walls;
    roomEl.object3D.visible = false;

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) {
        roomEl.sceneEl.systems.building?.buildRoom(roomEl);
      }
    };
    roomEl.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function () {
    this.el.sceneEl.systems.building?.buildRoom(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
  }
});
