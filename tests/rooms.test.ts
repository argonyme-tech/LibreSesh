import { describe, expect, it } from 'vitest';
import {
  hasRoomInfo,
  roomSummary,
  seatsLabel,
  type RoomFactsInput,
} from '../web/src/lib/rooms.js';

const room = (over: Partial<RoomFactsInput> = {}): RoomFactsInput => ({
  capacity: null,
  description: '',
  openBooking: false,
  ...over,
});

describe('seatsLabel', () => {
  it('says nothing when capacity is unset', () => {
    expect(seatsLabel(null)).toBeNull();
  });

  it('agrees in number', () => {
    expect(seatsLabel(1)).toBe('1 seat');
    expect(seatsLabel(40)).toBe('40 seats');
  });

  it('keeps a deliberate zero', () => {
    expect(seatsLabel(0)).toBe('0 seats');
  });
});

describe('roomSummary', () => {
  it('is empty for a room with nothing set — never "no capacity set"', () => {
    expect(roomSummary(room())).toBe('');
  });

  it('shows seats alone', () => {
    expect(roomSummary(room({ capacity: 60 }))).toBe('60 seats');
  });

  it('shows the description alone', () => {
    expect(roomSummary(room({ description: 'Ground floor, past the café' }))).toBe(
      'Ground floor, past the café',
    );
  });

  it('reads seats first, then the description', () => {
    expect(roomSummary(room({ capacity: 60, description: 'Bring a laptop' }))).toBe(
      '60 seats · Bring a laptop',
    );
  });

  it('ignores a whitespace-only description', () => {
    expect(roomSummary(room({ capacity: 60, description: '   ' }))).toBe('60 seats');
  });
});

describe('hasRoomInfo', () => {
  it('is false for an untouched room', () => {
    expect(hasRoomInfo(room())).toBe(false);
    expect(hasRoomInfo(room({ description: '  ' }))).toBe(false);
  });

  it('is true once any of the three is set', () => {
    expect(hasRoomInfo(room({ capacity: 0 }))).toBe(true);
    expect(hasRoomInfo(room({ description: 'Upstairs' }))).toBe(true);
    expect(hasRoomInfo(room({ openBooking: true }))).toBe(true);
  });
});
