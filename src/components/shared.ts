import type { Entity } from '../types/aframe';

export const TRANSFORM_PROPS = new Set(['position', 'rotation', 'scale']);

// A-Frame dispatches componentchanged as a CustomEvent, but DOM listeners only receive Event.
export const isTransformChange = (event: Event): boolean =>
  TRANSFORM_PROPS.has((event as CustomEvent<{ name: string }>).detail.name);

export const requireParent = (el: Entity, ...allowed: string[]): void => {
  if (!allowed.includes(el.parentEl?.localName ?? '')) {
    throw new Error(`<${el.localName}> must be a child of a ${allowed.map(n => `<${n}>`).join(' or ')}.`);
  }
};
