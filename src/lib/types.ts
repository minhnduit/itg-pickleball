export type Side = 'A' | 'B'
export type MatchStatus = 'scheduled' | 'called' | 'live' | 'finished' | 'confirmed'
export type ResultType = 'normal' | 'forfeit' | 'retired' | 'no_show'

export interface Tournament { id: string; name: string; event_date: string | null; slug: string | null; created_at: string }
export interface Organizer { tournament_id: string; user_id: string }
export interface Court { id: string; tournament_id: string; name: string; sort: number }

export interface StageConfig {
  top_n?: number
  manual_order?: Record<string, string[]>
  closed?: boolean
  source_stage_id?: string
  rank_from?: number
  rank_to?: number | null
}
export interface Stage {
  id: string; tournament_id: string; name: string; kind: 'round_robin' | 'knockout'; sort: number
  points_to: number; win_by: number; cap: number | null; config: StageConfig
}
export interface Group { id: string; stage_id: string; name: string; sort: number }
export interface Team {
  id: string; tournament_id: string; name: string; player1: string; player2: string
  group_id: string | null; seed: number | null
}
export interface Match {
  id: number; tournament_id: string; stage_id: string; group_id: string | null
  round: number; position: number; label: string | null
  slot_a: string | null; slot_b: string | null
  team_a_id: string | null; team_b_id: string | null
  court_id: string | null; queue_order: number | null
  status: MatchStatus; result_type: ResultType
  points_to: number | null; win_by: number | null; cap: number | null
  score_a: number; score_b: number
  serving_team: Side | null; server_number: 1 | 2 | null
  sides_switched: boolean; winner: Side | null
  started_at: string | null; finished_at: string | null; updated_at: string
}
export interface MatchEvent {
  id: number; match_id: number
  kind: 'start' | 'rally' | 'undo' | 'special' | 'override' | 'confirm' | 'reopen'
  rally_winner: Side | null; undoes_event_id: number | null; actor: string; note: string | null
  score_a: number | null; score_b: number | null; serving_team: string | null
  server_number: number | null; sides_switched: boolean | null; created_at: string
}
export interface RefTokenRow {
  id: string; tournament_id: string; court_id: string; label: string | null
  device_id: string | null; expires_at: string; revoked: boolean; created_at: string
}
export interface RefClaim { court_id: string; court_name: string; tournament_id: string; expires_at: string }
