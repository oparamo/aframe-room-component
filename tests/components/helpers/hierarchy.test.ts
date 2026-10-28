import { describe, it, expect } from 'vitest';
import type { Entity } from '../../../src/types/aframe';
import { requireParent } from '../../../src/components/helpers/hierarchy';
import { fake } from '../../utils/mocks';

describe('requireParent', () => {
  it('does not throw when parent tag matches an allowed tag', () => {
    // Arrange
    const el = fake<Entity>({ localName: 'a-wall', parentEl: { localName: 'a-room' } });

    // Act / Assert
    expect(() => requireParent(el, 'a-room')).not.toThrow();
  });

  it('passes when parent matches any of multiple allowed tags', () => {
    // Arrange
    const el = fake<Entity>({ localName: 'a-portal', parentEl: { localName: 'a-wall' } });

    // Act / Assert
    expect(() => requireParent(el, 'a-scene', 'a-wall')).not.toThrow();
  });

  it('throws when parent tag does not match any allowed tag', () => {
    // Arrange
    const el = fake<Entity>({ localName: 'a-wall', parentEl: { localName: 'a-scene' } });

    // Act / Assert
    expect(() => requireParent(el, 'a-room')).toThrow();
  });

  it('throws when parentEl is null', () => {
    // Arrange
    const el = fake<Entity>({ localName: 'a-wall', parentEl: null });

    // Act / Assert
    expect(() => requireParent(el, 'a-room')).toThrow();
  });
});
