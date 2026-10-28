const TRANSFORM_PROPS = new Set(['position', 'rotation', 'scale']);

// A-Frame dispatches componentchanged as a CustomEvent, but DOM listeners only receive Event.
const isTransformChange = (event: Event): boolean =>
  TRANSFORM_PROPS.has((event as CustomEvent<{ name: string }>).detail.name);

export { isTransformChange, TRANSFORM_PROPS };
