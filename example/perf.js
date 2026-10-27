const DEFAULT_ROOMS = 100;
const ROOM_COUNT_KEYS = { 1: 25, 2: 100, 3: 400 };
const ROOM_SIZE = 4;
const SPACING = ROOM_SIZE + 0.3;
const OUR_COMPONENTS = ['room', 'portal', 'wall'];
const REPORT_MS = 1000;
const LOOK_DOWN = -0.6;
const FACING_EAST = -Math.PI / 2;
const EYE_HEIGHT = 1.6;

const scene = document.querySelector('a-scene');
const player = document.getElementById('player');
const readout = document.getElementById('readout');

const roomCount = Number(new URLSearchParams(location.search).get('rooms')) || DEFAULT_ROOMS;
const columns = Math.ceil(Math.sqrt(roomCount));
const rows = Math.ceil(roomCount / columns);

// --- Scene: a grid of rooms, each joined to its east neighbor by a doorway. ---

const colorFor = index => `#${new THREE.Color().setHSL((index * 0.13) % 1, 0.45, 0.7).getHexString()}`;

const roomCorner = index => ({ x: (index % columns) * SPACING, z: Math.floor(index / columns) * SPACING });

const roomMarkup = (index) => {
  const { x, z } = roomCorner(index);
  return `<a-room id="room${index}" position="${x} 0 ${z}" width="${ROOM_SIZE}" length="${ROOM_SIZE}"
      height="2.6" material="color: ${colorFor(index)}">
    <a-wall></a-wall>
    <a-wall><a-opening id="east${index}"></a-opening></a-wall>
    <a-wall></a-wall>
    <a-wall><a-opening id="west${index}"></a-opening></a-wall>
    <a-floor material="color: #bbb"></a-floor>
    <a-ceiling material="color: #eee"></a-ceiling>
  </a-room>`;
};

const portalMarkup = (index) => {
  const x = (index % columns) * SPACING + ROOM_SIZE + (SPACING - ROOM_SIZE) / 2;
  const z = Math.floor(index / columns) * SPACING + ROOM_SIZE / 2;
  return `<a-portal from="#east${index}" to="#west${index + 1}" position="${x} 0 ${z}" width="1" height="2">
    <a-floor material="color: #999"></a-floor>
    <a-ceiling material="color: #ddd"></a-ceiling>
    <a-sides material="color: #ccc"></a-sides>
  </a-portal>`;
};

const hasEastNeighbor = index => index % columns < columns - 1 && index + 1 < roomCount;

const indices = Array.from({ length: roomCount }, (_, index) => index);
const portalIndices = indices.filter(hasEastNeighbor);
scene.insertAdjacentHTML('beforeend', [...indices.map(roomMarkup), ...portalIndices.map(portalMarkup)].join(''));

// --- Where the player stands. ---

// South of the grid, high enough to see all of it.
const gridWidth = columns * SPACING;
const gridDepth = rows * SPACING;
const OVERVIEW = {
  position: `${gridWidth / 2} ${Math.max(8, gridWidth * 0.6)} ${gridDepth + 6}`,
  pitch: LOOK_DOWN,
  yaw: 0,
  acceleration: 200,
  collision: false
};

// In the room nearest the middle of the grid, facing east along its row of doorways.
const middleRoom = Math.min(roomCount - 1, Math.floor(rows / 2) * columns + Math.floor(columns / 2));
const middleCorner = roomCorner(middleRoom);
const INSIDE = {
  position: `${middleCorner.x + ROOM_SIZE / 2} ${EYE_HEIGHT} ${middleCorner.z + ROOM_SIZE / 2}`,
  pitch: 0,
  yaw: FACING_EAST,
  acceleration: 65,
  collision: true
};

// Collision comes off before the jump, so it doesn't treat the jump as a step to block.
const placePlayer = ({ position, pitch, yaw, acceleration, collision }) => {
  player.removeAttribute('room-collision');
  player.setAttribute('position', position);
  player.setAttribute('wasd-controls', 'acceleration', acceleration);
  const look = player.components['look-controls'];
  look.pitchObject.rotation.x = pitch;
  look.yawObject.rotation.y = yaw;
  if (collision) player.setAttribute('room-collision', '');
};

scene.addEventListener('loaded', () => {
  placePlayer(OVERVIEW);
});

// --- Measuring: time each of our components' tick pass, and let them be paused. ---

let ticksPaused = false;
for (const name of OUR_COMPONENTS) {
  const proto = AFRAME.components[name].Component.prototype;
  const tick = proto.tick;
  proto.tick = function (time, delta) {
    if (!ticksPaused) tick.call(this, time, delta);
  };
}

const tickTotals = Object.fromEntries(OUR_COMPONENTS.map(name => [name, 0]));
let framesSinceReport = 0;

const runBehaviorSet = (sceneEl, behaviorSet, { behavior, time, delta }) => {
  behaviorSet.inUse = true;
  for (const component of behaviorSet.array) {
    if (component.isPlaying) component[behavior](time, delta);
  }
  behaviorSet.inUse = false;
  for (const component of behaviorSet.markedForRemoval) sceneEl.removeBehavior(component);
  behaviorSet.markedForRemoval.length = 0;
};

const isTimed = (behavior, name) => behavior === 'tick' && name in tickTotals;

// The same loop as A-Frame 1.8's callComponentBehaviors, with our components' tick passes timed.
// Browsers round performance.now() (to 0.1ms in Chrome), so the averages need many frames.
scene.callComponentBehaviors = function (behavior, time, delta) {
  if (behavior === 'tick') framesSinceReport++;
  for (const name of this.componentOrder) {
    const behaviorSet = this.behaviors[name]?.[behavior];
    if (!behaviorSet) continue;
    const start = performance.now();
    runBehaviorSet(this, behaviorSet, { behavior, time, delta });
    if (isTimed(behavior, name)) tickTotals[name] += performance.now() - start;
  }
};

// --- Readout and keys. ---

const microsPerFrame = millis => (millis * 1000 / Math.max(1, framesSinceReport)).toFixed(1);

const tickSummary = () => {
  if (ticksPaused) return 'our ticks PAUSED';
  const total = Object.values(tickTotals).reduce((sum, millis) => sum + millis, 0);
  const parts = OUR_COMPONENTS.map(name => `${name} ${microsPerFrame(tickTotals[name])}`);
  return `our ticks ${microsPerFrame(total)} µs/frame (${parts.join(', ')})`;
};

// --- Rendering comparisons: pixel ratio and material cost. ---

let lowResolution = false;
const togglePixelRatio = () => {
  lowResolution = !lowResolution;
  const ratio = lowResolution ? 1 : window.devicePixelRatio;
  scene.renderer.setPixelRatio(ratio);
};

// Swaps every mesh's material for an unlit copy with the same color and texture, and back. A room that
// rebuilds while flat gets its own materials back.
let flatMaterials = false;
const flatCopies = new Map();
const originalMaterials = new Map();

const flatCopyOf = (material) => {
  if (!flatCopies.has(material)) {
    const { color, map, side, visible, transparent, opacity } = material;
    flatCopies.set(material, new THREE.MeshBasicMaterial({ color, map, side, visible, transparent, opacity }));
  }
  return flatCopies.get(material);
};

const flatten = (mesh) => {
  originalMaterials.set(mesh, mesh.material);
  mesh.material = flatCopyOf(mesh.material);
};

const restore = (mesh) => {
  mesh.material = originalMaterials.get(mesh) ?? mesh.material;
};

const toggleFlatMaterials = () => {
  flatMaterials = !flatMaterials;
  const apply = flatMaterials ? flatten : restore;
  scene.object3D.traverse((object) => {
    if (object.isMesh) apply(object);
  });
  if (!flatMaterials) originalMaterials.clear();
};

const renderSummary = () => {
  const materials = flatMaterials ? 'flat' : 'standard';
  return `pixel ratio ${scene.renderer?.getPixelRatio() ?? 1}, ${materials} materials`;
};

const report = () => {
  const counts = `${roomCount} rooms, ${roomCount * 4} walls, ${portalIndices.length} portals`;
  const calls = scene.renderer?.info.render.calls ?? 0;
  readout.textContent = `${counts} | ${tickSummary()} | ${framesSinceReport} fps | ${calls} draw calls`
    + ` | ${renderSummary()}`
    + ' | keys: 1/2/3 = 25/100/400 rooms, P = pause our ticks, M = move a room, I = walk inside, O = overview,'
    + ' R = pixel ratio 1, L = flat materials, WASD + drag to look';
  for (const name of OUR_COMPONENTS) tickTotals[name] = 0;
  framesSinceReport = 0;
};
setInterval(report, REPORT_MS);

let roomMoving = false;
const toggleRoomMoving = () => {
  roomMoving = !roomMoving;
  const room = document.getElementById('room0');
  if (roomMoving) {
    room.setAttribute('animation', { property: 'position', to: '0 0 -1', dir: 'alternate', loop: true, dur: 1000 });
    return;
  }
  room.removeAttribute('animation');
  room.setAttribute('position', '0 0 0');
};

const KEY_ACTIONS = {
  p: () => {
    ticksPaused = !ticksPaused;
  },
  m: toggleRoomMoving,
  i: () => {
    placePlayer(INSIDE);
  },
  o: () => {
    placePlayer(OVERVIEW);
  },
  r: togglePixelRatio,
  l: toggleFlatMaterials
};

document.addEventListener('keydown', (event) => {
  const rooms = ROOM_COUNT_KEYS[event.key];
  if (rooms) {
    location.search = `?rooms=${rooms}`;
    return;
  }
  KEY_ACTIONS[event.key.toLowerCase()]?.();
});
