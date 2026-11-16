import { getDeviceId } from './device'
import { supabase } from './supabase'
import type { Match, RefClaim, ResultType, Side } from './types'

export type RefAuth = { token: string; device: string }

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}
const authArgs = (a?: RefAuth) => (a ? { p_token: a.token, p_device: a.device } : {})

export async function refClaim(key: string, pin: string | null): Promise<RefClaim> {
  const rows = await call<RefClaim[]>('ref_claim', { p_token: key, p_pin: pin, p_device: getDeviceId() })
  const row = Array.isArray(rows) ? rows[0] : (rows as RefClaim | null)
  if (!row) throw new Error('ref key invalid or expired')
  return row
}
export const scoreStart = (id: number, firstServe: Side, auth?: RefAuth) =>
  call<Match>('score_start', { p_match_id: id, p_first_serve: firstServe, ...authArgs(auth) })
export const scoreRally = (id: number, winner: Side, auth?: RefAuth) =>
  call<Match>('score_rally', { p_match_id: id, p_winner: winner, ...authArgs(auth) })
export const scoreUndo = (id: number, auth?: RefAuth) =>
  call<Match>('score_undo', { p_match_id: id, ...authArgs(auth) })
export const scoreSpecial = (id: number, result: Exclude<ResultType, 'normal'>, winner: Side, auth?: RefAuth) =>
  call<Match>('score_special_result', { p_match_id: id, p_result: result, p_winner: winner, ...authArgs(auth) })

export const orgSetScore = (id: number, a: number, b: number, reason: string) =>
  call<Match>('org_set_score', { p_match_id: id, p_score_a: a, p_score_b: b, p_reason: reason })
export const orgConfirm = (id: number) => call<Match>('org_confirm_match', { p_match_id: id })
export const orgReopen = (id: number, reason: string) =>
  call<Match>('org_reopen_match', { p_match_id: id, p_reason: reason })
export const orgCreateRefToken = (court: string, pin: string | null, hours: number, label: string | null) =>
  call<string>('org_create_ref_token', { p_court: court, p_pin: pin, p_hours: hours, p_label: label })
export const orgRevokeRefToken = (id: string) => call<void>('org_revoke_ref_token', { p_token_id: id })

export const isRefKeyDead = (msg: string) => msg.includes('another device') || msg.includes('invalid or expired')
