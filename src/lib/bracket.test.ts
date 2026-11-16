import { describe, expect, it } from 'vitest'
import { buildBracket, stageChampion, buildKnockout, seedPositions, seedQualifiers, type Entry } from './bracket'
import type { StandingRow } from './standings'
import type { Match, Stage } from './types'

const rules = { pointsTo: 11, winBy: 2, cap: 15 }
const mk = (n: number, groupOf: (i: number) => string = i => `g${i}`): Entry[] =>
  Array.from({ length: n }, (_, i) => ({ slot: `G:${groupOf(i)}:${i + 1}`, teamId: `t${i + 1}`, groupId: groupOf(i) }))
const slotsIn = (b: ReturnType<typeof buildBracket>, round: number) => b.filter(m => m.round === round)

describe('seedPositions', () => {
  it('8', () => expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]))
})

describe('buildBracket', () => {
  it('8 teams: 7 matches, 1 v 8', () => {
    const b = buildBracket(mk(8), rules)
    expect(b.length).toBe(7)
    expect(slotsIn(b, 1).length).toBe(4)
    expect(b[0].teamA).toBe('t1'); expect(b[0].teamB).toBe('t8')
    expect(b.map(m => m.label).slice(4)).toEqual(['BK1', 'BK2', 'CK'])
    expect(b[0].label).toBe('TK1')
  })

  it('6 teams: 5 matches, seeds 1 and 2 have byes', () => {
    const b = buildBracket(mk(6), rules)
    expect(b.length).toBe(5)
    expect(slotsIn(b, 1).length).toBe(2)
    const sf = slotsIn(b, 2).flatMap(m => [m.teamA, m.teamB])
    expect(sf).toContain('t1'); expect(sf).toContain('t2')
  })

  it('5 teams: 4 matches, seeds 1-3 have byes, single R1 match 4v5', () => {
    const b = buildBracket(mk(5), rules)
    expect(b.length).toBe(4)
    const r1 = slotsIn(b, 1)
    expect(r1.length).toBe(1)
    expect([r1[0].teamA, r1[0].teamB]).toEqual(['t4', 't5'])
    const r2 = slotsIn(b, 2).flatMap(m => [m.teamA, m.teamB])
    for (const t of ['t1', 't2', 't3']) expect(r2).toContain(t)
  })

  it('12 teams: 11 matches, seeds 1-4 have byes', () => {
    const b = buildBracket(mk(12), rules)
    expect(b.length).toBe(11)
    expect(slotsIn(b, 1).length).toBe(4)
    const r2 = slotsIn(b, 2).flatMap(m => [m.teamA, m.teamB])
    for (const t of ['t1', 't2', 't3', 't4']) expect(r2).toContain(t)
  })

  it('SF and Final 15/1/no cap, earlier 11/15', () => {
    const b = buildBracket(mk(16), rules)
    for (const m of b) {
      if (m.round >= 3) expect([m.pointsTo, m.winBy, m.cap]).toEqual([15, 1, null])
      else expect([m.pointsTo, m.cap]).toEqual([11, 15])
    }
  })

  it('n-1 matches for n in 2..16', () => {
    for (let n = 2; n <= 16; n++) expect(buildBracket(mk(n), rules).length).toBe(n - 1)
  })

  it('swaps to avoid same-group round-1 clash', () => {
    // seeds 1 and 8 share group X: naive 1v8 clashes
    const e = mk(8, i => (i === 0 || i === 7 ? 'X' : `g${i}`))
    const b = buildBracket(e, rules)
    const r1 = slotsIn(b, 1)
    const g = (t: string | null) => e.find(x => x.teamId === t)!.groupId
    expect(r1.some(m => g(m.teamA) === g(m.teamB))).toBe(false)
    expect(b.length).toBe(7)
  })
})

describe('seedQualifiers', () => {
  const row = (teamId: string, wins: number, diff: number, rank: number): StandingRow =>
    ({ teamId, played: 3, wins, losses: 3 - wins, pointsFor: 30, pointsAgainst: 30 - diff, diff, rank, tiebreak: null, needsDecision: false })
  it('winners first (sorted across groups), then runners-up', () => {
    const e = seedQualifiers([
      { groupId: 'A', rows: [row('a1', 2, 5, 1), row('a2', 1, 0, 2)] },
      { groupId: 'B', rows: [row('b1', 3, 9, 1), row('b2', 2, 4, 2)] },
    ], 1, 2)
    expect(e.map(x => x.teamId)).toEqual(['b1', 'a1', 'b2', 'a2'])
    expect(e[0].slot).toBe('G:B:1')
  })
})

describe('buildKnockout template', () => {
  const g = (id: string, size = 4) => ({ groupId: id, ranked: Array.from({ length: size }, (_, i) => `${id}${i + 1}`) })
  const slots = (m: { a: { kind: string; slot?: string }; b: { kind: string; slot?: string } }) => [m.a.slot, m.b.slot]
  const four = [g('A'), g('B'), g('C'), g('D')]

  it('4 groups ranks 1-2: exact pairs, labels, feeders', () => {
    const b = buildKnockout(four, 1, 2, rules)
    expect(b.length).toBe(7)
    const r1 = b.filter(m => m.round === 1)
    // display order TK1, TK3, TK2, TK4
    expect(r1.map(m => m.label)).toEqual(['TK1', 'TK3', 'TK2', 'TK4'])
    const byLabel = (l: string) => b.find(m => m.label === l)!
    expect(slots(byLabel('TK1'))).toEqual(['G:A:1', 'G:B:2'])
    expect(slots(byLabel('TK2'))).toEqual(['G:B:1', 'G:A:2'])
    expect(slots(byLabel('TK3'))).toEqual(['G:C:1', 'G:D:2'])
    expect(slots(byLabel('TK4'))).toEqual(['G:D:1', 'G:C:2'])
    expect(byLabel('TK1').teamA).toBe('A1')
    const key = (l: string) => byLabel(l).key
    expect([byLabel('BK1').a, byLabel('BK1').b]).toEqual([{ kind: 'winner', key: key('TK1') }, { kind: 'winner', key: key('TK3') }])
    expect([byLabel('BK2').a, byLabel('BK2').b]).toEqual([{ kind: 'winner', key: key('TK2') }, { kind: 'winner', key: key('TK4') }])
    expect(byLabel('CK').a).toEqual({ kind: 'winner', key: key('BK1') })
    for (const m of b) {
      if (m.round === 1) expect([m.pointsTo, m.winBy, m.cap]).toEqual([11, 2, 15])
      else expect([m.pointsTo, m.winBy, m.cap]).toEqual([15, 1, null])
    }
  })

  it('ranks 3-4 (open ended, size 4) use Ba/Tu pairs', () => {
    const b = buildKnockout(four, 3, null, rules)
    expect(slots(b.find(m => m.label === 'TK1')!)).toEqual(['G:A:3', 'G:B:4'])
    expect(slots(b.find(m => m.label === 'TK4')!)).toEqual(['G:D:3', 'G:C:4'])
  })

  it('2 groups: BK1, BK2 cross pairs then CK', () => {
    const b = buildKnockout([g('A'), g('B')], 1, 2, rules)
    expect(b.map(m => m.label)).toEqual(['BK1', 'BK2', 'CK'])
    expect(slots(b[0])).toEqual(['G:A:1', 'G:B:2'])
    expect(slots(b[1])).toEqual(['G:B:1', 'G:A:2'])
    expect(b.every(m => m.pointsTo === 15 && m.winBy === 1 && m.cap === null)).toBe(true)
  })

  it('3 groups falls back to seeding with n-1 matches', () => {
    const b = buildKnockout([g('A'), g('B'), g('C')], 1, 2, rules)
    expect(b.length).toBe(5)
  })

  it('uneven groups (4/4/4/3, ranks 3-4) fall back with n-1 matches and no missing-rank slot', () => {
    const b = buildKnockout([g('A'), g('B'), g('C'), g('D', 3)], 3, 4, rules)
    expect(b.length).toBe(6) // 7 qualifiers
    const used = b.flatMap(m => [m.a, m.b]).filter(s => s.kind === 'entry').map(s => (s as { slot: string }).slot)
    expect(used).not.toContain('G:D:4')
  })
})

describe('stageChampion', () => {
  const st = { id: 's', kind: 'knockout' } as Stage
  const m = (round: number, status: string, winner: 'A' | 'B' | null) =>
    ({ id: round, stage_id: 's', round, status, winner, team_a_id: 'a', team_b_id: 'b' }) as unknown as Match
  it('confirmed final -> winner', () => expect(stageChampion(st, [m(1, 'confirmed', 'A'), m(2, 'confirmed', 'B')])).toBe('b'))
  it('finished but not confirmed -> null', () => expect(stageChampion(st, [m(2, 'finished', 'A')])).toBeNull())
  it('no matches -> null', () => expect(stageChampion(st, [])).toBeNull())
})
