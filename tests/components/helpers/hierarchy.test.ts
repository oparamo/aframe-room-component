import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Entity } from '../../../src/types/aframe';
import { checkParent, rebuildParent } from '../../../src/components/helpers/hierarchy';
import { fake, makeEl } from '../../utils/mocks';

afterEach(() => vi.restoreAllMocks());

describe('checkParent', () => {
  it('stays quiet when the parent is one of the allowed tags', () => {
    // Arrange
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = fake<Entity>({ localName: 'a-portal', parentEl: { localName: 'a-wall' } });

    // Act
    checkParent(el, 'a-scene', 'a-wall');

    // Assert
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs the element and the parents it accepts, naming it by id', () => {
    // Arrange
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = fake<Entity>({ localName: 'a-wall', id: 'north', parentEl: { localName: 'a-scene' } });

    // Act
    checkParent(el, 'a-room');

    // Assert
    expect(errorSpy).toHaveBeenCalledExactlyOnceWith('#north must be a child of a <a-room>; it was skipped.', el);
  });

  it('logs when the element has no parent', () => {
    // Arrange
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = fake<Entity>({ localName: 'a-wall', id: '', parentEl: null });

    // Act
    checkParent(el, 'a-room');

    // Assert
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});

describe('rebuildParent', () => {
  it('does nothing without an element', () => {
    // Act / Assert
    expect(() => rebuildParent(null)).not.toThrow();
  });

  it('rebuilds a parent portal', () => {
    // Arrange
    const rebuild = vi.fn();
    const el = makeEl({ tag: 'a-sides', parentTag: 'a-portal', parentComponents: { portal: { rebuild } } });

    // Act
    rebuildParent(el);

    // Assert
    expect(rebuild).toHaveBeenCalledOnce();
  });
});
