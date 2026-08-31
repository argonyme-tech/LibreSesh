import logoOneline from '../assets/brand/logo-oneline.svg';
import logoOnelineReversed from '../assets/brand/logo-oneline-reversed.svg';
import logoStacked from '../assets/brand/logo.svg';
import logoStackedReversed from '../assets/brand/logo-reversed.svg';
import mark from '../assets/brand/mark.svg';
import markReversed from '../assets/brand/mark-reversed.svg';

export interface LogoProps {
  /** `stacked` carries the "open source scheduling" tagline beneath the
   *  wordmark; `oneline` is the wordmark alone, for a header that already has
   *  something else to say beside it; `mark` drops the wordmark too, leaving
   *  the brackets and the calendar — near-square, for a phone header where the
   *  horizontal space belongs to the event name. */
  variant?: 'stacked' | 'oneline' | 'mark';
  /** Size it by height — the SVGs carry their own aspect ratio. */
  className?: string;
}

const VARIANTS = {
  stacked: [logoStacked, logoStackedReversed],
  oneline: [logoOneline, logoOnelineReversed],
  mark: [mark, markReversed],
} as const;

/** The brand mark. Each variant ships as two files rather than one tinted with
 *  `currentColor`, because the artwork is three colours, not one: dark mode
 *  lightens the wordmark and *darkens* the calendar cells. So the theme swaps
 *  the file. Only one is ever displayed, and `display: none` keeps the other
 *  out of the accessibility tree, so both may carry the same alt text.
 *
 *  Because the theme swap already spends this component's `display` classes,
 *  `className` must not carry responsive visibility of its own — a `sm:hidden`
 *  here would race `dark:block` in the cascade. Switch variants by breakpoint
 *  from a wrapper element instead. */
export function Logo({ variant = 'stacked', className = '' }: LogoProps) {
  const [light, dark] = VARIANTS[variant];

  return (
    <>
      <img src={light} alt="LibreSesh" className={`${className} dark:hidden`} />
      <img src={dark} alt="LibreSesh" className={`hidden ${className} dark:block`} />
    </>
  );
}
