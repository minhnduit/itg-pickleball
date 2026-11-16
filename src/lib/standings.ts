import type { Match } from './types'

export interface StandingRow {
  teamId: string; played: number; wins: number; losses: number
  pointsFor: number; pointsAgainst: number; diff: number
  rank: number; tiebreak: null | 'h2h' | 'manual'; needsDecision: boolean
}
type M = Pick<Match, 'status' | 'team_a_id' | 'team_b_id' | 'score_a' | 'score_b' | 'winner'>
type Tally = { wins: number; pf: number; pa: number; played: number }

function tally(ids: string[], ms: M[]): Map<string, Tally> {
  const t = new Map(ids.map(id => [id, { wins: 0, pf: 0, pa: 0, played: 0 }]))
  for (const m of ms) {
    const a = t.get(m.team_a_id as string), b = t.get(m.team_b_id as string)
    if (!a || !b) continue
    a.played++; b.played++
    a.pf += m.score_a; a.pa += m.score_b
    b.pf += m.score_b; b.pa += m.score_a
    if (m.winner === 'A') a.wins++; else b.wins++
  }
  return t
}

// Sort ids by (wins, diff) desc using tally, split into blocks of equal key.
function sortBlocks(ids: string[], t: Map<string, Tally>): string[][] {
  const key = (id: string) => { const x = t.get(id)!; return [x.wins, x.pf - x.pa] as const }
  const sorted = [...ids].sort((p, q) => key(q)[0] - key(p)[0] || key(q)[1] - key(p)[1])
  const blocks: string[][] = []
  for (const id of sorted) {
    const last = blocks[blocks.length - 1]
    if (last && key(last[0])[0] === key(id)[0] && key(last[0])[1] === key(id)[1]) last.push(id)
    else blocks.push([id])
  }
  return blocks
}

export function computeGroupStandings(teamIds: string[], matches: M[], manualOrder?: string[]): StandingRow[] {
  const ms = matches.filter(m =>
    (m.status === 'finished' || m.status === 'confirmed') && m.winner &&
    m.team_a_id && m.team_b_id && teamIds.includes(m.team_a_id) && teamIds.includes(m.team_b_id))
  const full = tally(teamIds, ms)
  const meta = new Map<string, { tiebreak: 'h2h' | 'manual' | null; needsDecision: boolean }>()
  teamIds.forEach(id => meta.set(id, { tiebreak: null, needsDecision: false }))

  const resolve = (block: string[]): string[] => {
    const mini = tally(block, ms)
    const subs = sortBlocks(block, mini)
    if (subs.length === 1) {
      if (manualOrder && block.every(id => manualOrder.includes(id))) {
        block.forEach(id => (meta.get(id)!.tiebreak = 'manual'))
        return [...block].sort((a, b) => manualOrder.indexOf(a) - manualOrder.indexOf(b))
      }
      const ordered = teamIds.filter(id => block.includes(id))
      ordered.forEach(id => (meta.get(id)!.needsDecision = true))
      return ordered
    }
    block.forEach(id => (meta.get(id)!.tiebreak = 'h2h'))
    return subs.flatMap(s => (s.length > 1 ? resolve(s) : s))
  }

  const order = sortBlocks(teamIds, full).flatMap(b => (b.length > 1 ? resolve(b) : b))
  return order.map((teamId, i) => {
    const x = full.get(teamId)!
    return {
      teamId, played: x.played, wins: x.wins, losses: x.played - x.wins,
      pointsFor: x.pf, pointsAgainst: x.pa, diff: x.pf - x.pa,
      rank: i + 1, ...meta.get(teamId)!,
    }
  })
}

const done = (s: string) => s === 'finished' || s === 'confirmed'
export const groupComplete = (ms: Pick<Match, 'status'>[]) => ms.length > 0 && ms.every(m => done(m.status))
export const allConfirmed = (ms: Pick<Match, 'status'>[]) => ms.length > 0 && ms.every(m => m.status === 'confirmed')
