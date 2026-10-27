import { describe, it, expect, vi } from 'vitest';
import { makeEl, registeredComponent } from '../utils/mocks';
import '../../src/components/floor';

describe('floor', () => {
  describe('init', () => {
    it('does not throw when parent is a-portal', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-floor', parentTag: 'a-portal' }) };

      // Act / Assert
      expect(() => registeredComponent('floor').init.call(comp)).not.toThrow();
    });

    it('does not throw when parent is a-room', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-floor', parentTag: 'a-room' }) };

      // Act / Assert
      expect(() => registeredComponent('floor').init.call(comp)).not.toThrow();
    });

    it('throws when parent is not a-portal or a-room', () => {
      // Arrange
      const comp = { el: makeEl({ tag: 'a-floor', parentTag: 'a-scene' }) };

      // Act / Assert
      expect(() => registeredComponent('floor').init.call(comp)).toThrow();
    });
  });

  describe('update', () => {
    it('rebuilds its parent room', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = { el: makeEl({ tag: 'a-floor', parentTag: 'a-room', parentComponents: { room: { rebuild } } }) };

      // Act
      registeredComponent('floor').update.call(comp);

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });

    it('rebuilds its parent portal', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = { el: makeEl({ tag: 'a-floor', parentTag: 'a-portal', parentComponents: { portal: { rebuild } } }) };

      // Act
      registeredComponent('floor').update.call(comp);

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });
  });
});
