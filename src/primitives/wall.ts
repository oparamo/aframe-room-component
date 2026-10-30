AFRAME.registerPrimitive('a-wall', {
  defaultComponents: { wall: {}, 'room-collidable': true },
  mappings: {
    height: 'wall.height',
    'uv-scale': 'wall.uvScale',
    collidable: 'room-collidable'
  }
});
