/**
 * The server's half of a repeat: the wire schema, and the refusals as 400s.
 *
 * The calendar itself lives in `shared/repeat.ts`, where the session form can
 * reach it — so the run the form counts is the run the server creates, and a
 * rule the JSON importer refuses is refused in the form too.
 */
import { z } from 'zod';
import { badRequest } from './errors.js';
import {
  checkRepeat,
  repeatDates,
  WEEKDAY_NAMES,
  type Repeat,
  type RepeatDates,
  type RepeatLimits,
} from './shared/repeat.js';
import { dateSchema } from './validation.js';

export { describeRepeat, MAX_REPEAT_DAYS } from './shared/repeat.js';
export type { Repeat } from './shared/repeat.js';

export const repeatSchema = z
  .object({
    until: dateSchema,
    days: z.array(z.enum(WEEKDAY_NAMES)).min(1).max(7).optional(),
    except: z.array(dateSchema).max(200).optional(),
  })
  .strict();

export interface RepeatOptions extends RepeatLimits {
  /** Prefixes every message, e.g. `sessions[3] "Standup"`. */
  label?: string;
}

/** `checkRepeat`, as a refusal. */
export function repeatDays(first: string, repeat: Repeat, options: RepeatOptions): RepeatDates {
  const problem = checkRepeat(first, repeat, options);
  if (problem) throw badRequest(options.label ? `${options.label}: ${problem}` : problem);
  return repeatDates(first, repeat);
}
