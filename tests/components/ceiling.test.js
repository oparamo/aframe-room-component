import { describe, it, expect } from 'vitest';
import { makeEl } from '../utils/mocks.js';
import '../../src/components/ceiling.js';

describe('ceiling', () => {
  describe('init', () => {
    it('does not throw when parent is a-portal', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-ceiling', parentTag: 'a-portal' }) };

      // Act / Assert
      expect(() => AFRAME._components.ceiling.init.call(comp)).not.toThrow();
    });

    it('does not throw when parent is a-room', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-ceiling', parentTag: 'a-room' }) };

      // Act / Assert
      expect(() => AFRAME._components.ceiling.init.call(comp)).not.toThrow();
    });

    it('throws when parent is not a-portal or a-room', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-ceiling', parentTag: 'a-scene' }) };

      // Act / Assert
      expect(() => AFRAME._components.ceiling.init.call(comp)).toThrow();
    });
  });
});
