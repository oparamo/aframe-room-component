import { describe, it, expect } from 'vitest';
import { makeEl, registeredComponent } from '../utils/mocks';
import '../../src/components/ceiling';

describe('ceiling', () => {
  describe('init', () => {
    it('does not throw when parent is a-portal', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-ceiling', parentTag: 'a-portal' }) };

      // Act / Assert
      expect(() => registeredComponent('ceiling').init.call(comp)).not.toThrow();
    });

    it('does not throw when parent is a-room', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-ceiling', parentTag: 'a-room' }) };

      // Act / Assert
      expect(() => registeredComponent('ceiling').init.call(comp)).not.toThrow();
    });

    it('throws when parent is not a-portal or a-room', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-ceiling', parentTag: 'a-scene' }) };

      // Act / Assert
      expect(() => registeredComponent('ceiling').init.call(comp)).toThrow();
    });
  });
});
