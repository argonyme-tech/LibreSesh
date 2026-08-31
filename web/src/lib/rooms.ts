import type { RoomDto } from '@shared/types';

/** Only what a room card reads, so tests and callers need no full DTO. */
export type RoomFactsInput = Pick<RoomDto, 'capacity' | 'description' | 'openBooking'>;

/** "40 seats", "1 seat", or nothing at all. Capacity is optional by design —
 *  most unconference rooms never get one — so an unset capacity has nothing to
 *  say to a reader. "no capacity set" told them about an empty database column,
 *  not about the room. */
export const seatsLabel = (capacity: number | null): string | null =>
  capacity === null ? null : `${capacity} seat${capacity === 1 ? '' : 's'}`;

/** The one line under a room's name on the schedule: seats and the organiser's
 *  note, in that order, skipping whatever is unset. Empty when the room carries
 *  nothing — the card then shows its name alone rather than an apology. */
export function roomSummary(room: RoomFactsInput): string {
  return [seatsLabel(room.capacity), room.description.trim()].filter(Boolean).join(' · ');
}

/** Whether the room has anything worth opening a panel for. */
export const hasRoomInfo = (room: RoomFactsInput): boolean =>
  room.capacity !== null || room.description.trim() !== '' || room.openBooking;
