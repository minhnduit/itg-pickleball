import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/i18n'
import { useToast } from '../../components/Toast'
import { GroupTable } from '../../components/GroupTable'
import { BracketView } from '../../components/BracketView'
import { computeGroupStandings, groupComplete } from '../../lib/standings'
import type { TabProps } from '../../lib/useTournamentData'

export default function StandingsTab({ data, reload }: TabProps) {
  const t = useT()
  const toast = useToast()
  const [pending, setPending] = useState<Record<string, string[]>>({})
  const rr = data.stages.find(s => s.kind === 'round_robin')

  const saveOrder = async (gid: string, order: string[] | null) => {
    if (!rr) return
    const manual = { ...(rr.config.manual_order ?? {}) }
    if (order) manual[gid] = order; else delete manual[gid]
    const { error } = await supabase.from('stages').update({ config: { ...rr.config, manual_order: manual } }).eq('id', rr.id)
    if (error) return toast.error(error.message)
    setPending(({ [gid]: _drop, ...rest }) => rest)
    reload()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-4">
        {data.groups.filter(g => g.stage_id === rr?.id).map(g => {
          const ids = data.teams.filter(x => x.group_id === g.id).map(x => x.id)
          const ms = data.matches.filter(m => m.group_id === g.id)
          const computed = computeGroupStandings(ids, ms, rr?.config.manual_order?.[g.id])
          const complete = groupComplete(ms)
          const order = pending[g.id]
          const rows = order ? order.map((id, i) => ({ ...computed.find(r => r.teamId === id)!, rank: i + 1 })) : computed
          const move = (teamId: string, dir: -1 | 1) => {
            const cur = [...(order ?? computed.map(r => r.teamId))]
            const i = cur.indexOf(teamId)
            const a = computed.find(r => r.teamId === teamId)!, b = computed.find(r => r.teamId === cur[i + dir])
            if (!b || !a.needsDecision || !b.needsDecision || a.wins !== b.wins || a.diff !== b.diff) return
            ;[cur[i], cur[i + dir]] = [cur[i + dir], cur[i]]
            setPending({ ...pending, [g.id]: cur })
          }
          const hasTie = computed.some(r => r.needsDecision)
          return (
            <div key={g.id} className="card overflow-x-auto">
              <h3 className="display border-b-2 border-gold bg-brand-900 px-3 py-2 text-lg text-white">{t('groupN', { name: g.name })}</h3>
              <GroupTable rows={rows} teams={data.teams} complete={complete} topN={rr?.config.top_n} onReorder={complete && (hasTie || order) ? move : undefined} />
              {(order || rr?.config.manual_order?.[g.id]) && (
                <div className="flex gap-2 border-t border-ink-100 p-3">
                  {order && <button className="btn btn-primary btn-sm" onClick={() => saveOrder(g.id, order)}>{t('saveOrder')}</button>}
                  {rr?.config.manual_order?.[g.id] && <button className="btn btn-secondary btn-sm" onClick={() => saveOrder(g.id, null)}>{t('clearManual')}</button>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="min-w-0 space-y-6">
        {data.stages.filter(s => s.kind === 'knockout').map(s => (
          <div key={s.id}>
            <h3 className="section-title mb-2">{s.name}</h3>
            <BracketView stage={s} matches={data.matches} allMatches={data.matches} teams={data.teams} groups={data.groups} stages={data.stages} />
          </div>
        ))}
      </div>
    </div>
  )
}
