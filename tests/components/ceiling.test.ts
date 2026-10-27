import { describe, it, expect, vi } from 'vitest';
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

  describe('update', () => {
    it('rebuilds its parent room', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = { el: makeEl({ tag: 'a-ceiling', parentTag: 'a-room', parentComponents: { room: { rebuild } } }) };

      // Act
      registeredComponent('ceiling').update.call(comp);

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });

    it('rebuilds its parent portal', () => {
      // Arrange
      const rebuild = vi.fn();
      const comp = { el: makeEl({ tag: 'a-ceiling', parentTag: 'a-portal', parentComponents: { portal: { rebuild } } }) };

      // Act
      registeredComponent('ceiling').update.call(comp);

      // Assert
      expect(rebuild).toHaveBeenCalledOnce();
    });
  });
});
