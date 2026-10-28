import type { Component } from '../types/aframe';
import type { RoomData, RoomEl } from '../types/elements';
import { wallsOf } from '../builders/helpers/structure';
import { isTransformChange } from './helpers/transforms';

interface RoomComponent extends Component<RoomData, RoomEl> {
  _onTransformChanged: (event: Event) => void;
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
    const error = roomShapeError(this.data, wallsOf(this.el).length);
    if (error) throw new Error(error);

    this.el.object3D.visible = false;

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) this.rebuild();
    };
    this.el.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function () {
    this.rebuild();
  },
  // Catches movement that bypasses setAttribute, such as the animation component since A-Frame 1.7.
  // The componentchanged listener stays for the inspector, which pauses the scene and with it tick.
  tick: function () {
    if (this.el.sceneEl.systems.building?.hasMoved(this.el)) this.rebuild();
  },
  // Public: queues this room, and the portals connected to it, for the next build pass.
  rebuild: function () {
    this.el.sceneEl.systems.building?.buildRoom(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
    this.el.sceneEl.systems.building?.removeRoom(this.el);
  }
});
