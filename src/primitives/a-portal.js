AFRAME.registerPrimitive('a-portal', {
  defaultComponents: { portal: {} },
  mappings: {
    from: 'portal.from',
    to: 'portal.to',
    height: 'portal.height',
    width: 'portal.width',
    'floor-height': 'portal.floorHeight'
  }
});
