import { describe, expect, it } from 'vitest'
import { computeGroupStandings } from './standings'

// m(a, b, sa, sb): finished match, winner by score
const m = (a: string, b: string, sa: number, sb: number, status: 'finished' | 'confirmed' | 'live' | 'scheduled' = 'confirmed') => ({
  status, team_a_id: a, team_b_id: b, score_a: sa, score_b: sb, winner: (sa > sb ? 'A' : 'B') as 'A' | 'B',
})
const order = (r: { teamId: string }[]) => r.map(x => x.teamId)

describe('computeGroupStandings', () => {
  it('orders by wins', () => {
    const r = computeGroupStandings(['a', 'b', 'c'], [m('a', 'b', 11, 5), m('a', 'c', 11, 5), m('b', 'c', 11, 8)])
    expect(order(r)).toEqual(['a', 'b', 'c'])
    expect(r.map(x => x.rank)).toEqual([1, 2, 3])
    expect(r[0].wins).toBe(2)
  })

  it('breaks a 2-way tie by head-to-head', () => {
    // a, b, c, d: a and b both 2-1 with equal diff; b beat a
    const r = computeGroupStandings(['a', 'b', 'c', 'd'], [
      m('a', 'b', 5, 11), m('a', 'c', 11, 5), m('a', 'd', 11, 5),
      m('b', 'c', 11, 5), m('b', 'd', 5, 11), m('c', 'd', 11, 5),
    ])
    // a: +6-... a diff=-6+6+6=6, b: +6+6-6=6, d 2-1? d beats b, loses a, loses c => 1-2
    expect(r[0].teamId).toBe('b')
    expect(r[1].teamId).toBe('a')
    expect(r[0].tiebreak).toBe('h2h')
    expect(r.some(x => x.needsDecision)).toBe(false)
  })

  it('flags a cyclic 3-way tie as needsDecision', () => {
    const ms = [m('a', 'b', 11, 5), m('b', 'c', 11, 5), m('c', 'a', 11, 5)]
    const r = computeGroupStandings(['a', 'b', 'c'], ms)
    expect(r.every(x => x.needsDecision)).toBe(true)
  })

  it('resolves manualOrder', () => {
    const ms = [m('a', 'b', 11, 5), m('b', 'c', 11, 5), m('c', 'a', 11, 5)]
    const r = computeGroupStandings(['a', 'b', 'c'], ms, ['c', 'a', 'b'])
    expect(order(r)).toEqual(['c', 'a', 'b'])
    expect(r.every(x => !x.needsDecision && x.tiebreak === 'manual')).toBe(true)
  })

  it('partial 3-way break: mini-table separates one team, h2h splits the other two', () => {
    // a,b,c all 2-1 with overall diff +7. Mini (a,b,c): all 1 win; mini diff a=-3, b=-3, c=+6.
    const r = computeGroupStandings(['a', 'b', 'c', 'd'], [
      m('a', 'b', 11, 5), m('b', 'c', 11, 8), m('c', 'a', 11, 2),
      m('a', 'd', 11, 1), m('b', 'd', 11, 1), m('c', 'd', 11, 10),
    ])
    expect(order(r)).toEqual(['c', 'a', 'b', 'd'])
    expect(r.every(x => !x.needsDecision)).toBe(true)
    expect(r[1].tiebreak).toBe('h2h')
  })

  it('ignores scheduled/live matches', () => {
    const r = computeGroupStandings(['a', 'b'], [m('a', 'b', 11, 5, 'live'), m('a', 'b', 11, 5, 'scheduled')])
    expect(r.every(x => x.played === 0)).toBe(true)
  })
})
