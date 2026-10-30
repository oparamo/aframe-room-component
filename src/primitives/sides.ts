AFRAME.registerPrimitive('a-sides', {
  defaultComponents: { sides: {}, 'room-collidable': true },
  mappings: {
    'uv-scale': 'sides.uvScale'
  }
});
