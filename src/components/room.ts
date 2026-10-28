import type { Matrix4 } from 'three';
import type { Component } from '../types/aframe';
import type { BuildingEl, RoomData, RoomEl, WallEl } from '../types/elements';
import { hasMovedSince, isTransformChange, snapshotWorldMatrix } from './helpers/transforms';

interface RoomComponent extends Component<RoomData, RoomEl> {
  _onTransformChanged: (event: Event) => void;
  _builtMatrix: Matrix4;
  rebuild(): void;
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
    if (error) throw new Error(error);

    roomEl.ceiling = roomEl.querySelector<BuildingEl>('a-ceiling');
    roomEl.floor = roomEl.querySelector<BuildingEl>('a-floor');
    roomEl.walls = walls;
    roomEl.object3D.visible = false;

    this._builtMatrix = new THREE.Matrix4();

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) this.rebuild();
    };
    roomEl.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function () {
    this.rebuild();
  },
  // Catches movement that bypasses setAttribute, such as the animation component since A-Frame 1.7.
  // The componentchanged listener stays for the inspector, which pauses the scene and with it tick.
  tick: function () {
    if (hasMovedSince(this.el, this._builtMatrix)) this.rebuild();
  },
  // Public: queues this room, and the portals connected to it, for the next build pass.
  rebuild: function () {
    snapshotWorldMatrix(this.el, this._builtMatrix);
    this.el.sceneEl.systems.building?.buildRoom(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
    this.el.sceneEl.systems.building?.removeRoom(this.el);
  }
});
