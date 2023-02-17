'use strict';

AFRAME.registerPrimitive('a-doorlink', {
  defaultComponents: { doorlink: {} },
  mappings: {
    from: 'doorlink.from',
    to: 'doorlink.to',
    height: 'doorlink.height',
    width: 'doorlink.width'
  }
});
