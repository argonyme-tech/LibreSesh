import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dismiss, restore } from '../web/src/lib/useDismissed.js';

/**
 * The store under every "Hide" button Mímir offers.
 *
 * The first version kept one list per mounted component, loaded once. With
 * one aside per pitch card, hiding note B wrote B's stale snapshot over the
 * shared key and note A came back on reload. The store now reads before it
 * writes, so what these pin is that two independent hides both survive.
 */
const memory = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
};

describe('dismissals', () => {
  beforeEach(() => {
    memory.clear();
    (globalThis as { localStorage?: unknown }).localStorage = fakeStorage;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  const stored = () => JSON.parse(memory.get('mimir-dismissed') ?? '[]') as string[];

  it('keeps every hide, whoever wrote last', () => {
    // Two "instances" that never see each other's state.
    dismiss('pitch-1', 'backed');
    dismiss('pitch-2', 'backed');
    expect(stored()).toEqual(['pitch-1:backed', 'pitch-2:backed']);
  });

  it('does not store the same hide twice', () => {
    dismiss('session-5', 'long');
    dismiss('session-5', 'long');
    expect(stored()).toEqual(['session-5:long']);
  });

  it('restores one scope and leaves the others hidden', () => {
    dismiss('session-5', 'long');
    dismiss('session-5', 'floor');
    dismiss('session-6', 'long');
    restore('session-5');
    expect(stored()).toEqual(['session-6:long']);
  });

  it('survives storage being blocked', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => dismiss('x', 'y')).not.toThrow();
    expect(() => restore('x')).not.toThrow();
  });
});
