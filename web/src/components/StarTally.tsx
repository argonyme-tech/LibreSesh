/**
 * One star and one number: whether it is on your agenda, and how many people
 * put it on theirs.
 *
 * There were two of each. A list card drew a ☆/★ toggle at the top right and
 * a separate "★ 12" at the bottom, which reads as two different facts about
 * starring and leaves the reader working out which one is theirs. A grid block
 * drew its two side by side in the row above the title — so a starred session
 * sat with its title a line lower than the identical block beside it, and the
 * one thing every block is read for moved because of something that is not
 * about the session at all.
 *
 * One object says both. The star is amber when the star is yours, the number
 * beside it is everyone, and it sits in the bottom-right corner where nothing
 * above it has to move to make room.
 */
export function StarTally({
  starred,
  count,
  overCapacity = false,
  onToggle,
  sessionTitle,
  className = '',
}: {
  starred: boolean;
  count: number;
  /** More interest than the room holds — the signal an organiser acts on. */
  overCapacity?: boolean;
  /** Given, the tally is also the control that stars the session. Left out
   *  where the surface cannot spare a click target: a grid block's pointer
   *  handling is drag-sensitive, so starring there happens in the sheet. */
  onToggle?: () => void;
  /** The session's title, for the control's accessible name. Only the
   *  interactive tally needs one — the block around a display tally already
   *  announces both facts in its own label. */
  sessionTitle?: string;
  className?: string;
}) {
  const tally = (
    <>
      {/* Filled wherever it is a count; hollow only where it is an unpressed
          control, which is the one place the shape has to be an invitation. */}
      <span aria-hidden="true">{starred || onToggle === undefined ? '★' : '☆'}</span>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </>
  );

  const tone = starred
    ? 'text-amber-500 dark:text-amber-400'
    : overCapacity
      ? 'font-medium text-amber-700 dark:text-amber-400'
      : 'text-stone-400 dark:text-stone-500';

  if (onToggle === undefined) {
    return (
      <span aria-hidden="true" className={`flex items-center gap-0.5 ${tone} ${className}`}>
        {tally}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={`${starred ? 'Unstar' : 'Star'} ${sessionTitle ?? 'this session'}${
        count > 0 ? `. Starred by ${count}${overCapacity ? ', more than the room holds' : ''}` : ''
      }`}
      onClick={(e) => {
        // Do not let the tap fall through and open the session.
        e.stopPropagation();
        onToggle();
      }}
      className={`-m-1 flex shrink-0 items-center gap-0.5 rounded-full p-1 leading-none ${tone} ${
        starred ? '' : 'hover:text-amber-500'
      } ${className}`}
    >
      {tally}
    </button>
  );
}
