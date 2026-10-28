import { vi } from 'vitest';
import type { Material, Object3D, Vector3 } from 'three';
import type { AFrame, Entity } from '../../src/types/aframe';
import type { CollisionComponent } from '../../src/components/collision';
import type {
  BuildingEl, BuildingScene, BuildingSystem, BuildState, OpeningEl, PortalEl, RoomEl, WallEl
} from '../../src/types/elements';
import type { OpeningCorners } from '../../src/types/geometry';

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

// Component methods as the tests call them: with no arguments unless a test passes update's oldData,
// since no component reads tick's. Only room and portal define rebuild.
interface Hooks {
  init(): void;
  update(oldData?: object): void;
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

interface ElementOptions {
  localName: string;
  // Component data by name, as getAttribute returns it.
  data?: Record<string, object>;
  components?: Record<string, object>;
  children?: BuildingEl[];
  at?: Object3DOptions;
}

// An element as the builders see it. Its object3D is real, with its children's beneath it, and
// setObject3D, getObject3D and removeObject3D keep object3DMap as A-Frame does.
const makeBuildingEl = ({ localName, data = {}, components = {}, children = [], at = {} }: ElementOptions) => {
  const object3D = makeObject3D(at);
  const object3DMap: Record<string, Object3D | undefined> = {};
  const el = {
    localName,
    id: '',
    isConnected: true,
    object3D,
    object3DMap,
    components,
    children,
    parentEl: null,
    classList: new Set<string>(),
    hasAttribute: () => false,
    getAttribute: (name: string) => data[name] ?? null,
    getObject3D: (type: string) => object3DMap[type],
    setObject3D (type: string, object: Object3D) {
      object3DMap[type] = object;
      object3D.add(object);
    },
    removeObject3D (type: string) {
      const object = object3DMap[type];
      if (object) object3D.remove(object);
      object3DMap[type] = undefined;
    }
  };
  for (const childEl of children) {
    object3D.add(childEl.object3D);
    Object.assign(childEl, { parentEl: el });
  }
  return el as unknown as BuildingEl;
};

interface CapOptions { kind?: 'floor' | 'ceiling'; uvScale?: number }

const makeCap = ({ kind = 'floor', uvScale = 1 }: CapOptions = {}) =>
  makeBuildingEl({ localName: `a-${kind}`, data: { [kind]: { uvScale } } });

interface WallOptions {
  x?: number;
  y?: number;
  z?: number;
  height?: number;
  openings?: OpeningEl[];
  // Other children, such as a portal or a nested room.
  others?: BuildingEl[];
}

const makeWall = ({ x = 0, y = 0, z = 0, height = 3, openings = [], others = [] }: WallOptions = {}) => makeBuildingEl({
  localName: 'a-wall', data: { wall: { height, uvScale: 1 } }, children: [...openings, ...others], at: { x, y, z }
}) as WallEl;

interface RoomOptions {
  outside?: boolean;
  width?: number | null;
  length?: number | null;
  height?: number;
  caps?: ('floor' | 'ceiling')[];
  material?: Material;
}

const makeRoom = (walls: WallEl[], {
  outside = false, width = null, length = null, height = 2.4, caps = ['floor', 'ceiling'], material
}: RoomOptions = {}) => makeBuildingEl({
  localName: 'a-room',
  data: { room: { outside, width, length, height } },
  components: { room: { rebuild: vi.fn() }, ...(material && { material: { material } }) },
  children: [...walls, ...caps.map(kind => makeCap({ kind }))]
});

const makeSquareRoom = (opts?: RoomOptions) => makeRoom([
  makeWall(),
  makeWall({ x: 5 }),
  makeWall({ x: 5, z: 5 }),
  makeWall({ z: 5 })
], opts);

const makeOpening = () => makeBuildingEl({ localName: 'a-opening' }) as OpeningEl;

// A square room whose first wall holds an opening.
const makeRoomWithOpening = () => {
  const openingEl = makeOpening();
  const roomEl = makeRoom([makeWall({ openings: [openingEl] }), makeWall({ x: 5 }), makeWall({ x: 5, z: 5 }), makeWall({ z: 5 })]);
  return { roomEl, openingEl };
};

interface PortalOptions {
  from?: Entity | null;
  to?: Entity | null;
  at?: Object3DOptions;
  width?: number;
  height?: number;
  floorHeight?: number;
  children?: BuildingEl[];
}

const makePortal = ({
  from = null, to = null, at, width = 1, height = 2, floorHeight = 0, children = []
}: PortalOptions = {}) => makeBuildingEl({
  localName: 'a-portal',
  data: { portal: { from, to, width, height, floorHeight } },
  components: { portal: { rebuild: vi.fn() } },
  children,
  at
});

interface PortalChildOptions { type: string; uvScale?: number }

const makePortalChild = ({ type, uvScale = 1 }: PortalChildOptions) =>
  makeBuildingEl({ localName: `a-${type}`, data: { [type]: { uvScale } }, components: { [type]: {} } });

const makePortalSurfaces = () => ['floor', 'ceiling', 'sides'].map(type => makePortalChild({ type }));

// Build state as the system keeps it: links are the opening each portal uses.
const makeBuildState = ({ links = [] }: { links?: [OpeningEl, PortalEl][] } = {}): BuildState => ({
  portalOf: new WeakMap(links),
  cornersOf: new WeakMap()
});

interface OpeningCornersOptions { x: number; width: number; height: number }

const makeOpeningCorners = ({ x, width, height }: OpeningCornersOptions): OpeningCorners => [
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
  corners, position = [0, 0, 0], rotationY = 0, scale = [1, 1, 1], portalAt: [x, y, z], portalWidth = 1
}: TransformedRoomOptions) => {
  const portalEl = makePortal({ at: { x, y, z }, width: portalWidth });
  const openingEl = makeOpening();

  const walls = corners.map(([cornerX, cornerZ], i) => makeWall({ x: cornerX, z: cornerZ, openings: i === 0 ? [openingEl] : [] }));
  const roomEl = makeRoom(walls);
  roomEl.object3D.position.set(...position);
  roomEl.object3D.rotation.y = rotationY;
  roomEl.object3D.scale.set(...scale);
  return { roomEl, openingEl, state: makeBuildState({ links: [[openingEl, portalEl]] }) };
};

const descendantsOf = (el: BuildingEl): BuildingEl[] =>
  [...el.children].flatMap(childEl => [childEl as BuildingEl, ...descendantsOf(childEl as BuildingEl)]);

const SQUARE_CORNERS: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];

// Two 4 m square rooms with a 2 m gap between them, along z, joined by a door at x = 1 and a
// window at x = 3. Everything is a real Object3D, parented as A-Frame would.
const makeTwoRooms = () => {
  const [doorFrom, doorTo, windowFrom, windowTo] = [makeOpening(), makeOpening(), makeOpening(), makeOpening()];
  const roomAt = (z: number, openingWall: number, openings: OpeningEl[]) =>
    makeRoom(SQUARE_CORNERS.map(([x, cornerZ], i) => makeWall({ x, z: cornerZ + z, openings: i === openingWall ? openings : [] })));
  const near = roomAt(0, 2, [doorFrom, windowFrom]);
  const far = roomAt(6, 0, [doorTo, windowTo]);

  const door = makePortal({ from: doorFrom, to: doorTo, at: { x: 1, z: 5 }, children: makePortalSurfaces() });
  const window = makePortal({
    from: windowFrom, to: windowTo, at: { x: 3, z: 5 }, height: 1, floorHeight: 0.8, children: makePortalSurfaces()
  });
  const state = makeBuildState({ links: [[doorFrom, door], [doorTo, door], [windowFrom, window], [windowTo, window]] });

  const elements = [near, far, door, window].flatMap(descendantsOf);

  // The elements the builds gave a class, as a querySelectorAll for it would find them.
  const withClass = (className: string) =>
    elements.filter(el => (el.classList as unknown as Set<string>).has(className));

  return { near, far, door, window, state, withClass };
};

const makeSystem = () => {
  const system = {
    ...registeredSystem('building'),
    el: { emit: () => {} }
  } as unknown as BuildingSystem & { init(): void };
  system.init();
  return system;
};

// --- Component fixtures ---

interface SceneOptions {
  // Methods of the building system a test wants to see called or to answer for.
  building?: DeepPartial<BuildingSystem>;
}

const BUILDING_METHODS = [
  'hideUntilBuilt', 'buildRoom', 'buildPortal', 'linkPortal', 'removeRoom', 'removePortal', 'removeOpening',
  'hasMoved', 'hasWallMoved'
] as const;

// A scene whose building system is all stubs, apart from those the test passes.
const makeSceneEl = ({ building = {} }: SceneOptions = {}) => {
  const stubs = Object.fromEntries(BUILDING_METHODS.map(name => [name, vi.fn()]));
  return { systems: { building: { ...stubs, ...building } } } as unknown as BuildingScene;
};

// Listeners the element mock captured, keyed by event name.
interface ListenerLog { _listeners: Record<string, EventListener | undefined> }

interface ElOptions {
  tag?: string;
  parentTag?: string | null;
  parentAttrs?: Record<string, object>;
  parentComponents?: DeepPartial<BuildingEl['components']>;
  children?: DeepPartial<BuildingEl>[];
  sceneEl?: BuildingScene | null;
  attrs?: Record<string, object>;
}

const makeEl = ({
  tag = 'a-entity',
  parentTag = null,
  parentAttrs = {},
  parentComponents = {},
  children = [],
  sceneEl = null,
  attrs = {}
}: ElOptions = {}) => {
  const listeners: ListenerLog['_listeners'] = {};
  const el = Object.assign(makeBuildingEl({ localName: tag, data: attrs }), {
    parentEl: parentTag
      ? { localName: parentTag, components: parentComponents, getAttribute: (a: string) => parentAttrs[a] ?? null }
      : null,
    sceneEl: sceneEl ?? makeSceneEl(),
    children,
    _listeners: listeners,
    addEventListener (event: string, cb: EventListener) { listeners[event] = cb; },
    removeEventListener: vi.fn()
  });
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

interface WallChildOptions { positioned?: boolean }

// A wall as its room's init sees it: the tag, and whether its markup sets a position.
const makeWallChild = ({ positioned = false }: WallChildOptions = {}) =>
  ({ localName: 'a-wall', hasAttribute: (name: string) => positioned && name === 'position' });

const THREE_WALLS = [makeWallChild(), makeWallChild(), makeWallChild()];

const makeRoomComp = (opts: CompOptions = {}) =>
  makeComp<RoomEl>({ name: 'room', tag: 'a-room', parentTag: 'a-scene' }, { children: THREE_WALLS, ...opts });
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
  makeBuildState,
  makeCap,
  makeCollisionComponent,
  makeCollisionEl,
  makeEl,
  makeObject3D,
  makeOpening,
  makeOpeningComp,
  makeOpeningCorners,
  makePlaneMesh,
  makePortal,
  makePortalChild,
  makePortalComp,
  makeRoom,
  makeRoomComp,
  makeRoomWithOpening,
  makeSceneEl,
  makeSquareRoom,
  makeSystem,
  makeTransformedRoom,
  makeTwoRooms,
  makeWall,
  makeWallChild,
  makeWallComp,
  registeredComponent,
  registeredPrimitive,
  registeredSystem
};
