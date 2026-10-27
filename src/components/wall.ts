import type { Component } from '../types/aframe';
import type { OpeningEl, WallData, WallEl } from '../types/elements';
import { isTransformChange, rebuildParent, requireParent } from './shared';

interface WallComponent extends Component<WallData, WallEl> {
  _onTransformChanged: (event: Event) => void;
}

AFRAME.registerComponent<WallComponent>('wall', {
  schema: {
    height: { type: 'number' },
    uvScale: { type: 'number', default: 1 }
  },
  init: function () {
    requireParent(this.el, 'a-room');

    const openings = Array.from(this.el.querySelectorAll<OpeningEl>('a-opening'));
    this.el.openings = openings.sort((a, b) => a.object3D.position.x - b.object3D.position.x);

    this.el.getHeight = () => this.el.getAttribute('wall').height || this.el.parentEl.getAttribute('room').height;

    this._onTransformChanged = (event) => {
      if (isTransformChange(event)) rebuildParent(this.el);
    };
    this.el.addEventListener('componentchanged', this._onTransformChanged);
  },
  update: function () {
    rebuildParent(this.el);
  },
  // Catches moves that bypass setAttribute. The build sets each wall's rotation, so only position counts.
  // Recording the new position right away keeps the frames before the build runs from queuing it again.
  tick: function () {
    const { builtPosition, object3D } = this.el;
    if (!builtPosition || builtPosition.equals(object3D.position)) return;
    builtPosition.copy(object3D.position);
    rebuildParent(this.el);
  },
  remove: function () {
    this.el.removeEventListener('componentchanged', this._onTransformChanged);
  }
});
