import { useState } from 'react'
import { TidGate } from '../../components/TidGate'
import { Link } from 'react-router-dom'
import { pubPath, tvPath } from '../../lib/paths'
import { supabase } from '../../lib/supabase'
import { LangToggle, useT } from '../../lib/i18n'
import { useTournamentData } from '../../lib/useTournamentData'
import { Icon, type IconName } from '../../components/Icon'
import { Wordmark } from '../../components/Wordmark'
import CourtsBoard from './CourtsBoard'
import MatchesTab from './MatchesTab'
import SetupTab from './SetupTab'
import StandingsTab from './StandingsTab'
import RefereesTab from './RefereesTab'

const TABS = ['courts', 'matches', 'setup', 'standings', 'referees'] as const
const ICONS: Record<(typeof TABS)[number], IconName> = { courts: 'court', matches: 'list', setup: 'settings', standings: 'trophy', referees: 'qr' }

function Organizer({ tid }: { tid: string }) {
  const t = useT()
  const { data, loading, error, reload } = useTournamentData(tid)
  const [tab, setTab] = useState<(typeof TABS)[number]>('courts')
  const tk = data.tournament ?? { id: tid, slug: null }
  const props = { tid, data, reload }
  const linkCls = 'btn btn-ghost btn-sm !justify-start !text-brand-100 hover:!bg-brand-800 hover:!text-white'

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="border-b-2 border-gold bg-brand-900 text-brand-100 lg:fixed lg:border-b-0 lg:border-r-2 lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col">
        <div className="flex items-center justify-between px-4 pt-4 lg:block">
          <Wordmark className="text-white" />
          <div className="lg:hidden"><LangToggle dark /></div>
        </div>
        <div className="px-4 py-3 lg:py-5">
          <div className="truncate font-bold text-white">{data.tournament?.name ?? ''}</div>
          <div className="text-xs text-brand-100/80">{data.tournament?.event_date}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {TABS.map(k => (
            <button key={k} onClick={() => setTab(k)} aria-current={tab === k}
              className={`relative flex h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-md px-3 text-sm font-semibold ${tab === k ? 'bg-brand-800 text-white' : 'hover:bg-brand-800 hover:text-white'}`}>
              {tab === k && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-gold" />}
              <Icon name={ICONS[k]} size={18} />{t(`tab_${k}` as const)}
            </button>
          ))}
        </nav>
        <div className="hidden space-y-1 border-t border-brand-800 p-3 lg:block">
          <Link className={linkCls} to={pubPath(tk)}><Icon name="users" size={16} />{t('public')}</Link>
          <Link className={linkCls} to={tvPath(tk)}><Icon name="tv" size={16} />{t('tv')}</Link>
          <Link className={linkCls} to="/"><Icon name="chevronLeft" size={16} />{t('home')}</Link>
          <button className={`${linkCls} w-full`} onClick={() => supabase.auth.signOut()}><Icon name="logout" size={16} />{t('logout')}</button>
          <div className="pt-2"><LangToggle dark /></div>
        </div>
      </aside>
      <div>
        <div className="flex h-16 items-center justify-between border-b border-ink-200 bg-white px-6">
          <h1 className="display text-2xl text-brand-700">{t(`tab_${tab}` as const)}</h1>
          <div className="flex gap-1 lg:hidden">
            <Link className="btn btn-ghost btn-sm" to={pubPath(tk)}>{t('public')}</Link>
            <Link className="btn btn-ghost btn-sm" to={tvPath(tk)}>{t('tv')}</Link>
            <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>{t('logout')}</button>
          </div>
        </div>
        <main className="mx-auto max-w-[1400px] p-4 lg:p-6">
          {error && <div className="mb-3 text-sm font-semibold text-live">{error}</div>}
          {loading ? <div className="muted">{t('loading')}</div> : (
            <>
              {tab === 'courts' && <CourtsBoard {...props} />}
              {tab === 'matches' && <MatchesTab {...props} />}
              {tab === 'setup' && <SetupTab {...props} />}
              {tab === 'standings' && <StandingsTab {...props} />}
              {tab === 'referees' && <RefereesTab {...props} />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default function OrganizerPage() {
  return <TidGate>{tid => <Organizer tid={tid} />}</TidGate>
}
