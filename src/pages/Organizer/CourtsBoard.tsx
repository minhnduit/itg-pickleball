import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { scorePath } from '../../lib/paths'
import { supabase } from '../../lib/supabase'
import { orgSetScore } from '../../lib/api'
import { displayLabel, teamName } from '../../lib/display'
import { useT } from '../../lib/i18n'
import type { TabProps } from '../../lib/useTournamentData'
import type { Court, Match } from '../../lib/types'
import { queueUpdates, type QueueMove } from '../../lib/queue'
import { useToast } from '../../components/Toast'
import { Avatar } from '../../components/Avatar'
import { StatusPill } from '../../components/StatusPill'

export default function CourtsBoard({ tid, data, reload }: TabProps) {
  const t = useT()
  const toast = useToast()
  const nav = useNavigate()
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [override, setOverride] = useState<{ courtId: string; a: string; b: string; reason: string } | null>(null)
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  const ready = (m: Match) => m.status === 'scheduled' && !!m.team_a_id && !!m.team_b_id
  const unassigned = data.matches.filter(m => ready(m) && m.court_id === null)

  const patch = async (id: number, p: { court_id?: string | null; status?: 'called' | 'scheduled' }, only?: 'called' | 'scheduled') => {
    let q = supabase.from('matches').update(p).eq('id', id)
    if (only) q = q.eq('status', only)
    const { error } = await q
    if (error) toast.error(error.message); else reload()
  }

  const move = async (id: number, mv: QueueMove) => {
    setBusy(true)
    try {
      for (const u of queueUpdates(data.matches, id, mv)) {
        const { error } = await supabase.from('matches').update({ queue_order: u.queue_order }).eq('id', u.id).eq('status', 'scheduled')
        if (error) throw new Error(error.message)
      }
    } catch (e) { toast.error((e as Error).message) }
    await reload(); setBusy(false)
  }
  const act = async (fn: () => Promise<unknown> | void) => { setBusy(true); try { await fn() } finally { setBusy(false) } }

  const callNext = (c: Court, busy: boolean, next?: Match) => {
    if (busy) return
    if (next) return patch(next.id, { status: 'called' })
    const pick = unassigned[0]
    if (pick) patch(pick.id, { court_id: c.id, status: 'called' })
  }

  const submitOverride = async (m: Match) => {
    if (!override) return
    try {
      await orgSetScore(m.id, Number(override.a), Number(override.b), override.reason)
      setOverride(null); reload()
    } catch (e) { toast.error((e as Error).message) }
  }

  const mmss = (iso: string | null) => {
    if (!iso) return ''
    const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.courts.map(c => {
        const onCourt = data.matches.filter(m => m.court_id === c.id)
        const live = onCourt.find(m => m.status === 'live')
        const cur = live ?? onCourt.find(m => m.status === 'called')
        const queue = onCourt.filter(m => m.status === 'scheduled')
        const next = queue.find(ready)
        const lastFinish = Math.max(0, ...onCourt.filter(m => m.finished_at).map(m => new Date(m.finished_at!).getTime()))
        const idle = !cur && (lastFinish === 0 || now - lastFinish > 120000)
        const idleMin = lastFinish ? Math.floor((now - lastFinish) / 60000) : 0
        const ov = override?.courtId === c.id ? override : null
        const row = (m: Match, side: 'A' | 'B') => {
          const name = teamName(data.teams, side === 'A' ? m.team_a_id : m.team_b_id)
          return (
            <div className="flex items-center gap-3">
              <Avatar name={name} size="md" />
              <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
              {live && m.serving_team === side && <span className="h-2.5 w-2.5 rounded-full bg-gold ring-1 ring-gold-600" title={t('serving')} />}
              <span className="font-score text-4xl font-bold leading-none tnum">{side === 'A' ? m.score_a : m.score_b}</span>
            </div>
          )
        }
        return (
          <div key={c.id} className={`card p-4 ${idle ? '!border-2 !border-gold' : ''}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-bold">{c.name}</span>
              {cur ? <StatusPill status={cur.status} /> : idle && <span className="pill bg-gold text-ink-900">{t('idleFor', { min: idleMin })}</span>}
            </div>
            {cur ? (
              <div className="mb-3 space-y-2">
                {row(cur, 'A')}{row(cur, 'B')}
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <span className="chip">{displayLabel(cur, data.stages)}</span>
                  {live && <span>{t('server')} #{cur.server_number}</span>}
                  {live && <span className="ml-auto font-semibold tnum text-ink-900">{mmss(cur.started_at)}</span>}
                </div>
              </div>
            ) : <div className="muted mb-3 text-sm">{t('noCurrent')}</div>}
            {cur?.status === 'called' && (
              <button className="btn btn-secondary btn-sm mb-3" disabled={busy} onClick={() => act(() => patch(cur.id, { status: 'scheduled' }, 'called'))}>{t('uncall')}</button>
            )}
            <div className="mb-3 rounded-md bg-ink-50 p-3 text-sm">
              <div className="label mb-1">{t('courtQueue')}</div>
              {queue.length === 0 ? '—' : (
                <ul className="space-y-1">
                  {queue.map(m => (
                    <li key={m.id} className={`flex flex-wrap items-center gap-1 ${m.id === next?.id ? 'font-semibold' : ''}`}>
                      <span className="chip">{displayLabel(m, data.stages)}</span>
                      <span className="min-w-0 flex-1 truncate">{teamName(data.teams, m.team_a_id)} – {teamName(data.teams, m.team_b_id)}</span>
                      <button className="btn btn-ghost btn-sm" disabled={busy} title={t('moveUp')} aria-label={t('moveUp')} onClick={() => move(m.id, 'up')}>↑</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy} title={t('moveDown')} aria-label={t('moveDown')} onClick={() => move(m.id, 'down')}>↓</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(m.id, 'front')}>{t('playNext')}</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(m.id, 'back')}>{t('delay')}</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => patch(m.id, { court_id: null }, 'scheduled'))}>{t('unassign')}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-primary btn-sm" disabled={!!cur || (!next && !unassigned.length)}
                onClick={() => callNext(c, !!cur, next)}>{t('callNext')}</button>
              <select className="input !h-8 !w-auto text-xs" value="" onChange={e => e.target.value && patch(Number(e.target.value), { court_id: c.id })}>
                <option value="">{t('assignMatch')}</option>
                {unassigned.map(m => (
                  <option key={m.id} value={m.id}>{displayLabel(m, data.stages)} {teamName(data.teams, m.team_a_id)} – {teamName(data.teams, m.team_b_id)}</option>
                ))}
              </select>
              {cur && <button className="btn btn-secondary btn-sm" onClick={() => nav(scorePath(data.tournament ?? { id: tid, slug: null }, cur.id))}>{t('takeOver')}</button>}
              {cur && <button className="btn btn-ghost btn-sm" onClick={() => setOverride(ov ? null : { courtId: c.id, a: String(cur.score_a), b: String(cur.score_b), reason: '' })}>{t('override')}</button>}
            </div>
            {ov && cur && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input className="input !h-8 !w-16" type="number" min={0} value={ov.a} onChange={e => setOverride({ ...ov, a: e.target.value })} />
                <input className="input !h-8 !w-16" type="number" min={0} value={ov.b} onChange={e => setOverride({ ...ov, b: e.target.value })} />
                <input className="input !h-8 min-w-0 flex-1" placeholder={t('reason')} value={ov.reason} onChange={e => setOverride({ ...ov, reason: e.target.value })} />
                <button className="btn btn-primary btn-sm" onClick={() => submitOverride(cur)}>{t('save')}</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
