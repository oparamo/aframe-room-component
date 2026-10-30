AFRAME.registerPrimitive('a-floor', {
  defaultComponents: { floor: {}, 'room-collidable': true },
  mappings: {
    'uv-scale': 'floor.uvScale'
  }
});
