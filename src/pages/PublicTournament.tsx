import { useState } from 'react'
import { TidGate } from '../components/TidGate'
import { Link, useSearchParams } from 'react-router-dom'
import { LangToggle, useLang, useT } from '../lib/i18n'
import { useTournamentData } from '../lib/useTournamentData'
import { fmtDate, norm } from '../lib/display'
import { courtPath } from '../lib/paths'
import { computeGroupStandings, groupComplete } from '../lib/standings'
import { ScoreCard } from '../components/ScoreCard'
import { GroupTable } from '../components/GroupTable'
import { ChampionCard } from '../components/ChampionCard'
import { stageChampion } from '../lib/bracket'
import { BracketView } from '../components/BracketView'
import { MatchRow } from '../components/MatchRow'
import { BYS, filterMatches, sectionize, type By } from '../lib/schedule'
import { Icon, type IconName } from '../components/Icon'

const TABS = [['live', 'court'], ['schedule', 'list'], ['groups', 'users'], ['brackets', 'trophy']] as const satisfies readonly (readonly [string, IconName])[]
type Tab = (typeof TABS)[number][0]

function PublicTournament({ tid }: { tid: string }) {
  const t = useT()
  const lang = useLang()
  const { data, loading } = useTournamentData(tid)
  const tk = data.tournament ?? { id: tid, slug: null }
  const [sp, setSp] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => (['by', 'court', 'team', 'group'].some(k => sp.has(k)) ? 'schedule' : 'live'))
  const [q, setQ] = useState('')
  const by: By = BYS.find(b => b === sp.get('by')) ?? 'order'
  const pick = (k: string, ok: string[]) => { const v = sp.get(k); return v && ok.includes(v) ? v : undefined }
  const flt = {
    court: pick('court', ['none', ...data.courts.map(c => c.id)]),
    team: pick('team', data.teams.map(x => x.id)),
    group: pick('group', [...data.groups.map(g => g.id), ...data.stages.filter(s => s.kind === 'knockout').map(s => s.id)]),
  }
  const setParam = (k: string, v?: string) => setSp(p => { const n = new URLSearchParams(p); if (v && !(k === 'by' && v === 'order')) n.set(k, v); else n.delete(k); return n }, { replace: true })
  const hasFilter = !!(flt.court || flt.team || flt.group)

  const needle = norm(q.trim())
  const myTeams = needle
    ? data.teams.filter(x => norm(`${x.name} ${x.player1} ${x.player2}`).includes(needle)).map(x => x.id)
    : []
  const mine = data.matches.filter(m => myTeams.includes(m.team_a_id ?? '') || myTeams.includes(m.team_b_id ?? ''))
  const rr = data.stages.find(s => s.kind === 'round_robin')
  const liveByCourt = data.courts.map(c => ({
    c, m: data.matches.find(m => m.court_id === c.id && m.status === 'live') ?? data.matches.find(m => m.court_id === c.id && m.status === 'called'),
  }))

  const champion = (s: (typeof data.stages)[number]) => {
    const team = data.teams.find(x => x.id === stageChampion(s, data.matches))
    return team ? <div key={s.id} className="mb-3"><ChampionCard size="sm" team={team} stageName={s.name} /></div> : null
  }
  const kos = data.stages.filter(s => s.kind === 'knockout')

  return (
    <div className="min-h-screen pb-20 sm:pb-6">
      <header className="sticky top-0 z-20 border-b-2 border-gold bg-brand-900 text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
          <div className="min-w-0 flex-1">
            <div className="display truncate text-xl leading-tight">{data.tournament?.name ?? t('loading')}</div>
            <div className="text-xs text-brand-100">{data.tournament?.event_date ? fmtDate(data.tournament.event_date, lang) : ''}</div>
          </div>
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
            {tab === 'live' && kos.map(champion)}
            {tab === 'live' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {liveByCourt.map(({ c, m }) => m
                  ? <Link key={c.id} to={courtPath(tk, c, data.courts)} className="block"><ScoreCard match={m} teams={data.teams} stages={data.stages} courtName={c.name} /></Link>
                  : <div key={c.id} className="card p-4"><div className="font-bold">{c.name}</div><div className="muted text-sm">{t('noCurrent')}</div></div>)}
              </div>
            )}
            {tab === 'schedule' && (
              <div className="space-y-3">
                <div className="card space-y-3 p-3">
                  <div className="grid grid-cols-4 gap-1 rounded-lg bg-ink-100 p-1">
                    {BYS.map(b => <button key={b} onClick={() => setParam('by', b)} className={`tab !rounded-md !px-1 text-xs sm:text-sm ${by === b ? 'tab-active' : ''}`}>{t(`by_${b}` as const)}</button>)}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block min-w-0"><span className="label">{t('f_court')}</span>
                      <select className="input" value={flt.court ?? ''} onChange={e => setParam('court', e.target.value)}>
                        <option value="">{t('all')}</option>
                        {[...data.courts].sort((a, b) => a.sort - b.sort).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="none">{t('sec_noCourt')}</option>
                      </select></label>
                    <label className="block min-w-0"><span className="label">{t('f_team')}</span>
                      <select className="input" value={flt.team ?? ''} onChange={e => setParam('team', e.target.value)}>
                        <option value="">{t('all')}</option>
                        {[...data.teams].sort((a, b) => a.name.localeCompare(b.name, 'vi')).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select></label>
                    <label className="block min-w-0"><span className="label">{t('f_group')}</span>
                      <select className="input" value={flt.group ?? ''} onChange={e => setParam('group', e.target.value)}>
                        <option value="">{t('all')}</option>
                        {data.groups.filter(g => g.stage_id === rr?.id).sort((a, b) => a.sort - b.sort).map(g => <option key={g.id} value={g.id}>{t('groupN', { name: g.name })}</option>)}
                        {data.stages.filter(s => s.kind === 'knockout').sort((a, b) => a.sort - b.sort).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select></label>
                  </div>
                  {hasFilter && <button className="btn btn-ghost" onClick={() => setSp(p => { const n = new URLSearchParams(p); ['court', 'team', 'group'].forEach(k => n.delete(k)); return n }, { replace: true })}>{t('clearFilters')}</button>}
                </div>
                {(() => {
                  const secs = sectionize(filterMatches(data.matches, flt), by, data, t, flt.team)
                  return secs.length ? secs.map(sec => (
                    <section key={sec.key}>
                      {sec.title && <h3 className="section-title mb-2">{sec.title} <span className="muted font-normal">· {t('sectionCount', { n: sec.matches.length })}</span></h3>}
                      <div className="space-y-2">{sec.matches.map(m => <MatchRow key={`${sec.key}-${m.id}`} m={m} data={data} />)}</div>
                    </section>
                  )) : <div className="muted text-sm">{t('nothingFound')}</div>
                })()}
              </div>
            )}
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
              <div key={s.id} className="mb-6"><h3 className="section-title mb-2">{s.name}</h3>{champion(s)}
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
