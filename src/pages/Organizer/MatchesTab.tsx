import { Fragment, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { orgConfirm, orgReopen, orgSetScore } from '../../lib/api'
import { displayLabel, slotLabel, teamName } from '../../lib/display'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime } from '../../lib/display'
import { useLang, useT } from '../../lib/i18n'
import type { TabProps } from '../../lib/useTournamentData'
import type { Match, MatchEvent } from '../../lib/types'
import { queueUpdates, type QueueMove } from '../../lib/queue'
import { useToast } from '../../components/Toast'
import { Avatar } from '../../components/Avatar'
import { StatusPill } from '../../components/StatusPill'

const STATUSES = ['scheduled', 'called', 'live', 'finished', 'confirmed'] as const

export default function MatchesTab({ data, reload }: TabProps) {
  const t = useT()
  const lang = useLang()
  const toast = useToast()
  const [f, setF] = useState({ stage: '', group: '', status: '', court: '' })
  const [ov, setOv] = useState<{ id: number; a: string; b: string; reason: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [logFor, setLogFor] = useState<number | null>(null)
  const [events, setEvents] = useState<MatchEvent[]>([])

  const rows = data.matches.filter(m =>
    (!f.stage || m.stage_id === f.stage) && (!f.group || m.group_id === f.group) &&
    (!f.status || m.status === f.status) && (!f.court || (f.court === '-' ? m.court_id === null : m.court_id === f.court)))

  const attempt = async (fn: () => PromiseLike<unknown>) => {
    setBusy(true)
    try { await fn() } catch (e) { toast.error((e as Error).message) }
    await reload(); setBusy(false)
  }
  const update = (id: number, p: { court_id?: string | null; status?: 'called' | 'scheduled' }, only?: 'called' | 'scheduled') => attempt(async () => {
    let q = supabase.from('matches').update(p).eq('id', id)
    if (only) q = q.eq('status', only)
    const { error } = await q
    if (error) throw new Error(error.message)
  })
  const move = (id: number, mv: QueueMove) => attempt(async () => {
    for (const u of queueUpdates(data.matches, id, mv)) {
      const { error } = await supabase.from('matches').update({ queue_order: u.queue_order }).eq('id', u.id).eq('status', 'scheduled')
      if (error) throw new Error(error.message)
    }
  })
  const reopen = (m: Match) => {
    const reason = window.prompt(t('reason'))
    if (reason) attempt(() => orgReopen(m.id, reason))
  }
  const confirmAll = async () => {
    for (const m of rows.filter(x => x.status === 'finished')) {
      try { await orgConfirm(m.id) } catch (e) { toast.error(`${displayLabel(m, data.stages)}: ${friendlyError((e as Error).message, t)}`) }
    }
    reload()
  }
  const toggleLog = async (id: number) => {
    if (logFor === id) return setLogFor(null)
    const { data: ev, error } = await supabase.from('match_events').select('*').eq('match_id', id).order('id')
    if (error) return toast.error(error.message)
    setEvents(ev as MatchEvent[]); setLogFor(id)
  }
  const sel = 'input !h-9 !w-auto'
  const teamLine = (m: Match, side: 'A' | 'B') => {
    const id = side === 'A' ? m.team_a_id : m.team_b_id
    const done = m.status === 'finished' || m.status === 'confirmed'
    return id ? (
      <span className={`flex items-center gap-2 ${done && m.winner === side ? 'font-bold' : ''}`}><Avatar name={teamName(data.teams, id)} />{teamName(data.teams, id)}</span>
    ) : (
      <span className="flex items-center gap-2 italic text-ink-400"><Avatar name="" placeholder />{slotLabel(side === 'A' ? m.slot_a : m.slot_b, data, t)}</span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <select className={sel} value={f.stage} onChange={e => setF({ ...f, stage: e.target.value })}>
          <option value="">{t('allStages')}</option>{data.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={sel} value={f.group} onChange={e => setF({ ...f, group: e.target.value })}>
          <option value="">{t('allGroups')}</option>{data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className={sel} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
          <option value="">{t('allStatuses')}</option>{STATUSES.map(s => <option key={s} value={s}>{t(`st_${s}` as const)}</option>)}
        </select>
        <select className={sel} value={f.court} onChange={e => setF({ ...f, court: e.target.value })}>
          <option value="">{t('allCourts')}</option><option value="-">{t('noCourt')}</option>
          {data.courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-dark ml-auto" onClick={confirmAll}>{t('confirmAllFinished')}</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-std">
          <thead className="sticky top-0"><tr>
            <th>{t('match')}</th><th>{t('team')}</th><th>{t('court')}</th><th>{t('status')}</th><th>{t('score')}</th><th />
          </tr></thead>
          <tbody>
            {rows.map(m => (
              <Fragment key={m.id}>
                <tr className="align-middle">
                  <td><span className="chip">{displayLabel(m, data.stages)}</span></td>
                  <td><div className="space-y-1">{teamLine(m, 'A')}{teamLine(m, 'B')}</div></td>
                  <td>
                    <select className="input !h-8 !w-auto text-xs" value={m.court_id ?? ''} onChange={e => update(m.id, { court_id: e.target.value || null })}>
                      <option value="">—</option>{data.courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td><StatusPill status={m.status} /></td>
                  <td className="font-score text-lg font-bold">{m.score_a}–{m.score_b}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {m.status === 'scheduled' && <button className="btn btn-secondary btn-sm" onClick={() => update(m.id, { status: 'called' })}>{t('call')}</button>}
                      {m.status === 'scheduled' && <>
                        <button className="btn btn-ghost btn-sm" title={t('moveUp')} aria-label={t('moveUp')} disabled={busy} onClick={() => move(m.id, 'up')}>↑</button>
                        <button className="btn btn-ghost btn-sm" title={t('moveDown')} aria-label={t('moveDown')} disabled={busy} onClick={() => move(m.id, 'down')}>↓</button>
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(m.id, 'front')}>{t('playNext')}</button>
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(m.id, 'back')}>{t('delay')}</button>
                      </>}
                      {m.status === 'called' && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => update(m.id, { status: 'scheduled' }, 'called')}>{t('uncall')}</button>}
                      {m.status === 'finished' && <button className="btn btn-primary btn-sm" onClick={() => attempt(() => orgConfirm(m.id))}>{t('confirm')}</button>}
                      {m.status === 'confirmed' && <button className="btn btn-secondary btn-sm" onClick={() => reopen(m)}>{t('reopen')}</button>}
                      {m.status !== 'scheduled' && <button className="btn btn-ghost btn-sm" onClick={() => setOv(ov?.id === m.id ? null : { id: m.id, a: String(m.score_a), b: String(m.score_b), reason: '' })}>{t('override')}</button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleLog(m.id)}>{t('log')}</button>
                    </div>
                  </td>
                </tr>
                {ov?.id === m.id && (
                  <tr><td colSpan={6} className="!bg-ink-50">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="input !h-8 !w-16" type="number" min={0} value={ov.a} onChange={e => setOv({ ...ov, a: e.target.value })} />
                      <input className="input !h-8 !w-16" type="number" min={0} value={ov.b} onChange={e => setOv({ ...ov, b: e.target.value })} />
                      <input className="input !h-8 !w-64" placeholder={t('reason')} value={ov.reason} onChange={e => setOv({ ...ov, reason: e.target.value })} />
                      <button className="btn btn-primary btn-sm"
                        onClick={() => attempt(async () => { await orgSetScore(m.id, Number(ov.a), Number(ov.b), ov.reason); setOv(null) })}>{t('save')}</button>
                    </div>
                  </td></tr>
                )}
                {logFor === m.id && (
                  <tr><td colSpan={6} className="!bg-ink-50">
                    <ul className="space-y-1 text-xs">
                      {events.map(ev => (
                        <li key={ev.id} className="flex flex-wrap items-center gap-2">
                          <span className="tnum text-ink-500">{fmtDateTime(ev.created_at, lang)}</span>
                          <span className="pill bg-ink-100 text-ink-700">{t(`ev_${ev.kind}` as const)}</span>
                          {ev.rally_winner && <span className="font-semibold">{ev.rally_winner}</span>}
                          <span className="font-score text-base font-bold tnum">{ev.score_a}–{ev.score_b}</span>
                          <span className="text-ink-500">{ev.actor}</span>
                          {ev.note && <span>{ev.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
