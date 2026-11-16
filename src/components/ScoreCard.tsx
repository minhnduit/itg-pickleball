import type { Match, Stage, Team } from '../lib/types'
import { displayLabel, teamName } from '../lib/display'
import { useT } from '../lib/i18n'
import { Avatar } from './Avatar'
import { StatusPill } from './StatusPill'

export const needsSwitch = (m: Match) =>
  m.status === 'live' && m.sides_switched && Math.max(m.score_a, m.score_b) === Math.ceil((m.points_to ?? 11) / 2)

export function ScoreCard({ match, teams, stages, size = 'sm', courtName, big = false }: {
  match: Match; teams: Team[]; stages: Stage[]; size?: 'sm' | 'tv'; courtName?: string; big?: boolean
}) {
  const t = useT()
  const tv = size === 'tv'
  const done = match.status === 'finished' || match.status === 'confirmed'
  const recent = done && match.finished_at && Date.now() - new Date(match.finished_at).getTime() < 60000
  const row = (side: 'A' | 'B') => {
    const id = side === 'A' ? match.team_a_id : match.team_b_id
    const score = side === 'A' ? match.score_a : match.score_b
    const name = teamName(teams, id)
    const lose = done && match.winner !== side
    const serving = match.status === 'live' && match.serving_team === side
    return (
      <div className="flex items-center gap-3">
        <Avatar name={name} size={tv ? 'lg' : 'md'} />
        <div className={`min-w-0 flex-1 truncate ${tv ? 'text-4xl' : 'text-base'} ${done && match.winner === side ? 'font-bold' : 'font-semibold'} ${lose ? (tv ? 'text-brand-100/50' : 'text-ink-400') : ''}`}>{name}</div>
        {serving && <span title={`${t('serving')} ${match.server_number}`} className={`flex shrink-0 ${tv ? 'gap-2' : 'gap-1'}`}>{Array.from({ length: match.server_number ?? 1 }, (_, i) => <span key={i} className={`rounded-full bg-gold ${tv ? 'h-7 w-7' : 'h-2.5 w-2.5 ring-1 ring-gold-600'}`} />)}</span>}
        <div className={`font-score font-bold leading-none tnum ${tv ? 'text-[132px]' : big ? 'text-6xl' : 'text-4xl'} ${lose ? (tv ? 'text-brand-100/50' : 'text-ink-400') : ''}`}>{score}</div>
      </div>
    )
  }
  return (
    <div className={tv
      ? `rounded-xl border border-brand-800 bg-brand-900 p-8 text-white ${recent ? 'ring-4 ring-gold' : ''}`
      : `card p-4 ${recent ? 'ring-2 ring-gold' : ''}`}>
      <div className="mb-3 flex items-center gap-2">
        {courtName && <span className={`font-bold ${tv ? 'text-3xl text-white' : 'text-base'}`}>{courtName}</span>}
        <span className={tv ? 'rounded bg-gold px-2 text-2xl font-bold text-ink-950' : 'chip'}>{displayLabel(match, stages)}</span>
        <span className="ml-auto"><StatusPill status={match.status} tv={tv} /></span>
      </div>
      <div className={tv ? 'space-y-4' : 'space-y-2'}>{row('A')}{row('B')}</div>
      {needsSwitch(match) && (
        <div className={`mt-3 rounded-md bg-gold text-center font-extrabold uppercase tracking-wide text-ink-950 ${tv ? 'py-3 text-4xl' : 'py-1.5 text-sm'}`}>{t('switchSides')}</div>
      )}
    </div>
  )
}
