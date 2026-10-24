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
  setObject3D(type: string, object: Three.Object3D): void;
  emit(name: string, detail?: unknown): void;
}

interface Scene extends Entity {
  systems: Partial<Record<string, System>>;
}

interface Component<Data = unknown, El extends Entity = Entity> {
  el: El;
  data: Data;
}

interface System<El extends Scene = Scene> {
  el: El;
}

type Schema = Record<string, { type: string; default?: unknown }>;

interface ComponentLifecycle {
  init?(): void;
  update?(): void;
  remove?(): void;
  tick?(time: number, delta: number): void;
}

interface SystemLifecycle {
  init?(): void;
}

// Methods and state the definition declares beyond the lifecycle get `this` typed as the instance.
type ComponentDefinition<T extends Component>
  = { schema?: Schema } & ComponentLifecycle & Partial<Omit<T, keyof Component>> & ThisType<T>;

type SystemDefinition<T extends System>
  = SystemLifecycle & Partial<Omit<T, keyof System>> & ThisType<T>;

interface PrimitiveDefinition {
  defaultComponents: Record<string, object>;
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
