export const makeObject3D = (x = 0, y = 0, z = 0) => ({
  position: { x, y, z, set (nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } },
  rotation: { y: 0 },
  localToWorld (v) { return v; },
  worldToLocal (v) { return v; },
  getWorldPosition (target) { target.x = this.position.x; target.y = this.position.y; target.z = this.position.z; return target; }
});

export const makeCap = (parentMaterial) => ({
  mesh: null,
  components: {},
  classList: { add: () => {} },
  parentEl: { components: { material: { material: parentMaterial } } },
  getAttribute () { return { uvScale: 1 }; },
  setObject3D (_name, mesh) { this.mesh = mesh; }
});

export const makeWall = (x = 0, z = 0, height = 3, openings = [], y = 0) => ({
  object3D: makeObject3D(x, y, z),
  openings,
  getHeight () { return height; },
  getAttribute (attr) { if (attr === 'wall') return { height, uvScale: 1 }; return null; },
  components: {},
  parentEl: { components: {} },
  mesh: null,
  nextWallEl: null,
  classList: { add: () => {} },
  setObject3D (_name, mesh) { this.mesh = mesh; }
});

export const makeRoom = (walls, { outside = false, width = null, length = null } = {}) => ({
  getAttribute (attr) {
    if (attr === 'room') return { outside, width, length };
    return null;
  },
  walls,
  floor: makeCap(null),
  ceiling: makeCap(null),
  object3D: { visible: false }
});

export const makeSquareRoom = (opts) => makeRoom([
  makeWall(0, 0),
  makeWall(5, 0),
  makeWall(5, 5),
  makeWall(0, 5)
], opts);

// Convenience for building system tests: builds a room with one wall per portal.
export const makeRoomWithLinks = (...portals) =>
  makeRoom(portals.map(p => makeWall(0, 0, 3, [makeOpening(p)])));

export const makeOpening = (portalEl) => ({
  object3D: makeObject3D(),
  vertices: [],
  getPortal () { return portalEl; },
  parentEl: null,
  setObject3D () {}
});

export const makeVertex = (x, y, z) => new THREE.Vector3(x, y, z);

export const makeOpeningVerts = (x, width, height) => [
  makeVertex(x - width / 2, 0, 0),
  makeVertex(x - width / 2, height, 0),
  makeVertex(x + width / 2, 0, 0),
  makeVertex(x + width / 2, height, 0)
];

export const makePortalChild = (type) => ({
  components: {
    [type]: {},
    material: { material: null }
  },
  parentEl: { components: {} },
  object3D: makeObject3D(),
  mesh: null,
  classList: { add: () => {} },
  getAttribute () { return { uvScale: 1 }; },
  setObject3D (_name, mesh) { this.mesh = mesh; }
});

// Unified portal mock. Supports geometry tests via fromVerts/toVerts/children
// (getAttribute interface) and system tests via roomA/roomB (components.portal.data interface).
export const makePortal = ({ fromVerts, toVerts, children, roomA, roomB } = {}) => ({
  getAttribute (attr) {
    if (attr === 'portal') return { from: { vertices: fromVerts }, to: { vertices: toVerts }, floorHeight: 0 };
    return null;
  },
  components: {
    portal: {
      data: {
        from: roomA ? { parentEl: { parentEl: roomA } } : null,
        to: roomB ? { parentEl: { parentEl: roomB } } : null
      }
    }
  },
  children
});

export const makeSystem = () => ({
  ...global.AFRAME._systems.building,
  el: { emit: () => {}, object3D: { updateMatrixWorld: () => {} } },
  dirtyRooms: new Set(),
  dirtyPortals: new Set(),
  buildPending: false
});

export const makeCollisionEl = ({
  position = new THREE.Vector3(),
  cameraY = 1.6,
  wallCollidables = [],
  floorCollidables = [],
  childCamera = false
} = {}) => {
  const cameraObjEl = childCamera ? {
    object3D: {
      getWorldPosition (target) { target.set(position.x, cameraY, position.z); return target; }
    }
  } : null;

  return {
    object3D: {
      position,
      getWorldPosition (target) { target.copy(position); return target; }
    },
    querySelector: () => cameraObjEl,
    components: {},
    sceneEl: {
      addEventListener (event, cb) { if (event === 'loaded') cb(); },
      removeEventListener () {},
      querySelectorAll: (sel) => sel === '.collidable' ? wallCollidables : floorCollidables
    }
  };
};

export const makeCollisionComponent = (el, data = { radius: 0.4 }) => {
  const comp = { ...global.AFRAME._components['room-collision'], el, data };
  comp.init.call(comp);
  return comp;
};
