'use strict';

module.exports.Component = AFRAME.registerComponent('random-building', {
  schema: {
    roomCount: { type: 'int', default: 5 },
    roomMinSize: { type: 'vec3', default: { x: 3, y: 3, z: 3 } },
    roomMaxSize: { type: 'vec3', default: { x: 7, y: 7, z: 7 } },
    doorMinSize: { type: 'vec2', default: { x: 0.5, y: 1 } },
    doorMaxSize: { type: 'vec2', default: { x: 1.5, y: 2 } },
  },

  init: function () {
    this.generateBuilding();
  },

  generateBuilding: function () {
    const { roomCount, roomMinSize, roomMaxSize } = this.data;

    const rooms = [];

    for (let i = 0; i < roomCount; i++) {
      const roomSize = {
        x: Math.random() * (roomMaxSize.x - roomMinSize.x) + roomMinSize.x,
        y: Math.random() * (roomMaxSize.y - roomMinSize.y) + roomMinSize.y,
        z: Math.random() * (roomMaxSize.z - roomMinSize.z) + roomMinSize.z
      };

      const roomPosition = {
        x: 0,
        y: roomSize.y / 2,
        z: 0
      };

      const collision = this.checkCollision(roomPosition, roomSize, rooms);
      if (!collision) {
        const newRoom = this.createRoom(roomSize, roomPosition);
        rooms.push(newRoom);
        this.el.appendChild(newRoom.room);
        break;
      } else {
        roomSize.x = Math.max(roomMinSize.x, roomSize.x * 0.9);
        roomSize.z = Math.max(roomMinSize.z, roomSize.z * 0.9);
      }
    }
  },

  checkCollision: function (roomPosition, roomSize, rooms) {
    for (const otherRoom of rooms) {
      const xOverlap = Math.abs(roomPosition.x - otherRoom.position.x) < (roomSize.x + otherRoom.size.x) / 2;
      const zOverlap = Math.abs(roomPosition.z - otherRoom.position.z) < (roomSize.z + otherRoom.size.z) / 2;

      if (xOverlap && zOverlap) {
        return true;
      }
    }

    return false;
  },

  // Check if a room overlaps with any of the other rooms
  // isOverlapping: function (room, rooms) {
  //   for (const other of rooms) {
  //     if (room.position.x + room.width / 2 > other.position.x - other.width / 2 &&
  //       room.position.x - room.width / 2 < other.position.x + other.width / 2 &&
  //       room.position.z + room.height / 2 > other.position.z - other.height / 2 &&
  //       room.position.z - room.height / 2 < other.position.z + other.height / 2) {
  //       return true;
  //     }
  //   }
  //   return false;
  // },

  createRoom: function (roomSize, roomPosition) {
    const room = document.createElement('a-entity');
    room.setAttribute('geometry', {
      primitive: 'box',
      width: roomSize.x,
      height: roomSize.y,
      depth: roomSize.z
    });
    room.setAttribute('position', roomPosition);

    return { room: room, position: roomPosition, size: roomSize };
  }
});
