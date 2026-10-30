/*
 * The slice of A-Frame this library uses, declared here instead of installing @types/aframe.
 * That package describes A-Frame 1.2 (2021) while we target 1.8, types entities as
 * ObjectMap<any>, and depends on @types/three "*" and @types/animejs. Most of what needs typing
 * is our own (component data, the properties our components attach to elements, the building
 * system, see ./elements), so the package would only supply the few core types below.
 */
import type * as Three from 'three';

interface ComponentMap {
  [name: string]: object | undefined;
  material?: { material: Three.Material };
}

interface Entity extends HTMLElement {
  object3D: Three.Object3D;
  sceneEl: Scene;
  parentEl: Entity | null;
  components: ComponentMap;
  object3DMap: Record<string, Three.Object3D | undefined>;
  getObject3D(type: string): Three.Object3D | undefined;
  setObject3D(type: string, object: Three.Object3D): void;
  removeObject3D(type: string): void;
  emit(name: string, detail?: unknown): void;
}

interface Scene extends Entity {
  hasLoaded: boolean;
  systems: Partial<Record<string, System>>;
}

interface Component<Data = unknown, El extends Entity = Entity> {
  el: El;
  data: Data;
}

interface System<El extends Scene = Scene> {
  el: El;
}

interface PropertySchema { type: string; default?: unknown }

// A single-property schema makes the component's data that one value.
type Schema = PropertySchema | Record<string, PropertySchema>;

// update receives the data from before the change, which is empty on the first update.
interface ComponentLifecycle<Data = unknown> {
  init?(): void;
  update?(oldData: Partial<Data>): void;
  remove?(): void;
  tick?(time: number, delta: number): void;
}

interface SystemLifecycle {
  init?(): void;
  tick?(time: number, delta: number): void;
}

// Methods and state the definition declares beyond the lifecycle get `this` typed as the instance.
type ComponentDefinition<T extends Component>
  = { schema?: Schema } & ComponentLifecycle<T['data']> & Partial<Omit<T, keyof Component>> & ThisType<T>;

type SystemDefinition<T extends System>
  = SystemLifecycle & Partial<Omit<T, keyof System>> & ThisType<T>;

interface PrimitiveDefinition {
  // An object for a component with several properties, the value itself for a single-property one.
  defaultComponents: Record<string, unknown>;
  mappings?: Record<string, string>;
}

interface AFrame {
  registerComponent<T extends Component>(name: string, definition: ComponentDefinition<T>): void;
  registerSystem<T extends System>(name: string, definition: SystemDefinition<T>): void;
  registerPrimitive(name: string, definition: PrimitiveDefinition): void;
}

declare global {
  const AFRAME: AFrame;
  const THREE: typeof Three;
}

export type {
  AFrame,
  Component,
  ComponentDefinition,
  ComponentLifecycle,
  ComponentMap,
  Entity,
  PrimitiveDefinition,
  Scene,
  Schema,
  System,
  SystemDefinition,
  SystemLifecycle
};
