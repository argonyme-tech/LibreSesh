import { describe, expect, it } from 'vitest';
import {
  DURATION_CHOICES,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  SNAP_MINUTES,
  durationLabel,
} from '../server/src/shared/sessionLimits.js';

describe('session limits', () => {
  it('prints a length the way a programme does', () => {
    expect(durationLabel(5)).toBe('5 min');
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(60)).toBe('1 h');
    expect(durationLabel(90)).toBe('1 h 30 min');
    expect(durationLabel(480)).toBe('8 h');
    expect(durationLabel(MAX_DURATION_MINUTES)).toBe('24 h');
  });

  it('offers only choices the server would accept', () => {
    for (const choice of DURATION_CHOICES) {
      expect(choice % SNAP_MINUTES).toBe(0);
      expect(choice).toBeGreaterThanOrEqual(MIN_DURATION_MINUTES);
      expect(choice).toBeLessThanOrEqual(MAX_DURATION_MINUTES);
    }
  });
});
