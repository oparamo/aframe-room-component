import { describe, it, expect } from 'vitest';
import { makeEl, registeredComponent } from '../utils/mocks';
import '../../src/components/sides';

describe('sides', () => {
  describe('init', () => {
    it('does not throw when parent is a-portal', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-sides', parentTag: 'a-portal' }) };

      // Act / Assert
      expect(() => registeredComponent('sides').init.call(comp)).not.toThrow();
    });

    it('throws when parent is not a-portal', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-sides', parentTag: 'a-room' }) };

      // Act / Assert
      expect(() => registeredComponent('sides').init.call(comp)).toThrow();
    });
  });
});
