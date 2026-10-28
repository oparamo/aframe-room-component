import type { Entity } from '../../types/aframe';
import type { BuildingEl } from '../../types/elements';

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

export { rebuildParent, requireParent };
