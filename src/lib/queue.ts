import type { Match } from './types'

export type QueueMove = 'up' | 'down' | 'front' | 'back'
type M = Pick<Match, 'id' | 'queue_order' | 'court_id' | 'status'>

const key = (m: M) => m.queue_order ?? 1e9

/** queue_order writes needed to move scheduled match `id` within its court's queue. */
export function queueUpdates(matches: M[], id: number, move: QueueMove): { id: number; queue_order: number }[] {
  const target = matches.find(m => m.id === id)
  if (!target || target.status !== 'scheduled') return []
  const scope = matches
    .filter(m => m.status === 'scheduled' && m.court_id === target.court_id)
    .sort((a, b) => key(a) - key(b) || a.id - b.id)
  const i = scope.findIndex(m => m.id === id)
  const nonNull = (xs: M[]) => xs.filter(m => m.queue_order !== null).map(m => m.queue_order!)

  if (move === 'front') {
    if (i === 0) return []
    const mins = nonNull(scope.filter(m => m.id !== id))
    return [{ id, queue_order: mins.length ? Math.min(...mins) - 1 : 0 }]
  }
  if (move === 'back') {
    const all = nonNull(matches)
    const max = all.length ? Math.max(...all) : 0
    if (i === scope.length - 1 && target.queue_order !== null && target.queue_order === max) return []
    return [{ id, queue_order: max + 1 }]
  }
  const j = move === 'up' ? i - 1 : i + 1
  const other = scope[j]
  if (!other) return []
  if (target.queue_order !== null && other.queue_order !== null && target.queue_order !== other.queue_order) {
    return [{ id, queue_order: other.queue_order }, { id: other.id, queue_order: target.queue_order }]
  }
  // null or tied values: nudge only the target; renumber if that does not give the swapped order
  const swapped = [...scope]; swapped[i] = other; swapped[j] = target
  if (other.queue_order !== null) {
    const q = other.queue_order + (move === 'up' ? -1 : 1)
    const sim = scope.map(m => (m.id === id ? { ...m, queue_order: q } : m)).sort((a, b) => key(a) - key(b) || a.id - b.id)
    if (sim.every((m, k) => m.id === swapped[k].id) && !scope.some(m => m.id !== id && m.queue_order === q)) return [{ id, queue_order: q }]
  }
  const start = nonNull(scope).length ? Math.min(...nonNull(scope)) : 0
  return swapped.map((m, k) => ({ id: m.id, queue_order: start + k })).filter(u => scope.find(m => m.id === u.id)!.queue_order !== u.queue_order)
}
