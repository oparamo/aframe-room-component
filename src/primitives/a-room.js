'use strict';

AFRAME.registerPrimitive('a-room', {
  defaultComponents: { room: {} },
  mappings: {
    outside: 'room.outside',
    height: 'room.height',
    width: 'room.width',
    length: 'room.length'
  }
});
