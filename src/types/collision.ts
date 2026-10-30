import type { Intersection, Mesh, Raycaster } from 'three';
import type { Component, Entity, Scene, System } from './aframe';

// The room-collidable component's data is its one boolean: whether the element collides.
type CollidableComponent = Component<boolean, CollisionEl>;

interface CollisionSystem extends System<CollisionScene> {
  _surfaces: Set<Entity>;
  // The surfaces that collide as of the last change, or null until the next query recomputes them.
  _active: Entity[] | null;
  _probe: Mesh;
  updateSurface(el: Entity): void;
  removeSurface(el: Entity): void;
  meshes(): Mesh[];
  intersect(raycaster: Raycaster): Intersection[];
}

interface CollisionScene extends Scene {
  systems: { 'room-collision'?: CollisionSystem };
}

interface CollisionEl extends Entity {
  sceneEl: CollisionScene;
}

export type { CollidableComponent, CollisionEl, CollisionScene, CollisionSystem };
