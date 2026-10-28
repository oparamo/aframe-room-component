import type { Entity } from '../../types/aframe';
import type { BuildingEl } from '../../types/elements';
import { nameOf } from '../../builders/helpers/structure';

// Queues the parent room or portal for a rebuild. While the scene first loads, children initialize
// before their parent, so the parent's component is missing here and its own update does the build.
const rebuildParent = (el: BuildingEl | null): void => {
  const parentComponents = el?.parentEl?.components;
  (parentComponents?.room ?? parentComponents?.portal)?.rebuild();
};

// Logs a markup error when the element's parent isn't one of the allowed tags. The element is left
// in place; nothing builds it, since no room or portal is its parent.
const checkParent = (el: Entity, ...allowed: string[]): void => {
  if (allowed.includes(el.parentEl?.localName ?? '')) return;
  console.error(`${nameOf(el)} must be a child of a ${allowed.map(n => `<${n}>`).join(' or ')}; it was skipped.`, el);
};

export { checkParent, rebuildParent };
