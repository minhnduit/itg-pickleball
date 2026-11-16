import { useState } from 'react'
import { TidGate } from '../components/TidGate'
import { Link } from 'react-router-dom'
import { LangToggle, useT } from '../lib/i18n'
import { useTournamentData } from '../lib/useTournamentData'
import { norm } from '../lib/display'
import { courtPath, tvPath } from '../lib/paths'
import { computeGroupStandings, groupComplete } from '../lib/standings'
import { ScoreCard } from '../components/ScoreCard'
import { GroupTable } from '../components/GroupTable'
import { BracketView } from '../components/BracketView'
import { MatchRow } from '../components/MatchRow'
import { Icon, type IconName } from '../components/Icon'

const TABS = [['live', 'court'], ['schedule', 'list'], ['groups', 'users'], ['brackets', 'trophy']] as const satisfies readonly (readonly [string, IconName])[]
type Tab = (typeof TABS)[number][0]

function PublicTournament({ tid }: { tid: string }) {
  const t = useT()
  const { data, loading } = useTournamentData(tid)
  const tk = data.tournament ?? { id: tid, slug: null }
  const [tab, setTab] = useState<Tab>('live')
  const [q, setQ] = useState('')

  const needle = norm(q.trim())
  const myTeams = needle
    ? data.teams.filter(x => norm(`${x.name} ${x.player1} ${x.player2}`).includes(needle)).map(x => x.id)
    : []
  const mine = data.matches.filter(m => myTeams.includes(m.team_a_id ?? '') || myTeams.includes(m.team_b_id ?? ''))
  const rr = data.stages.find(s => s.kind === 'round_robin')
  const liveByCourt = data.courts.map(c => ({
    c, m: data.matches.find(m => m.court_id === c.id && m.status === 'live') ?? data.matches.find(m => m.court_id === c.id && m.status === 'called'),
  }))

  return (
    <div className="min-h-screen pb-20 sm:pb-6">
      <header className="sticky top-0 z-20 border-b-2 border-gold bg-brand-900 text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
          <Link to="/" aria-label={t('home')} className="btn btn-ghost !h-9 !px-2 !text-white hover:!bg-brand-800"><Icon name="chevronLeft" /></Link>
          <div className="min-w-0 flex-1">
            <div className="display truncate text-xl leading-tight">{data.tournament?.name ?? t('loading')}</div>
            <div className="text-xs text-brand-100">{data.tournament?.event_date}</div>
          </div>
          <Link to={tvPath(tk)} aria-label={t('tv')} className="btn btn-ghost !h-9 !px-2 !text-white hover:!bg-brand-800"><Icon name="tv" /></Link>
          <LangToggle dark />
        </div>
        <div className="mx-auto max-w-3xl px-3 pb-3">
          <div className="relative">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input aria-label={t('searchPlaceholder')} className="input !border-brand-800 !bg-brand-800 pl-9 !text-white placeholder:!text-brand-100/70"
              placeholder={t('searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-3">
        {needle ? (
          <div>
            <h2 className="section-title mb-2">{t('myMatches')} <span className="muted font-normal">· {t('myMatchesCount', { n: mine.length })}</span></h2>
            <div className="space-y-2">{mine.map(m => <MatchRow key={m.id} m={m} data={data} />)}</div>
            {!mine.length && <div className="muted text-sm">{t('nothingFound')}</div>}
          </div>
        ) : loading ? <div className="muted">{t('loading')}</div> : (
          <>
            <div className="tabs mb-4 hidden sm:inline-flex">
              {TABS.map(([k]) => (
                <button key={k} onClick={() => setTab(k)} className={`tab ${tab === k ? 'tab-active' : ''}`}>{t(`pub_${k}` as const)}</button>
              ))}
            </div>
            {tab === 'live' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {liveByCourt.map(({ c, m }) => m
                  ? <Link key={c.id} to={courtPath(tk, c, data.courts)} className="block"><ScoreCard match={m} teams={data.teams} stages={data.stages} courtName={c.name} /></Link>
                  : <div key={c.id} className="card p-4"><div className="font-bold">{c.name}</div><div className="muted text-sm">{t('noCurrent')}</div></div>)}
              </div>
            )}
            {tab === 'schedule' && <div className="space-y-2">{data.matches.map(m => <MatchRow key={m.id} m={m} data={data} />)}</div>}
            {tab === 'groups' && (
              <div className="space-y-4">
                {data.groups.filter(g => g.stage_id === rr?.id).map(g => {
                  const ms = data.matches.filter(m => m.group_id === g.id)
                  const rows = computeGroupStandings(data.teams.filter(x => x.group_id === g.id).map(x => x.id), ms, rr?.config.manual_order?.[g.id])
                  return (
                    <div key={g.id} className="card overflow-hidden">
                      <h3 className="display border-b-2 border-gold bg-brand-900 px-3 py-2 text-lg text-white">{t('groupN', { name: g.name })}</h3>
                      <GroupTable rows={rows} teams={data.teams} complete={groupComplete(ms)} topN={rr?.config.top_n} />
                    </div>
                  )
                })}
              </div>
            )}
            {tab === 'brackets' && data.stages.filter(s => s.kind === 'knockout').map(s => (
              <div key={s.id} className="mb-6"><h3 className="section-title mb-2">{s.name}</h3>
                <BracketView stage={s} matches={data.matches} allMatches={data.matches} teams={data.teams} groups={data.groups} stages={data.stages} /></div>
            ))}
          </>
        )}
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex h-16 border-t border-ink-200 bg-white sm:hidden">
        {TABS.map(([k, icon]) => (
          <button key={k} onClick={() => { setTab(k); setQ('') }}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${tab === k && !needle ? 'text-brand-600' : 'text-ink-500'}`}>
            <Icon name={icon} />{t(`pub_${k}` as const)}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function PublicTournamentPage() {
  return <TidGate>{tid => <PublicTournament tid={tid} />}</TidGate>
}
