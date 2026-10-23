import type { Matrix4 } from 'three';
import type { Entity } from '../types/aframe';

// Records the element's world transform as of a rebuild, so later checks can tell whether it has moved since.
const snapshotWorldMatrix = (el: Entity, snapshot: Matrix4): void => {
  el.object3D.updateWorldMatrix(true, false);
  snapshot.copy(el.object3D.matrixWorld);
};

// Updates matrixWorld before comparing: a componentchanged listener runs before the next render
// would update it, and while the inspector has the scene paused.
const hasMovedSince = (el: Entity, snapshot: Matrix4): boolean => {
  el.object3D.updateWorldMatrix(true, false);
  return !el.object3D.matrixWorld.equals(snapshot);
};

const requireParent = (el: Entity, ...allowed: string[]): void => {
  if (!allowed.includes(el.parentEl?.localName ?? '')) {
    throw new Error(`<${el.localName}> must be a child of a ${allowed.map(n => `<${n}>`).join(' or ')}.`);
  }
};

export { hasMovedSince, requireParent, snapshotWorldMatrix };
