// A-Frame dispatches componentremoved as a CustomEvent, but DOM listeners only receive Event.
const isMaterialRemoval = (event: Event): boolean =>
  (event as CustomEvent<{ name: string }>).detail.name === 'material';

export { isMaterialRemoval };
