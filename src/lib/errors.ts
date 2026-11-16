import type { T } from './i18n'

// First match wins: order matters (downstream "already started" before the generic one).
const RULES: [test: (m: string) => boolean, key: Parameters<T>[0]][] = [
  [m => m.includes('wrong pin'), 'errWrongPin'],
  [m => m.includes('reason required'), 'errReasonRequired'],
  [m => m.includes('invalid or expired'), 'newQr'],
  [m => m.includes('another device'), 'errOtherDevice'],
  [m => m.includes('not claimed yet'), 'errNotClaimed'],
  [m => m.includes('not on your court'), 'errNotYourCourt'],
  [m => m.includes('organizer only'), 'errOrgOnly'],
  [m => m.includes('reopen it first'), 'errReopenFirst'],
  [m => m.includes('later match') && m.includes('already started'), 'errDownstreamStarted'],
  [m => m.includes('already started'), 'errAlreadyStarted'],
  [m => m.includes('only finished matches can be confirmed'), 'errNotFinished'],
  [m => m.includes('nothing to undo'), 'errNothingToUndo'],
  [m => m.includes('both teams must be set'), 'errTeamsNotSet'],
  [m => m.includes('pin must be'), 'errPinFormat'],
  [m => m.includes('tournaments_slug_key') || (m.includes('duplicate key') && m.includes('slug')), 'errSlugTaken'],
  [m => m.includes('match is not live'), 'errNotLive'],
]

// Display only: callers that inspect messages must keep using the raw string.
export function friendlyError(msg: string, t: T): string {
  const low = msg.toLowerCase()
  const hit = RULES.find(([test]) => test(low))
  return hit ? t(hit[1]) : msg
}
