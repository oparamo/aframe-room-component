import * as THREE from 'three';
global.THREE = THREE;

global.AFRAME = {
  _systems: {},
  _components: {},
  _primitives: {},
  registerSystem(name, def) { this._systems[name] = def; },
  registerComponent(name, def) { this._components[name] = def; },
  registerPrimitive(name, def) { this._primitives[name] = def; }
};
