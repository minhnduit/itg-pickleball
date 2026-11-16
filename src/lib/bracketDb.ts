import { supabase } from './supabase'
import type { BracketMatch } from './bracket'

// Inserts a bracket round by round so W:<id> slots can reference real ids.
export async function insertBracket(
  tournamentId: string, stageId: string, bracket: BracketMatch[], startQueue: number,
): Promise<void> {
  const idOf = new Map<string, number>()
  let counter = 0
  const maxRound = Math.max(0, ...bracket.map(b => b.round))
  for (let r = 1; r <= maxRound; r++) {
    const ms = bracket.filter(b => b.round === r)
    if (!ms.length) continue
    const slot = (s: BracketMatch['a']) => (s.kind === 'entry' ? s.slot : `W:${idOf.get(s.key)}`)
    const rows = ms.map(b => ({
      tournament_id: tournamentId, stage_id: stageId, round: b.round, position: b.position, label: b.label,
      slot_a: slot(b.a), slot_b: slot(b.b), team_a_id: b.teamA, team_b_id: b.teamB,
      points_to: b.pointsTo, win_by: b.winBy, cap: b.cap, queue_order: startQueue + ++counter,
    }))
    const { data, error } = await supabase.from('matches').insert(rows).select('id,position')
    if (error) throw new Error(error.message)
    ;(data as { id: number; position: number }[]).forEach(row => {
      const b = ms.find(x => x.position === row.position)
      if (b) idOf.set(b.key, row.id)
    })
  }
}
