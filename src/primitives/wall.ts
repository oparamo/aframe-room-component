AFRAME.registerPrimitive('a-wall', {
  defaultComponents: { wall: {} },
  mappings: {
    height: 'wall.height',
    'uv-scale': 'wall.uvScale',
    collidable: 'wall.collidable'
  }
});
