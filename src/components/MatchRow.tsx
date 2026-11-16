import type { Match } from '../lib/types'
import type { TData } from '../lib/useTournamentData'
import { displayLabel, slotLabel } from '../lib/display'
import { useT } from '../lib/i18n'
import { Avatar } from './Avatar'
import { StatusPill } from './StatusPill'

export function MatchRow({ m, data, tv = false, hideCourt = false }: { m: Match; data: TData; tv?: boolean; hideCourt?: boolean }) {
  const t = useT()
  const done = m.status === 'finished' || m.status === 'confirmed'
  const court = data.courts.find(c => c.id === m.court_id)?.name

  const line = (side: 'A' | 'B') => {
    const id = side === 'A' ? m.team_a_id : m.team_b_id
    const team = data.teams.find(x => x.id === id)
    const score = side === 'A' ? m.score_a : m.score_b
    const win = done && m.winner === side
    const lose = done && m.winner !== side
    const serving = m.status === 'live' && m.serving_team === side
    return (
      <div className="flex items-center gap-3">
        {win ? <span aria-hidden className="h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-brand-600" /> : <span className="w-[7px]" />}
        <Avatar name={team?.name ?? ''} placeholder={!team} size={tv ? 'md' : 'sm'} />
        <div className="min-w-0 flex-1">
          {team ? (
            <>
              <div className={`truncate ${tv ? 'text-3xl' : 'text-sm'} ${win ? 'font-bold text-ink-900' : lose ? 'font-semibold text-ink-400' : 'font-semibold'}`}>{team.name}</div>
              <div className={`truncate ${tv ? 'text-xl' : 'text-xs'} muted`}>{team.player1} · {team.player2}</div>
            </>
          ) : (
            <div className={`truncate italic text-ink-400 ${tv ? 'text-3xl' : 'text-sm'}`}>{slotLabel(side === 'A' ? m.slot_a : m.slot_b, data, t)}</div>
          )}
        </div>
        {serving && <span className="h-2 w-2 rounded-full bg-gold-600" title={t('serving')} />}
        {m.status !== 'scheduled' && (
          <span className={`font-score font-bold tnum ${tv ? 'text-5xl' : 'text-2xl'} ${lose ? 'text-ink-400' : ''}`}>{score}</span>
        )}
      </div>
    )
  }

  return (
    <div className={`${tv ? 'rounded-lg border border-brand-800 bg-brand-900 p-5 text-white' : 'card p-3'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={tv ? 'rounded bg-gold px-2 text-2xl font-bold text-ink-950' : 'chip'}>{displayLabel(m, data.stages)}</span>
        {!hideCourt && court && <span className={`${tv ? 'text-2xl' : 'text-xs'} muted`}>{court}</span>}
        <span className="ml-auto"><StatusPill status={m.status} tv={tv} /></span>
      </div>
      <div className="space-y-2">
        {line('A')}
        {m.status === 'scheduled' && <div className="pl-6 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t('vs')}</div>}
        {line('B')}
      </div>
    </div>
  )
}
