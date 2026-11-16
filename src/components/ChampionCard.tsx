import type { Team } from '../lib/types'
import { useT } from '../lib/i18n'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

export function ChampionCard({ team, stageName, size, dark = false }: { team: Team; stageName: string; size: 'sm' | 'tv'; dark?: boolean }) {
  const t = useT()
  const tv = size === 'tv'
  return (
    <div className={`flex items-center border-gold ${tv ? 'gap-6 rounded-xl border-4 px-8 py-4' : 'gap-3 rounded-lg border-2 p-3'} ${dark ? 'bg-brand-900 text-white' : 'bg-white text-ink-900'}`}>
      <Icon name="trophy" size={tv ? 64 : 32} className="shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <div className={`font-bold uppercase tracking-wider ${tv ? 'text-2xl text-gold' : 'text-xs text-gold-600'}`}>{t('champion')} · {stageName}</div>
        <div className={`display truncate ${tv ? 'text-5xl' : 'text-xl'}`}>{team.name}</div>
        <div className={`truncate ${tv ? 'text-2xl text-brand-100/70' : 'text-sm text-ink-500'}`}>{team.player1} · {team.player2}</div>
      </div>
      <Avatar name={team.name} size={tv ? 'lg' : 'md'} />
    </div>
  )
}
