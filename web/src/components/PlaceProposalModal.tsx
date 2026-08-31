import { useState } from 'react';
import type { ProposalDto, RoomDto } from '@shared/types';
import type { PlaceWrite } from '../lib/api';
import { fmtMin } from '../lib/format';
import { zonedTimeToUtc } from '@shared/time';
import {
  Field,
  FormError,
  FormGrid,
  Modal,
  PrimaryButton,
  SecondaryButton,
  inputClass,
} from './ui';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

export interface PlaceProposalModalProps {
  proposal: ProposalDto;
  rooms: RoomDto[];
  timezone: string;
  days: string[];
  dayLabels: Record<string, string>;
  defaultDay: string;
  dayStartMin: number;
  saving: boolean;
  onCancel: () => void;
  onPlace: (body: PlaceWrite) => void;
}

/** Organiser-only: turn a pitch into a real session by giving it a room and a
 *  slot. Fields mirror SessionModal, including the wall-clock → UTC conversion. */
export function PlaceProposalModal({
  proposal,
  rooms,
  timezone,
  days,
  dayLabels,
  defaultDay,
  dayStartMin,
  saving,
  onCancel,
  onPlace,
}: PlaceProposalModalProps) {
  const [roomId, setRoomId] = useState<number>(rooms[0]?.id ?? 0);
  const [day, setDay] = useState(defaultDay);
  const [start, setStart] = useState(fmtMin(Math.max(dayStartMin, 14 * 60)));
  const [durMin, setDurMin] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const place = () => {
    if (!roomId) {
      setError('Add a room first');
      return;
    }
    const [h, m] = start.split(':').map(Number);
    const startMin = Math.round(((h ?? 0) * 60 + (m ?? 0)) / 5) * 5;
    onPlace({
      roomId,
      startsAt: zonedTimeToUtc(day, startMin, timezone).toISOString(),
      endsAt: zonedTimeToUtc(day, startMin + durMin, timezone).toISOString(),
    });
  };

  return (
    <Modal
      title="Place on the grid"
      description={`“${proposal.title}” becomes a session. Its tags and speaker carry over.`}
      onClose={onCancel}
      onSubmit={place}
      footer={
        <>
          {error && <FormError className="basis-full">{error}</FormError>}
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={saving || rooms.length === 0}>
            {saving ? 'Placing…' : 'Place session'}
          </PrimaryButton>
        </>
      }
    >
      <FormGrid>
        <Field label="Room">
          <select
            value={roomId}
            onChange={(e) => setRoomId(Number(e.target.value))}
            className={inputClass}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.openBooking ? ' (open)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day">
          <select value={day} onChange={(e) => setDay(e.target.value)} className={inputClass}>
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabels[d] ?? d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start" hint="In 5-minute steps.">
          <input
            type="time"
            step={300}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Duration">
          <select
            value={durMin}
            onChange={(e) => setDurMin(Number(e.target.value))}
            className={inputClass}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </Field>
      </FormGrid>
    </Modal>
  );
}
