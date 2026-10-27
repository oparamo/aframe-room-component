import { describe, it, expect, vi } from 'vitest';
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

  describe('update', () => {
    it('rebuilds its parent portal', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = { el: makeEl({ tag: 'a-sides', parentTag: 'a-portal', parentComponents: { portal: { rebuild } } }) };

      // Act
      registeredComponent('sides').update.call(comp);

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });
  });
});
