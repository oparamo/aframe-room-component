export const TRANSFORM_PROPS = new Set(['position', 'rotation', 'scale']);

export const requireParent = (el, ...allowed) => {
  if (!allowed.includes(el.parentEl?.localName)) {
    throw new Error(`<${el.localName}> must be a child of a ${allowed.map(n => `<${n}>`).join(' or ')}.`);
  }
};
