import { describe, it, expect, vi } from 'vitest';
import { makeEl, makeSceneEl, registeredComponent } from '../utils/mocks';
import '../../src/components/collidable';

// The component on an element whose scene has a room-collision system of stubs.
const makeCollidableComp = () => {
  const system = { updateSurface: vi.fn(), removeSurface: vi.fn() };
  const sceneEl = makeSceneEl({ collision: system });
  return { comp: { ...registeredComponent('room-collidable'), el: makeEl({ sceneEl }) }, system };
};

describe('room-collidable', () => {
  it('tells the system on every update, the first included', () => {
    // Arrange
    const { comp, system } = makeCollidableComp();

    // Act
    comp.update.call(comp);

    // Assert
    expect(system.updateSurface).toHaveBeenCalledExactlyOnceWith(comp.el);
  });

  it('takes the element out of the system when removed', () => {
    // Arrange
    const { comp, system } = makeCollidableComp();

    // Act
    comp.remove.call(comp);

    // Assert
    expect(system.removeSurface).toHaveBeenCalledExactlyOnceWith(comp.el);
  });
});
