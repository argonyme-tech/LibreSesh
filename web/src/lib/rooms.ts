import type { RoomDto } from '@shared/types';

/** Only what a room card reads, so tests and callers need no full DTO. */
export type RoomFactsInput = Pick<RoomDto, 'capacity' | 'description'>;

/** "40 seats", "1 seat", or nothing at all. Capacity is optional by design —
 *  most unconference rooms never get one — so an unset capacity has nothing to
 *  say to a reader. "no capacity set" told them about an empty database column,
 *  not about the room. */
export const seatsLabel = (capacity: number | null): string | null =>
  capacity === null ? null : `${capacity} seat${capacity === 1 ? '' : 's'}`;

/**
 * The organiser's directions — which floor, which door, what to bring — or ''
 * when there are none.
 *
 * This is the one thing about a room the card has no space for, so it is the
 * one thing behind the info button. Seats and the booking permission stay on
 * the card, and are deliberately not repeated in the panel: a panel that says
 * again what is already on screen gives a reader nothing for the hover.
 */
export const roomNote = (room: RoomFactsInput): string => room.description.trim();
