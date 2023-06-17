'use strict';

module.exports.Component = AFRAME.registerComponent('random-building', {
  schema: {
    roomCount: { type: 'int', default: 5 },
    roomMinSize: { type: 'vec3', default: { x: 3, y: 3, z: 3 } },
    roomMaxSize: { type: 'vec3', default: { x: 7, y: 7, z: 7 } },
    doorMinSize: { type: 'vec2', default: { x: 0.5, y: 1 } },
    doorMaxSize: { type: 'vec2', default: { x: 1.5, y: 2 } },
    boundingBox: { type: 'vec2', default: { x: 50, y: 50 } }
  },

  init: function () {
    this.generateBuilding();
  },

  generateBuilding: function () {
    const { roomCount, roomMinSize, roomMaxSize, doorWidth } = this.data;

    let rooms = [];
    for (let i = 0; i < roomCount; i++) {
      const room = this.createRandomRoom(roomMinSize, roomMaxSize);
      if (!this.isOverlapping(room, rooms)) {
        rooms.push(room);
        this.createRoomEntity(room);
        if (i > 0) {
          const doorLink = this.createDoorLink(rooms[i - 1], room, doorWidth);
          this.createDoorLinkEntity(doorLink);
        }
      } else {
        i--;
      }
    }
  },

  // Create a room with random dimensions and position
  createRandomRoom: function (minSize, maxSize) {
    const width = Math.random() * (maxSize.x - minSize.x) + minSize.x;
    const length = Math.random() * (maxSize.z - minSize.z) + minSize.z;
    const height = Math.random() * (maxSize.y - minSize.y) + minSize.y;
    const position = {
      x: Math.random() * (this.data.boundingBox.x - width) - (this.data.boundingBox.x - width) / 2,
      y: height / 2, // Adjust the y position to be half the height so the room rests on the ground
      z: Math.random() * (this.data.boundingBox.y - length) - (this.data.boundingBox.y - length) / 2
    };

    return { width, length, height, position };
  },

  // Check if a room overlaps with any of the other rooms
  isOverlapping: function (room, rooms) {
    for (const other of rooms) {
      if (room.position.x + room.width / 2 > other.position.x - other.width / 2 &&
        room.position.x - room.width / 2 < other.position.x + other.width / 2 &&
        room.position.z + room.height / 2 > other.position.z - other.height / 2 &&
        room.position.z - room.height / 2 < other.position.z + other.height / 2) {
        return true;
      }
    }
    return false;
  },

  // Create an A-Frame entity for the room and add it to the scene
  createRoomEntity: function (room) {
    const entity = document.createElement('a-entity');
    entity.setAttribute('geometry', {
      primitive: 'box',
      width: room.width,
      height: room.height,
      depth: room.length
    });
    entity.setAttribute('material', { color: 'lightblue' });
    entity.setAttribute('position', room.position);
    this.el.appendChild(entity);
  },

  // Calculate the start and end positions for the door link between two rooms
  createDoorLink: function (room1, room2) {
    const startPosition = {
      x: (room1.position.x + room2.position.x) / 2,
      y: room1.height / 2, // Adjust the y position to be half the height of the first room
      z: (room1.position.z + room2.position.z) / 2
    };
    const length = Math.sqrt(Math.pow(room2.position.x - room1.position.x, 2) + Math.pow(room2.position.z - room1.position.z, 2)) - (room1.width + room2.width) / 2;
    const rotation = Math.atan2(room2.position.z - room1.position.z, room2.position.x - room1.position.x) * 180 / Math.PI;
    const doorWidth = Math.random() * (this.data.doorMaxSize.x - this.data.doorMinSize.x) + this.data.doorMinSize.x;
    const doorHeight = Math.random() * (this.data.doorMaxSize.y - this.data.doorMinSize.y) + this.data.doorMinSize.y;

    return { startPosition, length, rotation, doorWidth, doorHeight };
  },

  // Create an A-Frame entity for the door link and add it to the scene
  createDoorLinkEntity: function (doorLink) {
    const entity = document.createElement('a-entity');
    entity.setAttribute('geometry', {
      primitive: 'box',
      width: doorLink.length,
      height: doorLink.doorHeight,
      depth: doorLink.doorWidth
    });
    entity.setAttribute('material', { color: 'brown' });
    entity.setAttribute('position', doorLink.startPosition);
    entity.setAttribute('rotation', { x: 0, y: doorLink.rotation, z: 0 });
    this.el.appendChild(entity);
  }
});
