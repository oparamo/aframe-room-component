import type { Component } from '../types/aframe';
import type { RoomData, RoomEl } from '../types/elements';
import { nameOf, wallsOf } from '../builders/helpers/structure';
import { isMaterialRemoval } from './helpers/material';
import { isTransformChange } from './helpers/transforms';

interface RoomComponent extends Component<RoomData, RoomEl> {
  _onTransformChanged: (event: Event) => void;
  _onMaterialRemoved: (event: Event) => void;
  // Why the room can't be built, from its markup when it initialized; null when it can.
  _shapeError: string | null;
  rebuild(): void;
}

// Why the room's dimensions and wall count don't fit together, or null when they do.
const roomShapeError = ({ width, length }: RoomData, wallCount: number): string | null => {
  const dimensions = [width, length].filter(Boolean).length;
  if (dimensions === 1) return 'WIDTH needs LENGTH, and LENGTH needs WIDTH';
  if (dimensions === 2 && wallCount !== 4) return 'with WIDTH and LENGTH it must have four walls';
  if (dimensions === 0 && wallCount < 3) return 'it needs at least 3 walls';
  return null;
};

// A width/length room places its walls itself, so a position written on one has no effect.
const warnAuthoredPositions = (roomEl: RoomEl) => {
  for (const wallEl of wallsOf(roomEl).filter(el => el.hasAttribute('position'))) {
    console.warn(`${nameOf(roomEl)} has WIDTH and LENGTH, so the position of this wall is ignored.`, wallEl);
  }
};

AFRAME.registerComponent<RoomComponent>('room', {
  schema: {
    outside: { type: 'boolean' },
    height: { type: 'number', default: 2.4 },
    width: { type: 'number' },
    length: { type: 'number' },
    passable: { type: 'boolean' }
  },
  init: function () {
    this._shapeError = roomShapeError(this.data, wallsOf(this.el).length);
    if (this._shapeError) {
      console.error(`${nameOf(this.el)} was not built: ${this._shapeError}.`, this.el);
    } else if (this.el.object3D.visible) {
      // Markup's visible="false" has already applied, since A-Frame initializes visible first.
      this.el.sceneEl.systems['room-building']?.hideUntilBuilt(this.el);
    }
    if (this.data.width && this.data.length) warnAuthoredPositions(this.el);

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) this.rebuild();
    };
    this.el.addEventListener('componentchanged', this._onTransformChanged);
    // Walls without a material of their own still hold the removed one until the room rebuilds.
    this._onMaterialRemoved = (event) => {
      if (isMaterialRemoval(event)) this.rebuild();
    };
    this.el.addEventListener('componentremoved', this._onMaterialRemoved);
  },
  update: function () {
    this.rebuild();
  },
  // Catches movement that bypasses setAttribute, such as the animation component since A-Frame 1.7.
  // The componentchanged listener stays for the inspector, which pauses the scene and with it tick.
  tick: function () {
    if (this.el.sceneEl.systems['room-building']?.hasMoved(this.el)) this.rebuild();
  },
  // Public: queues this room, and the portals connected to it, for the next build pass.
  rebuild: function () {
    if (this._shapeError) return;
    this.el.sceneEl.systems['room-building']?.buildRoom(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
    this.el.removeEventListener('componentremoved', this._onMaterialRemoved);
    this.el.sceneEl.systems['room-building']?.removeRoom(this.el);
  }
});
