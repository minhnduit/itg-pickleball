import type { Group, Match, Stage, Team } from '../lib/types'
import { displayLabel, slotLabel, teamName } from '../lib/display'
import { useT, type T } from '../lib/i18n'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

function roundTitle(r: number, rounds: number, t: T) {
  if (r === rounds) return t('round_final')
  if (r === rounds - 1) return t('round_sf')
  if (r === rounds - 2) return t('round_qf')
  return t('round_n', { n: 2 ** (rounds - r + 1) })
}

export function BracketView({ stage, matches, teams, groups, stages, allMatches, dark = false, tv = false }: {
  stage: Stage; matches: Match[]; teams: Team[]; groups: Group[]; stages: Stage[]; allMatches: Match[]; dark?: boolean; tv?: boolean
}) {
  const t = useT()
  const mine = matches.filter(m => m.stage_id === stage.id)
  const rounds = [...new Set(mine.map(m => m.round))].sort((a, b) => a - b)
  if (!mine.length) return <div className={`text-sm ${dark ? 'text-ink-400' : 'muted'}`}>{t('noBracket')}</div>
  const ctx = { groups, matches: allMatches, stages }
  const maxRound = Math.max(...rounds)
  const side = (m: Match, s: 'A' | 'B') => {
    const id = s === 'A' ? m.team_a_id : m.team_b_id
    const done = m.status === 'finished' || m.status === 'confirmed'
    const win = done && m.winner === s
    const lose = done && m.winner !== s
    return (
      <div className="flex items-center gap-2">
        <Avatar name={id ? teamName(teams, id) : ''} placeholder={!id} />
        <span className={`min-w-0 flex-1 truncate ${tv ? 'text-xl' : 'text-sm'} ${id ? (win ? 'font-bold' : lose ? 'font-semibold text-ink-400' : 'font-semibold') : 'italic text-ink-400'}`}>
          {id ? teamName(teams, id) : slotLabel(s === 'A' ? m.slot_a : m.slot_b, ctx, t)}
        </span>
        <span className={`font-score ${tv ? 'text-3xl' : 'text-xl'} font-bold tnum ${lose ? 'text-ink-400' : ''}`}>
          {m.status === 'scheduled' ? '' : s === 'A' ? m.score_a : m.score_b}
        </span>
      </div>
    )
  }
  return (
    <div className={tv ? 'flex gap-6' : 'flex gap-8 overflow-x-auto pb-2'}>
      {rounds.map(r => (
        <div key={r} className={tv ? 'flex min-w-0 flex-1 flex-col' : 'flex shrink-0 flex-col'}>
          <div className={`display mb-2 flex items-center gap-1.5 ${tv ? 'text-2xl text-gold' : dark ? 'text-3xl text-gold' : 'text-base text-brand-700'}`}>{r === maxRound && <Icon name="trophy" size={dark ? 28 : 18} className="text-gold-600" />}{roundTitle(r, maxRound, t)}</div>
          <div className="flex flex-1 flex-col justify-around gap-3">
            {mine.filter(m => m.round === r).sort((a, b) => a.position - b.position).map(m => (
              <div key={m.id} className={`${tv ? 'w-full space-y-1 p-2' : `${dark ? 'w-72' : 'w-56'} space-y-2 p-3`} rounded-lg border ${r === maxRound ? 'border-gold border-2' : 'border-ink-200'} bg-white text-ink-900`}>
                <div className={`chip ${tv ? '!text-sm' : ''}`}>{displayLabel(m, stages)}</div>
                {side(m, 'A')}{side(m, 'B')}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
