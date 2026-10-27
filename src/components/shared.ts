import type { Matrix4 } from 'three';
import type { Entity } from '../types/aframe';
import type { BuildingEl } from '../types/elements';

const TRANSFORM_PROPS = new Set(['position', 'rotation', 'scale']);

// A-Frame dispatches componentchanged as a CustomEvent, but DOM listeners only receive Event.
const isTransformChange = (event: Event): boolean =>
  TRANSFORM_PROPS.has((event as CustomEvent<{ name: string }>).detail.name);

// Records the element's world transform as of a rebuild, so tick can tell when it has moved since.
const snapshotWorldMatrix = (el: Entity, snapshot: Matrix4): void => {
  el.object3D.updateWorldMatrix(true, false);
  snapshot.copy(el.object3D.matrixWorld);
};

const hasMovedSince = (el: Entity, snapshot: Matrix4): boolean => !el.object3D.matrixWorld.equals(snapshot);

// Queues the parent room or portal for a rebuild. While the scene first loads, children initialize
// before their parent, so the parent's component is missing here and its own update does the build.
const rebuildParent = (el: BuildingEl): void => {
  const parentComponents = el.parentEl?.components;
  (parentComponents?.room ?? parentComponents?.portal)?.rebuild();
};

const requireParent = (el: Entity, ...allowed: string[]): void => {
  if (!allowed.includes(el.parentEl?.localName ?? '')) {
    throw new Error(`<${el.localName}> must be a child of a ${allowed.map(n => `<${n}>`).join(' or ')}.`);
  }
};

export { hasMovedSince, isTransformChange, rebuildParent, requireParent, snapshotWorldMatrix, TRANSFORM_PROPS };
