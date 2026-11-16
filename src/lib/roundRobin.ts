export function circleRounds(teamIds: string[]): [string, string][][] {
  const ids: (string | null)[] = [...teamIds]
  if (ids.length % 2 === 1) ids.push(null)
  const n = ids.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i]
      if (a !== null && b !== null) pairs.push([a, b])
    }
    rounds.push(pairs)
    ids.splice(1, 0, ids.pop() as string | null) // rotate all but the first
  }
  return rounds
}

export interface ScheduledMatch {
  groupId: string; round: number; position: number
  teamA: string; teamB: string; queueOrder: number; label: string
}

export function scheduleGroups(groups: { groupId: string; teamIds: string[] }[]): ScheduledMatch[] {
  const per = groups.map(g => ({ groupId: g.groupId, rounds: circleRounds(g.teamIds) }))
  const maxRounds = Math.max(0, ...per.map(g => g.rounds.length))
  const out: ScheduledMatch[] = []
  let counter = 0
  for (let r = 0; r < maxRounds; r++) {
    for (const g of per) {
      ;(g.rounds[r] ?? []).forEach(([teamA, teamB], i) => {
        counter++
        out.push({ groupId: g.groupId, round: r + 1, position: i + 1, teamA, teamB, queueOrder: counter, label: `M${counter}` })
      })
    }
  }
  return out
}

export function snakeDistribute<T>(items: T[], groupCount: number): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => [])
  items.forEach((it, i) => {
    const lap = Math.floor(i / groupCount), k = i % groupCount
    groups[lap % 2 === 0 ? k : groupCount - 1 - k].push(it)
  })
  return groups
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const groupName = (i: number) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '')
