import { describe, expect, it } from 'vitest';
import { roomNote, seatsLabel, type RoomFactsInput } from '../web/src/lib/rooms.js';

const room = (over: Partial<RoomFactsInput> = {}): RoomFactsInput => ({
  capacity: null,
  description: '',
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

describe('roomNote', () => {
  it('is empty for a room with nothing written about it', () => {
    expect(roomNote(room())).toBe('');
    expect(roomNote(room({ description: '   ' }))).toBe('');
  });

  it("carries the organiser's directions, trimmed", () => {
    expect(roomNote(room({ description: '  Ground floor, past the café  ' }))).toBe(
      'Ground floor, past the café',
    );
  });

  it('says nothing about seats — those stay on the card', () => {
    expect(roomNote(room({ capacity: 60 }))).toBe('');
  });
});
