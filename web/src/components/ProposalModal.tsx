import { useState } from 'react';
import type { PersonDto, ProposalDto, ProposalPhase, TagDto } from '@shared/types';
import type { ProposalWrite } from '../lib/api';
import { SpeakerCombobox, type SpeakerChoice } from './SpeakerCombobox';
import {
  Chip,
  DangerButton,
  Field,
  FormStack,
  Modal,
  PrimaryButton,
  SecondaryButton,
  inputClass,
} from './ui';

export interface ProposalModalProps {
  proposal?: ProposalDto;
  people: PersonDto[];
  tags: TagDto[];
  saving: boolean;
  onCancel: () => void;
  onSave: (body: ProposalWrite) => void;
  onDelete?: () => void;
}

/** Pitch a session with no room or time yet — mirrors SessionModal's
 *  select-or-new speaker pattern (SPEC §8). */
export function ProposalModal({
  proposal,
  people,
  tags,
  saving,
  onCancel,
  onSave,
  onDelete,
}: ProposalModalProps) {
  const [title, setTitle] = useState(proposal?.title ?? '');
  const [description, setDescription] = useState(proposal?.description ?? '');
  const [speaker, setSpeaker] = useState<SpeakerChoice>({
    speakerId: proposal?.speakerId ?? null,
    newName: '',
  });
  const [tagIds, setTagIds] = useState<number[]>(proposal?.tagIds ?? []);
  const [phase, setPhase] = useState<ProposalPhase>(proposal?.phase ?? 'concern');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!title.trim()) {
      setError('A title is required');
      return;
    }
    onSave({
      title: title.trim(),
      description: description.trim(),
      ...(speaker.newName ? { speakerName: speaker.newName } : { speakerId: speaker.speakerId }),
      tagIds,
      phase,
    });
  };

  return (
    <Modal title={proposal ? 'Edit pitch' : 'Pitch a session'} onClose={onCancel}>
      <p className="-mt-2 mb-3 text-xs text-stone-500 dark:text-stone-400">
        Pitches have no room or time. An organiser places the popular ones on the grid.
      </p>

      <FormStack>
      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className={inputClass}
          autoFocus
        />
      </Field>
      <Field label="Speaker / host">
        <SpeakerCombobox people={people} value={speaker} onChange={setSpeaker} />
      </Field>
      <Field label="Description" hint="Markdown is supported.">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={5000}
          className={`${inputClass} resize-none`}
        />
      </Field>

      <Field label="Tags">
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 && (
            <span className="text-xs text-stone-400 dark:text-stone-500">No tags yet.</span>
          )}
          {tags.map((t) => (
            <Chip
              key={t.id}
              dot={t.color}
              active={tagIds.includes(t.id)}
              onClick={() =>
                setTagIds((prev) =>
                  prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                )
              }
            >
              {t.name}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Mímir add-on: optional decision phase. Defaults to 'concern' and
          changes nothing for people who ignore it. */}
      <Field label="Phase" hint="Where this pitch sits in the decision sequence — optional.">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['concern', '💭 Concern'],
              ['inquiry', '🔍 Inquiry'],
              ['proposal', '📋 Proposal'],
              ['decision', '◇ Decision'],
            ] as [ProposalPhase, string][]
          ).map(([ph, label]) => (
            <Chip key={ph} active={phase === ph} onClick={() => setPhase(ph)}>
              {label}
            </Chip>
          ))}
        </div>
      </Field>
      </FormStack>

      {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex gap-2">
        {onDelete && (
          <DangerButton onClick={onDelete}>Withdraw</DangerButton>
        )}
        <SecondaryButton className="ml-auto" onClick={onCancel}>
          Cancel
        </SecondaryButton>
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
