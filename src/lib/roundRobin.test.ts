import { describe, expect, it } from 'vitest'
import { circleRounds, groupName, scheduleGroups, shuffle, snakeDistribute } from './roundRobin'

const ids = (n: number, p = 't') => Array.from({ length: n }, (_, i) => `${p}${i + 1}`)

describe('circleRounds', () => {
  for (const n of [4, 5, 6]) {
    it(`${n} teams: every pair once, nobody twice per round`, () => {
      const rounds = circleRounds(ids(n))
      expect(rounds.length).toBe(n % 2 ? n : n - 1)
      const seen = new Set<string>()
      for (const r of rounds) {
        const inRound = r.flat()
        expect(new Set(inRound).size).toBe(inRound.length)
        for (const [a, b] of r) seen.add([a, b].sort().join('|'))
      }
      expect(seen.size).toBe((n * (n - 1)) / 2)
    })
  }
})

describe('scheduleGroups', () => {
  const s = scheduleGroups([{ groupId: 'A', teamIds: ids(4, 'a') }, { groupId: 'B', teamIds: ids(4, 'b') }])
  it('queue_order contiguous 1..N', () => {
    expect(s.map(m => m.queueOrder)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
  })
  it('interleaves groups per round', () => {
    expect(s.slice(0, 4).map(m => m.groupId)).toEqual(['A', 'A', 'B', 'B'])
    expect(s[0].round).toBe(1)
    expect(s[4].round).toBe(2)
    expect(s[0].label).toBe('M1')
  })
})

describe('helpers', () => {
  it('snake', () => expect(snakeDistribute([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 4, 5], [2, 3, 6]]))
  it('shuffle keeps items', () => expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]))
  it('groupName', () => expect([groupName(0), groupName(1)]).toEqual(['A', 'B']))
})
