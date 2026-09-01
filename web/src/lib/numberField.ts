/**
 * The one numeric input in the app.
 *
 * `type="number"` looked like it did this job and does not: the browser
 * enforces `min`/`max` on the spinner and on form submit, but never on a typed
 * or pasted value, and a React form reading `e.target.value` never submits. Two
 * things went wrong because of that. Nonsense went in — `1e5`, `--3`, a pasted
 * word — and came back out of `e.target.value` as `''`, silently emptying a
 * field the person thought they were filling. And a number outside the range
 * went all the way to the server before anyone said so: `Number('')` is `0`, so
 * "keep 0 audit entries — that is, keep everything, forever" is what an
 * organiser got for clearing the box to retype it.
 *
 * So the value is a string the whole way, digits are the only thing that can
 * enter it, and the range is checked where it is typed rather than after a
 * round trip. Every numeric field in the app is a non-negative integer, which
 * is why there is no sign or decimal here to strip.
 */

export interface NumberFieldSpec {
  min: number;
  max: number;
  /**
   * Values allowed outside `[min, max]`. Audit retention's `0` is the only one:
   * it means "keep everything", which is not a smaller version of a hundred,
   * so the range cannot simply start at zero.
   */
  alsoAllow?: readonly number[];
  /** Whether blank is an answer ("no capacity set") or an unfinished field. */
  allowEmpty?: boolean;
  /** What is being counted, for the message: "seats", "days", "entries". */
  unit?: string;
}

export interface NumberFieldValue {
  /** `null` when blank, or when the text is not a number we can use. */
  value: number | null;
  /** What to show under the field, or `null` when there is nothing wrong. */
  error: string | null;
}

const group = (n: number): string => n.toLocaleString('en-US');

/** The widest a legitimate answer can be, so the field stops accepting digits
 *  at that point rather than letting someone type past the maximum. */
export const maxDigits = (spec: NumberFieldSpec): number =>
  String(Math.max(spec.max, ...(spec.alsoAllow ?? []))).length;

/**
 * What the field is allowed to contain after a keystroke or a paste.
 *
 * Leading zeros collapse as you type ("08" → "8") so they cannot eat the digit
 * budget, but a lone "0" survives — it is a real answer for both capacity and
 * audit retention.
 */
export const sanitizeNumberInput = (raw: string, spec: NumberFieldSpec): string =>
  raw
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, maxDigits(spec));

/** How a violated range reads. Built from the spec so the message cannot drift
 *  away from what the field actually accepts. */
export const rangeMessage = (spec: NumberFieldSpec): string => {
  const unit = spec.unit ? ` ${spec.unit}` : '';
  const range = `between ${group(spec.min)} and ${group(spec.max)}${unit}`;
  const extras = (spec.alsoAllow ?? []).map(group);
  return extras.length ? `Must be ${extras.join(' or ')}, or ${range}` : `Must be ${range}`;
};

/** The number a field's text stands for, and why it does not stand for one. */
export const parseNumberField = (raw: string, spec: NumberFieldSpec): NumberFieldValue => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { value: null, error: spec.allowEmpty ? null : 'Enter a number' };
  }
  // Unreachable from the input, which sanitizes every change — but a value can
  // also arrive from props, and this is the function callers trust.
  if (!/^\d+$/.test(trimmed)) return { value: null, error: 'Digits only' };

  const n = Number(trimmed);
  const allowed = (spec.alsoAllow ?? []).includes(n) || (n >= spec.min && n <= spec.max);
  return allowed ? { value: n, error: null } : { value: null, error: rangeMessage(spec) };
};

/* ------------------- The numeric fields this app has ------------------- */

/**
 * Room capacity. The server takes up to 100,000; four digits is a deliberate
 * client-side tightening, because no venue this tool is for seats ten thousand
 * and a typo of that size is worth catching where it is made. Blank is a real
 * answer — most unconference rooms never get a capacity at all.
 */
export const capacityField: NumberFieldSpec = {
  min: 0,
  max: 9999,
  allowEmpty: true,
  unit: 'seats',
};

/** Mirrors `weekRailFromSchema`. */
export const weekRailFromField: NumberFieldSpec = { min: 1, max: 90, unit: 'days' };

/** Mirrors `auditKeepSchema`, `0` (keep everything) and all. */
export const auditKeepField: NumberFieldSpec = {
  min: 100,
  max: 1_000_000,
  alsoAllow: [0],
  unit: 'entries',
};
