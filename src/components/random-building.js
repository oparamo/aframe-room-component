'use strict';

module.exports.Component = AFRAME.registerComponent('random-building', {
  schema: {
    minRoomSize: { type: 'vec3', default: { x: 2, y: 2, z: 2 } },
    maxRoomSize: { type: 'vec3', default: { x: 3, y: 4, z: 3 } },
    minRooms: { type: 'int', default: 1 },
    maxRooms: { type: 'int', default: 5 },
    boundary: { type: 'vec3', default: { x: 20, y: 0, z: 20 } },
    maxPositionAttempts: { type: 'int', default: 50 }
  },

  init: function () {
    this.generateBuilding();
  },

  generateBuilding: function () {
    const { minRoomSize, maxRoomSize, minRooms, maxRooms, boundary, maxPositionAttempts } = this.data;

    const numRooms = Math.floor(Math.random() * (maxRooms - minRooms + 1) + minRooms);
    const rooms = [];

    let positionAttempts = 0;
    for (let i = 0; i < numRooms && positionAttempts != maxPositionAttempts; i++) {
      const roomSize = {
        x: Math.random() * (maxRoomSize.x - minRoomSize.x) + minRoomSize.x,
        y: Math.random() * (maxRoomSize.y - minRoomSize.y) + minRoomSize.y,
        z: Math.random() * (maxRoomSize.z - minRoomSize.z) + minRoomSize.z
      };

      for (positionAttempts = 0; positionAttempts < maxPositionAttempts; positionAttempts++) {
        const roomPosition = {
          x: Math.random() * boundary.x,
          y: 0,
          z: Math.random() * boundary.z
        };

        const collision = this.checkCollision(roomPosition, roomSize, rooms);
        if (!collision) {
          const newRoom = this.createRoom(roomSize, roomPosition);
          rooms.push(newRoom);
          this.el.appendChild(newRoom.room);
          break;
        } else {
          roomSize.x = Math.max(minRoomSize.x, roomSize.x * 0.9);
          roomSize.z = Math.max(minRoomSize.z, roomSize.z * 0.9);
        }
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
