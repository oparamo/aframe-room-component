import { describe, it, expect } from 'vitest';
import { requireParent, TRANSFORM_PROPS } from '../../src/components/shared.js';

describe('shared', () => {
  describe('TRANSFORM_PROPS', () => {
    it('contains position, rotation, and scale', () => {
      // Assert
      expect(TRANSFORM_PROPS.has('position')).toBe(true);
      expect(TRANSFORM_PROPS.has('rotation')).toBe(true);
      expect(TRANSFORM_PROPS.has('scale')).toBe(true);
    });
  });

  describe('requireParent', () => {
    it('does not throw when parent tag matches an allowed tag', () => {
      // Arrange
      const el = { localName: 'a-wall', parentEl: { localName: 'a-room' } };

      // Act / Assert
      expect(() => requireParent(el, 'a-room')).not.toThrow();
    });

    it('passes when parent matches any of multiple allowed tags', () => {
      // Arrange
      const el = { localName: 'a-portal', parentEl: { localName: 'a-wall' } };

      // Act / Assert
      expect(() => requireParent(el, 'a-scene', 'a-wall')).not.toThrow();
    });

    it('throws when parent tag does not match any allowed tag', () => {
      // Arrange
      const el = { localName: 'a-wall', parentEl: { localName: 'a-scene' } };

      // Act / Assert
      expect(() => requireParent(el, 'a-room')).toThrow();
    });

    it('throws when parentEl is null', () => {
      // Arrange
      const el = { localName: 'a-wall', parentEl: null };

      // Act / Assert
      expect(() => requireParent(el, 'a-room')).toThrow();
    });
  });
});
