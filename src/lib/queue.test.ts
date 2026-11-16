import { describe, expect, it } from 'vitest'
import { queueUpdates } from './queue'

const m = (id: number, queue_order: number | null, court_id: string | null = 'c1', status: 'scheduled' | 'live' | 'finished' | 'called' = 'scheduled') =>
  ({ id, queue_order, court_id, status })
const apply = (ms: ReturnType<typeof m>[], ups: { id: number; queue_order: number }[]) =>
  ms.map(x => ({ ...x, queue_order: ups.find(u => u.id === x.id)?.queue_order ?? x.queue_order }))
const order = (ms: ReturnType<typeof m>[]) =>
  ms.filter(x => x.court_id === 'c1' && x.status === 'scheduled').sort((a, b) => (a.queue_order ?? 1e9) - (b.queue_order ?? 1e9) || a.id - b.id).map(x => x.id)

describe('queueUpdates', () => {
  const ms = [m(1, 1), m(2, 2), m(3, 3)]
  it('swaps up and down', () => {
    expect(order(apply(ms, queueUpdates(ms, 2, 'up')))).toEqual([2, 1, 3])
    expect(order(apply(ms, queueUpdates(ms, 2, 'down')))).toEqual([1, 3, 2])
  })
  it('edges give []', () => {
    expect(queueUpdates(ms, 1, 'up')).toEqual([])
    expect(queueUpdates(ms, 3, 'down')).toEqual([])
    expect(queueUpdates(ms, 1, 'front')).toEqual([])
    expect(queueUpdates(ms, 3, 'back')).toEqual([])
  })
  it('front only affects own court', () => {
    const all = [m(1, 5), m(2, 6), m(9, 1, 'c2'), m(3, 7)]
    const ups = queueUpdates(all, 3, 'front')
    expect(ups).toEqual([{ id: 3, queue_order: 4 }])
    expect(order(apply(all, ups))).toEqual([3, 1, 2])
  })
  it('back goes after everything', () => {
    const all = [m(1, 1), m(2, 2), m(9, 50, 'c2', 'finished')]
    expect(queueUpdates(all, 1, 'back')).toEqual([{ id: 1, queue_order: 51 }])
  })
  it('ignores non-scheduled in scope', () => {
    const all = [m(1, 1, 'c1', 'live'), m(2, 2), m(3, 3), m(4, 0, 'c1', 'called')]
    expect(queueUpdates(all, 2, 'up')).toEqual([])
    expect(order(apply(all, queueUpdates(all, 3, 'up')))).toEqual([3, 2])
    expect(queueUpdates(all, 1, 'down')).toEqual([])
  })
  it('handles null queue_order', () => {
    const all = [m(1, null), m(2, null), m(3, 4)]
    expect(order(apply(all, queueUpdates(all, 3, 'down')))).toEqual([1, 3, 2])
    expect(order(apply(all, queueUpdates(all, 2, 'up')))).toEqual([3, 2, 1])
  })
  it('tie moves only the target without undercutting the minimum', () => {
    const all = [m(1, 5), m(2, 5), m(3, 9)]
    const ups = queueUpdates(all, 2, 'up')
    expect(ups).toEqual([{ id: 2, queue_order: 4 }])
    expect(order(apply(all, ups))).toEqual([2, 1, 3])
  })
  it('renumbers from the court minimum on collision', () => {
    const all = [m(1, 5), m(2, 6), m(3, 7), m(4, null)]
    const ups = queueUpdates(all, 4, 'up')
    expect(order(apply(all, ups))).toEqual([1, 2, 4, 3])
    expect(Math.min(...apply(all, ups).map(x => x.queue_order!))).toBe(5)
  })
  it('handles ties', () => {
    const all = [m(1, 1), m(2, 1)]
    expect(order(apply(all, queueUpdates(all, 2, 'up')))).toEqual([2, 1])
  })
})
