import { describe, it, expect } from 'vitest';
import { makeEl } from '../utils/mocks.js';
import '../../src/components/sides.js';

describe('sides', () => {
  describe('init', () => {
    it('does not throw when parent is a-portal', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-sides', parentTag: 'a-portal' }) };

      // Act / Assert
      expect(() => AFRAME._components.sides.init.call(comp)).not.toThrow();
    });

    it('throws when parent is not a-portal', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-sides', parentTag: 'a-room' }) };

      // Act / Assert
      expect(() => AFRAME._components.sides.init.call(comp)).toThrow();
    });
  });
});
