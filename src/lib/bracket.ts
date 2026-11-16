import type { StandingRow } from './standings'

export type Entry = { slot: string; teamId: string | null; groupId: string }
export type BSide = { kind: 'entry'; slot: string } | { kind: 'winner'; key: string }
export interface BracketMatch {
  key: string; round: number; position: number; label: string
  a: BSide; b: BSide; teamA: string | null; teamB: string | null
  pointsTo: number; winBy: number; cap: number | null
}
export type Rules = { pointsTo: number; winBy: number; cap: number | null }
// Semi-final and final: first to 15 (chạm 15), no win-by-2, no cap
export const FINAL_RULES: Rules = { pointsTo: 15, winBy: 1, cap: null }

export function seedPositions(size: number): number[] {
  let p = [1]
  while (p.length < size) p = p.flatMap(x => [x, 2 * p.length + 1 - x])
  return p
}

function tiers(groups: { groupId: string; size: number }[], rankFrom: number, rankTo: number | null) {
  const max = rankTo ?? Math.max(0, ...groups.map(g => g.size))
  const out: { rank: number; groupIdx: number }[][] = []
  for (let r = rankFrom; r <= max; r++) {
    const t = groups.map((g, groupIdx) => ({ rank: r, groupIdx, ok: g.size >= r })).filter(x => x.ok)
    out.push(t.map(({ rank, groupIdx }) => ({ rank, groupIdx })))
  }
  return out
}

export function previewEntries(groups: { groupId: string; size: number }[], rankFrom: number, rankTo: number | null): Entry[] {
  return tiers(groups, rankFrom, rankTo).flatMap(t =>
    t.map(({ rank, groupIdx }) => ({ slot: `G:${groups[groupIdx].groupId}:${rank}`, teamId: null, groupId: groups[groupIdx].groupId })))
}

export function seedQualifiers(groups: { groupId: string; rows: StandingRow[] }[], rankFrom: number, rankTo: number | null): Entry[] {
  const sized = groups.map(g => ({ groupId: g.groupId, size: g.rows.length }))
  return tiers(sized, rankFrom, rankTo).flatMap(t =>
    t.map(({ rank, groupIdx }) => ({ rank, groupIdx, row: groups[groupIdx].rows[rank - 1] }))
      .sort((x, y) => y.row.wins - x.row.wins || y.row.diff - x.row.diff || y.row.pointsFor - x.row.pointsFor || x.groupIdx - y.groupIdx)
      .map(({ rank, groupIdx, row }) => ({ slot: `G:${groups[groupIdx].groupId}:${rank}`, teamId: row.teamId, groupId: groups[groupIdx].groupId })))
}

export function buildBracket(entries: Entry[], rules: Rules): BracketMatch[] {
  const n = entries.length
  if (n < 2) return []
  let size = 1
  while (size < n) size *= 2
  const rounds = Math.log2(size)
  const pos = seedPositions(size)

  // round-1 pairs as seed numbers; seed > n = bye
  const pairs = Array.from({ length: size / 2 }, (_, i) => [pos[2 * i], pos[2 * i + 1]])
  const entryOf = (seed: number) => entries[seed - 1]
  const real = (i: number) => pairs[i][1] <= n
  const clash = (a: number, b: number) => entryOf(a).groupId === entryOf(b).groupId

  // best-effort same-group avoidance (single pass): swap the lower seeds of two real pairs
  for (let i = 0; i < pairs.length; i++) {
    if (!real(i) || !clash(pairs[i][0], pairs[i][1])) continue
    let best = -1, bestDist = Infinity
    for (let j = 0; j < pairs.length; j++) {
      if (j === i || !real(j)) continue
      if (clash(pairs[i][0], pairs[j][1]) || clash(pairs[j][0], pairs[i][1])) continue
      const d = Math.abs(pairs[i][1] - pairs[j][1])
      if (d < bestDist) { best = j; bestDist = d }
    }
    if (best >= 0) [pairs[i][1], pairs[best][1]] = [pairs[best][1], pairs[i][1]]
  }

  const out: BracketMatch[] = []
  const keyOf = (r: number, p: number) => `r${r}p${p}`
  const exists = new Set<string>()
  const counters: number[] = Array(rounds + 1).fill(0)
  const labelFor = (r: number) => {
    const k = ++counters[r]
    if (r === rounds) return 'CK'
    if (r === rounds - 1) return `BK${k}`
    if (r === rounds - 2) return `TK${k}`
    return `V${2 ** (rounds - r + 1)}-${k}`
  }
  const rule = (r: number) => (r >= rounds - 1 ? FINAL_RULES : rules)
  const sideOf = (e: Entry): BSide => ({ kind: 'entry', slot: e.slot })

  pairs.forEach((pr, i) => {
    if (!real(i)) return
    const ea = entryOf(pr[0]), eb = entryOf(pr[1])
    const key = keyOf(1, i + 1)
    exists.add(key)
    out.push({ key, round: 1, position: i + 1, label: labelFor(1), a: sideOf(ea), b: sideOf(eb), teamA: ea.teamId, teamB: eb.teamId, ...rule(1) })
  })

  // feeder of round r-1 position q: a winner ref, or (round 1 bye) the present entry
  const feeder = (r: number, q: number): { side: BSide; team: string | null } => {
    const key = keyOf(r, q)
    if (exists.has(key)) return { side: { kind: 'winner', key }, team: null }
    const e = entryOf(pairs[q - 1][0])
    return { side: sideOf(e), team: e.teamId }
  }
  for (let r = 2; r <= rounds; r++) {
    for (let p = 1; p <= size / 2 ** r; p++) {
      const fa = feeder(r - 1, 2 * p - 1), fb = feeder(r - 1, 2 * p)
      const key = keyOf(r, p)
      exists.add(key)
      out.push({ key, round: r, position: p, label: labelFor(r), a: fa.side, b: fb.side, teamA: fa.team, teamB: fb.team, ...rule(r) })
    }
  }
  return out
}

const isPow2 = (n: number) => n >= 2 && (n & (n - 1)) === 0

// Fixed template for 2 ranks x 2^n groups (A1-B2, B1-A2, ...); other shapes fall back to seeding.
// `rows` (real standings) only matters for the fallback seeding order.
export function buildKnockout(
  groups: { groupId: string; ranked: (string | null)[] }[], rankFrom: number, rankTo: number | null, rules: Rules,
  rows?: { groupId: string; rows: StandingRow[] }[],
): BracketMatch[] {
  const k = groups.length
  const max = rankTo ?? Math.max(0, ...groups.map(g => g.ranked.length))
  const ranks: number[] = []
  for (let r = rankFrom; r <= max; r++) ranks.push(r)

  if (!(ranks.length === 2 && isPow2(k) && groups.every(g => g.ranked.length >= ranks[1]))) {
    if (rows) return buildBracket(seedQualifiers(rows, rankFrom, rankTo), rules)
    const entries = ranks.flatMap(r => groups.filter(g => g.ranked.length >= r).map(g => (
      { slot: `G:${g.groupId}:${r}`, teamId: g.ranked[r - 1] ?? null, groupId: g.groupId })))
    return buildBracket(entries, rules)
  }

  const [r1, r2] = ranks
  const rounds = Math.log2(k) + 1
  const slotOf = (gi: number, r: number): { side: BSide; team: string | null } =>
    ({ side: { kind: 'entry', slot: `G:${groups[gi].groupId}:${r}` }, team: groups[gi].ranked[r - 1] ?? null })
  const rule = (r: number) => (r >= rounds - 1 ? FINAL_RULES : rules)
  const label = (r: number, n: number) => {
    if (r === rounds) return 'CK'
    if (r === rounds - 1) return `BK${n}`
    if (r === rounds - 2) return `TK${n}`
    return `V${2 ** (rounds - r + 1)}-${n}`
  }
  // round-1 display position of match number j (keeps feeders adjacent)
  const pos = (j: number) => (j <= k / 2 ? 2 * (j - 1) + 1 : 2 * (j - k / 2 - 1) + 2)

  const out: BracketMatch[] = []
  for (let i = 0; i < k / 2; i++) {
    const pairs = [[2 * i + 1, 2 * i, r1, 2 * i + 1, r2], [2 * i + 2, 2 * i + 1, r1, 2 * i, r2]] as const
    for (const [j, ga, ra, gb, rb] of pairs) {
      const a = slotOf(ga, ra), b = slotOf(gb, rb)
      out.push({ key: `r1p${pos(j)}`, round: 1, position: pos(j), label: label(1, j), a: a.side, b: b.side, teamA: a.team, teamB: b.team, ...rule(1) })
    }
  }
  for (let r = 2; r <= rounds; r++) {
    for (let p = 1; p <= k / 2 ** (r - 1); p++) {
      out.push({
        key: `r${r}p${p}`, round: r, position: p, label: label(r, p),
        a: { kind: 'winner', key: `r${r - 1}p${2 * p - 1}` }, b: { kind: 'winner', key: `r${r - 1}p${2 * p}` },
        teamA: null, teamB: null, ...rule(r),
      })
    }
  }
  return out.sort((x, y) => x.round - y.round || x.position - y.position)
}
