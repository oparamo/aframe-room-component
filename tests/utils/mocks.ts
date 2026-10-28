import { vi } from 'vitest';
import type { Material, Mesh, Object3D, Vector3 } from 'three';
import type { AFrame, Entity } from '../../src/types/aframe';
import type { CollisionComponent } from '../../src/components/collision';
import type {
  BuildingEl, BuildingScene, BuildingSystem, OpeningEl, PortalData, PortalEl, RoomEl, WallEl
} from '../../src/types/elements';
import { assertDefined } from '../../src/utils/assert';

// Data shapes are checked a few levels down; deeper than that (and for functions) anything goes,
// which keeps DOM-sized types such as HTMLElement from blowing the compiler's depth limit.
type Fn = (...args: never[]) => unknown;
type DeepPartial<T, Depth extends unknown[] = []> = Depth['length'] extends 4 ? unknown
  : T extends Fn ? Fn
    : T extends object ? { [K in keyof T]?: DeepPartial<T[K], [...Depth, unknown]> } : T;

// Test doubles fill in only what the code under test reads. This is the one place they are
// asserted to the full type; DeepPartial still checks the property names and shapes they set.
const fake = <T>(partial: DeepPartial<T>): T => partial as unknown as T;

// --- A-Frame registry ---

const registry = {
  components: new Map<string, object>(),
  systems: new Map<string, object>(),
  primitives: new Map<string, object>()
};

const installAframeMock = () => {
  const aframe: AFrame = {
    registerComponent (name, definition) { registry.components.set(name, definition); },
    registerSystem (name, definition) { registry.systems.set(name, definition); },
    registerPrimitive (name, definition) { registry.primitives.set(name, definition); }
  };
  Object.assign(globalThis, { AFRAME: aframe });
};

const lookup = (kind: keyof typeof registry, name: string) => {
  const definition = registry[kind].get(name);
  if (!definition) throw new Error(`No ${kind} registered as "${name}".`);
  return definition;
};

// Component methods as the tests call them: with no arguments, since no component reads tick's.
// Only room and portal define rebuild.
interface Hooks {
  init(): void;
  update(): void;
  remove(): void;
  tick(): void;
  rebuild(): void;
}

const registeredComponent = (name: string) => lookup('components', name) as Hooks;
const registeredPrimitive = (name: string) => lookup('primitives', name);
const registeredSystem = (name: string) =>
  lookup('systems', name) as Partial<BuildingSystem> & { init(): void };

// --- Geometry fixtures ---

interface Object3DOptions { x?: number; y?: number; z?: number }

const makeObject3D = ({ x = 0, y = 0, z = 0 }: Object3DOptions = {}) => {
  const object3D = new THREE.Object3D();
  object3D.position.set(x, y, z);
  return object3D;
};

// setObject3D as A-Frame does it for our meshes: the mesh joins the element's object3D.
const holdMesh = (el: { mesh: Mesh | null; object3D: Object3D }) => (_name: string, mesh: Mesh) => {
  el.mesh = mesh;
  el.object3D.add(mesh);
};

interface CapOptions { parentMaterial?: Material | null }

const makeCap = ({ parentMaterial = null }: CapOptions = {}) => {
  const el = {
    object3D: makeObject3D(),
    mesh: null as Mesh | null,
    components: {},
    classList: new Set<string>(),
    parentEl: { components: { material: { material: parentMaterial } } },
    getAttribute () { return { uvScale: 1 }; }
  };
  return Object.assign(el, { setObject3D: holdMesh(el) }) as unknown as BuildingEl;
};

interface WallOptions { x?: number; y?: number; z?: number; height?: number; openings?: OpeningEl[] }

const makeWall = ({ x = 0, y = 0, z = 0, height = 3, openings = [] }: WallOptions = {}) => {
  const el = {
    object3D: makeObject3D({ x, y, z }),
    openings,
    getHeight () { return height; },
    getAttribute: (attr: string) => attr === 'wall' ? { height, uvScale: 1 } : null,
    components: {},
    parentEl: { components: {}, object3D: makeObject3D() },
    mesh: null as Mesh | null,
    classList: new Set<string>()
  };
  return Object.assign(el, { setObject3D: holdMesh(el) }) as unknown as WallEl;
};

interface RoomOptions { outside?: boolean; width?: number | null; length?: number | null }

// The walls' and caps' object3Ds become children of the room's, as A-Frame parents them.
const makeRoom = (walls: WallEl[], { outside = false, width = null, length = null }: RoomOptions = {}) => {
  const roomEl = {
    getAttribute (attr: string) {
      if (attr === 'room') return { outside, width, length };
      return null;
    },
    walls,
    floor: makeCap(),
    ceiling: makeCap(),
    components: {},
    object3D: makeObject3D()
  } as unknown as RoomEl;
  for (const childEl of [...walls, roomEl.floor, roomEl.ceiling]) {
    roomEl.object3D.add(assertDefined(childEl, 'room child').object3D);
  }
  for (const wallEl of walls) Object.assign(wallEl, { parentEl: roomEl });
  return roomEl;
};

const makeSquareRoom = (opts?: RoomOptions) => makeRoom([
  makeWall(),
  makeWall({ x: 5 }),
  makeWall({ x: 5, z: 5 }),
  makeWall({ z: 5 })
], opts);

// Convenience for building system tests: builds a room with one wall per portal.
const makeRoomWithLinks = ({ portals = [] }: { portals?: (PortalEl | null)[] } = {}) =>
  makeRoom(portals.map(portalEl => makeWall({ openings: [makeOpening({ portalEl })] })));

const makeOpening = ({ portalEl = null }: { portalEl?: PortalEl | null } = {}) => ({
  object3D: makeObject3D(),
  vertices: [],
  mesh: null,
  classList: new Set<string>(),
  getPortal () { return portalEl; },
  parentEl: null,
  setObject3D () {}
}) as unknown as OpeningEl;

interface OpeningVertsOptions { x: number; width: number; height: number }

const makeOpeningVerts = ({ x, width, height }: OpeningVertsOptions) => [
  new THREE.Vector3(x - width / 2, 0, 0),
  new THREE.Vector3(x - width / 2, height, 0),
  new THREE.Vector3(x + width / 2, 0, 0),
  new THREE.Vector3(x + width / 2, height, 0)
];

interface TransformedRoomOptions {
  corners: [number, number][];
  position?: [number, number, number];
  rotationY?: number;
  scale?: [number, number, number];
  portalAt: [number, number, number];
  portalWidth?: number;
}

// A room moved, turned and scaled in the world. The first wall holds the opening, and the portal
// sits at a world point.
const makeTransformedRoom = ({
  corners, position = [0, 0, 0], rotationY = 0, scale = [1, 1, 1], portalAt, portalWidth = 1
}: TransformedRoomOptions) => {
  const [portalX, portalY, portalZ] = portalAt;
  const portalEl = fake<PortalEl>({
    object3D: makeObject3D({ x: portalX, y: portalY, z: portalZ }),
    getAttribute: () => ({ width: portalWidth, height: 2, floorHeight: 0 })
  });
  const openingEl = makeOpening({ portalEl });

  const walls = corners.map(([x, z], i) => makeWall({ x, z, openings: i === 0 ? [openingEl] : [] }));
  const roomEl = makeRoom(walls);
  roomEl.object3D.position.set(...position);
  roomEl.object3D.rotation.y = rotationY;
  roomEl.object3D.scale.set(...scale);
  return { roomEl, openingEl };
};

interface PortalChildOptions { type: string; uvScale?: number }

const makePortalChild = ({ type, uvScale = 1 }: PortalChildOptions) => {
  const el = {
    components: {
      [type]: {},
      material: { material: null }
    },
    parentEl: { components: {} },
    object3D: makeObject3D(),
    mesh: null as Mesh | null,
    classList: new Set<string>(),
    getAttribute () { return { uvScale }; }
  };
  return Object.assign(el, { setObject3D: holdMesh(el) }) as unknown as BuildingEl;
};

interface PortalOptions {
  fromVerts?: Vector3[] | null;
  toVerts?: Vector3[] | null;
  children?: BuildingEl[];
  roomA?: RoomEl;
  roomB?: RoomEl;
}

// Unified portal mock. Supports geometry tests via fromVerts/toVerts/children
// (getAttribute interface) and system tests via roomA/roomB (components.portal.data interface).
const makePortal = ({ fromVerts, toVerts, children, roomA, roomB }: PortalOptions = {}) => ({
  getAttribute (attr: string) {
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
}) as unknown as PortalEl;

interface LinkedPortalOptions { at: [number, number, number]; width: number; height: number; floorHeight: number }

// A portal with floor, ceiling and sides children, whose from and to openings are set as its rooms
// are made.
const makeLinkedPortal = ({ at: [x, y, z], ...size }: LinkedPortalOptions) => {
  const data: PortalData = { ...size, from: null, to: null };
  const children = (['floor', 'ceiling', 'sides'] as const).map(type => makePortalChild({ type }));
  const portalEl = {
    object3D: makeObject3D({ x, y, z }),
    components: {},
    children,
    getAttribute: (attr: string) => attr === 'portal' ? data : null
  } as unknown as PortalEl;
  for (const childEl of children) portalEl.object3D.add(childEl.object3D);
  return { portalEl, data };
};

interface LinkedRoomOptions {
  corners: [number, number][];
  // The wall that holds an opening for each portal.
  openingWall: number;
  portals: ReturnType<typeof makeLinkedPortal>[];
  end: 'from' | 'to';
}

const makeLinkedRoom = ({ corners, openingWall, portals, end }: LinkedRoomOptions) => {
  const openings = portals.map(({ portalEl }) => makeOpening({ portalEl }));
  const walls = corners.map(([x, z], i) => makeWall({ x, z, openings: i === openingWall ? openings : [] }));
  const wallEl = assertDefined(walls[openingWall], 'opening wall');
  for (const [i, openingEl] of openings.entries()) {
    Object.assign(openingEl, { parentEl: wallEl });
    wallEl.object3D.add(openingEl.object3D);
    assertDefined(portals[i], 'portal').data[end] = openingEl;
  }
  return makeRoom(walls);
};

// Two 4 m square rooms with a 2 m gap between them, along z, joined by a door at x = 1 and a
// window at x = 3. Everything is a real Object3D, parented as A-Frame would.
const makeTwoRooms = () => {
  const doorPortal = makeLinkedPortal({ at: [1, 0, 5], width: 1, height: 2, floorHeight: 0 });
  const windowPortal = makeLinkedPortal({ at: [3, 0, 5], width: 1, height: 1, floorHeight: 0.8 });
  const portals = [doorPortal, windowPortal];
  const near = makeLinkedRoom({ corners: [[0, 0], [4, 0], [4, 4], [0, 4]], openingWall: 2, portals, end: 'from' });
  const far = makeLinkedRoom({ corners: [[0, 6], [4, 6], [4, 10], [0, 10]], openingWall: 0, portals, end: 'to' });

  const elements: BuildingEl[] = [near, far].flatMap(roomEl => [
    ...roomEl.walls,
    ...roomEl.walls.flatMap(wallEl => wallEl.openings),
    ...[roomEl.floor, roomEl.ceiling].flatMap(capEl => capEl ? [capEl] : [])
  ]);
  elements.push(...portals.flatMap(({ portalEl }) => [...portalEl.children]));

  // The elements the builds gave a class, as a querySelectorAll for it would find them.
  const withClass = (className: string) =>
    elements.filter(el => (el.classList as unknown as Set<string>).has(className));

  return { near, far, door: doorPortal.portalEl, window: windowPortal.portalEl, withClass };
};

const makeSystem = () => ({
  ...registeredSystem('building'),
  el: { emit: () => {}, object3D: { updateMatrixWorld: () => {} } },
  dirtyRooms: new Set(),
  dirtyPortals: new Set(),
  buildPending: false
}) as unknown as BuildingSystem;

// --- Component fixtures ---

interface SceneOptions {
  portals?: DeepPartial<PortalEl>[];
  systems?: DeepPartial<BuildingScene['systems']>;
}

const makeSceneEl = ({ portals = [], systems = {} }: SceneOptions = {}) => ({
  systems,
  querySelector: () => null,
  querySelectorAll: (sel: string) => sel === 'a-portal' ? portals : []
}) as unknown as BuildingScene;

// Listeners the element mock captured, keyed by event name.
interface ListenerLog { _listeners: Record<string, EventListener | undefined> }

interface ElOptions {
  tag?: string;
  parentTag?: string | null;
  parentAttrs?: Record<string, object>;
  parentComponents?: DeepPartial<BuildingEl['components']>;
  walls?: DeepPartial<WallEl>[];
  openings?: DeepPartial<OpeningEl>[];
  ceilingEl?: DeepPartial<BuildingEl> | null;
  floorEl?: DeepPartial<BuildingEl> | null;
  sceneEl?: BuildingScene | null;
  attrs?: Record<string, object>;
}

const makeEl = ({
  tag = 'a-entity',
  parentTag = null,
  parentAttrs = {},
  parentComponents = {},
  walls = [],
  openings = [],
  ceilingEl = null,
  floorEl = null,
  sceneEl = null,
  attrs = {}
}: ElOptions = {}) => {
  const el = {
    localName: tag,
    parentEl: parentTag
      ? { localName: parentTag, components: parentComponents, getAttribute: (a: string) => parentAttrs[a] ?? null }
      : null,
    object3D: makeObject3D(),
    sceneEl: sceneEl ?? makeSceneEl(),
    _listeners: {} as ListenerLog['_listeners'],
    addEventListener (event: string, cb: EventListener) { this._listeners[event] = cb; },
    removeEventListener () {},
    querySelector (sel: string) {
      if (sel === 'a-ceiling') return ceilingEl;
      if (sel === 'a-floor') return floorEl;
      return null;
    },
    querySelectorAll (sel: string) {
      if (sel === 'a-wall') return walls;
      if (sel === 'a-opening') return openings;
      return [];
    },
    getAttribute (a: string) { return attrs[a] ?? null; }
  };
  return el as unknown as BuildingEl & ListenerLog;
};

// Runs requestAnimationFrame callbacks synchronously, so a test can assert on the build they schedule.
const immediateAnimationFrame = () => vi.fn((callback: FrameRequestCallback) => {
  callback(0);
  return 0;
});

// Fires the componentchanged listener the component registered, as A-Frame would.
const fireComponentChanged = (el: ListenerLog, name: string) => {
  const listener = el._listeners.componentchanged;
  if (!listener) throw new Error('No componentchanged listener registered.');
  listener(new CustomEvent('componentchanged', { detail: { name } }));
};

interface CollisionElOptions {
  position?: Vector3;
  cameraY?: number;
  wallCollidables?: DeepPartial<BuildingEl>[];
  floorCollidables?: DeepPartial<BuildingEl>[];
  childCamera?: boolean;
  // The scene finished loading before room-collision was added, so its loaded event never fires.
  sceneLoaded?: boolean;
}

interface PlaneMeshOptions { position?: [number, number, number]; rotationX?: number; rotationY?: number }

// A 10 m square for collision to raycast against. Unrotated, it stands in the xy plane facing +z,
// and only its front face is hit.
const makePlaneMesh = ({ position = [0, 0, 0], rotationX = 0, rotationY = 0 }: PlaneMeshOptions = {}) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial());
  mesh.position.set(...position);
  mesh.rotation.set(rotationX, rotationY, 0);
  mesh.updateMatrixWorld();
  return mesh;
};

// The rig pattern puts the camera in a child entity at cameraY; the direct pattern is the camera.
const makeCollisionEl = ({
  position = new THREE.Vector3(),
  cameraY = 1.6,
  wallCollidables = [],
  floorCollidables = [],
  childCamera = false,
  sceneLoaded = false
}: CollisionElOptions = {}) => {
  const object3D = makeObject3D();
  object3D.position.copy(position);
  const cameraObjEl = childCamera ? { object3D: makeObject3D({ y: cameraY }) } : null;
  if (cameraObjEl) object3D.add(cameraObjEl.object3D);

  return {
    object3D,
    querySelector: () => cameraObjEl,
    components: {},
    sceneEl: {
      hasLoaded: sceneLoaded,
      _listeners: {} as ListenerLog['_listeners'],
      addEventListener (event: string, cb: EventListener) { this._listeners[event] = cb; },
      removeEventListener () {},
      querySelectorAll: (sel: string) => sel === '.collidable' ? wallCollidables : floorCollidables
    }
  } as unknown as Entity & { sceneEl: ListenerLog };
};

// Fires the scene's loaded event, which A-Frame sends once every entity has initialized.
const loadScene = (el: { sceneEl: ListenerLog }) => {
  const listener = el.sceneEl._listeners.loaded;
  if (!listener) throw new Error('No loaded listener registered.');
  listener(new Event('loaded'));
};

const makeCollisionComponent = (el: Entity, data = { radius: 0.4 }) => {
  const comp = { ...registeredComponent('room-collision'), el, data } as unknown as CollisionComponent & Hooks;
  comp.init.call(comp);
  return comp;
};

interface CompOptions extends ElOptions { data?: object }

// A component instance as A-Frame builds it: the definition's methods plus el and data. init stores
// handlers such as _onTransformChanged on it.
type MockComp<El> = Hooks & {
  el: El & ListenerLog;
  data: object;
  _onTransformChanged?: EventListener;
};

interface CompTarget { name: string; tag: string; parentTag: string }

const makeComp = <El extends BuildingEl>({ name, tag, parentTag }: CompTarget, { data = {}, ...elOpts }: CompOptions = {}): MockComp<El> => ({
  ...registeredComponent(name),
  el: makeEl({ tag, parentTag, ...elOpts }) as El & ListenerLog,
  data
});

const makeRoomComp = (opts: CompOptions = {}) =>
  makeComp<RoomEl>({ name: 'room', tag: 'a-room', parentTag: 'a-scene' }, { walls: [{}, {}, {}], ...opts });
const makeWallComp = (opts?: CompOptions) => makeComp<WallEl>({ name: 'wall', tag: 'a-wall', parentTag: 'a-room' }, opts);
const makeOpeningComp = (opts?: CompOptions) =>
  makeComp<OpeningEl>({ name: 'opening', tag: 'a-opening', parentTag: 'a-wall' }, opts);
const makePortalComp = (opts?: CompOptions) =>
  makeComp<PortalEl>({ name: 'portal', tag: 'a-portal', parentTag: 'a-scene' }, opts);

export {
  fake,
  fireComponentChanged,
  immediateAnimationFrame,
  installAframeMock,
  loadScene,
  makeCap,
  makeCollisionComponent,
  makeCollisionEl,
  makeEl,
  makeObject3D,
  makeOpening,
  makeOpeningComp,
  makeOpeningVerts,
  makePlaneMesh,
  makePortal,
  makePortalChild,
  makePortalComp,
  makeRoom,
  makeRoomComp,
  makeRoomWithLinks,
  makeSceneEl,
  makeSquareRoom,
  makeSystem,
  makeTransformedRoom,
  makeTwoRooms,
  makeWall,
  makeWallComp,
  registeredComponent,
  registeredPrimitive,
  registeredSystem
};
