import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TidGate } from '../components/TidGate'
import { useT } from '../lib/i18n'
import { useTournamentData } from '../lib/useTournamentData'
import { displayLabel, teamName } from '../lib/display'
import { computeGroupStandings, groupComplete } from '../lib/standings'
import { ScoreCard } from '../components/ScoreCard'
import { GroupTable } from '../components/GroupTable'
import { ChampionCard } from '../components/ChampionCard'
import { stageChampion } from '../lib/bracket'
import { BracketView } from '../components/BracketView'

const ALL_VIEWS = ['courts', 'standings', 'brackets', 'upnext', 'champions'] as const
type View = (typeof ALL_VIEWS)[number]

function Tv({ tid }: { tid: string }) {
  const t = useT()
  const [params, setSearchParams] = useSearchParams()
  const { data } = useTournamentData(tid)
  const [now, setNow] = useState(new Date())
  const [idx, setIdx] = useState(0)
  const [scale, setScale] = useState(1)
  const [paused, setPaused] = useState(false)
  const [nav, setNav] = useState(0)

  const champs = data.stages.filter(s => s.kind === 'knockout').flatMap(s => {
    const team = data.teams.find(x => x.id === stageChampion(s, data.matches))
    return team ? [{ stage: s, team }] : []
  })
  // 'champions' only exists once a champion does; it drops out of rotation, keys and dots otherwise
  const VIEWS: readonly View[] = champs.length ? ALL_VIEWS : ALL_VIEWS.filter(v => v !== 'champions')
  const raw = params.get('view')
  const pinned = raw && (VIEWS as readonly string[]).includes(raw) ? (raw as View) : null
  const cur = pinned ? VIEWS.indexOf(pinned) : idx % VIEWS.length
  const view: View = VIEWS[cur]

  const go = (i: number) => {
    if (params.has('view')) {
      setSearchParams(p => { const n = new URLSearchParams(p); n.delete('view'); return n }, { replace: true })
      setPaused(false)
    }
    setNav(n => n + 1)
    setIdx(((i % VIEWS.length) + VIEWS.length) % VIEWS.length)
  }

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    fit(); window.addEventListener('resize', fit)
    return () => { clearInterval(i); window.removeEventListener('resize', fit) }
  }, [])

  useEffect(() => {
    if (paused || pinned) return
    const r = setInterval(() => setIdx(x => x + 1), 15000)
    return () => clearInterval(r)
  }, [paused, pinned, idx, nav])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      let act: (() => void) | null = null
      if (e.key === 'ArrowRight' || e.key === 'PageDown') act = () => go(cur + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') act = () => go(cur - 1)
      else if (e.key >= '1' && e.key <= '5' && Number(e.key) <= VIEWS.length) act = () => go(Number(e.key) - 1)
      else if (e.key === ' ' || e.key === 'k') act = () => setPaused(p => !p)
      if (!act) return
      e.preventDefault()
      if (!e.repeat) act()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rr = data.stages.find(s => s.kind === 'round_robin')
  const upNext = data.matches.filter(m => m.status === 'scheduled' || m.status === 'called').slice(0, 10)

  const cols = data.courts.length > 4 ? 'grid-cols-3' : 'grid-cols-2'
  return (
    <div className="h-screen w-screen overflow-hidden bg-brand-950 text-white">
      <div style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <div className="flex h-24 items-center justify-between border-b-4 border-gold bg-brand-900 px-12">
          <div className="flex items-center gap-5">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-gold" />
            <span className="display text-5xl text-white">{data.tournament?.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {VIEWS.map((v, i) => (
              <button key={v} type="button" aria-label={t(`tvView_${v}`)} onClick={() => go(i)}
                className="cursor-pointer rounded-full p-2 focus-visible:ring-2 focus-visible:ring-gold">
                <span className={`block h-3 w-3 rounded-full ${v === view ? 'bg-gold' : 'bg-brand-800'}`} />
              </button>
            ))}
            {paused && !pinned && <span className="ml-4 font-score text-2xl uppercase text-gold">{t('tvPaused')}</span>}
          </div>
          <span className="font-score text-6xl font-bold tnum text-gold">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
        </div>
        <div className="p-10">
          {view === 'courts' && (
            <div className={`grid ${cols} gap-6`}>
              {data.courts.map(c => {
                const on = data.matches.filter(m => m.court_id === c.id)
                const m = on.find(x => x.status === 'live') ?? on.find(x => x.status === 'called')
                  ?? on.filter(x => x.finished_at).sort((a, b) => b.finished_at!.localeCompare(a.finished_at!))[0]
                return m
                  ? <ScoreCard key={c.id} size="tv" match={m} teams={data.teams} stages={data.stages} courtName={c.name} />
                  : <div key={c.id} className="rounded-xl border border-brand-800 bg-brand-900 p-8 text-4xl text-brand-100/70">{c.name}: {t('noCurrent')}</div>
              })}
            </div>
          )}
          {view === 'standings' && (
            <div className="grid grid-cols-2 gap-6 text-2xl">
              {data.groups.filter(g => g.stage_id === rr?.id).map(g => {
                const ms = data.matches.filter(m => m.group_id === g.id)
                const rows = computeGroupStandings(data.teams.filter(x => x.group_id === g.id).map(x => x.id), ms, rr?.config.manual_order?.[g.id])
                return (
                  <div key={g.id} className="rounded-xl border border-brand-800 bg-brand-900 p-6">
                    <h3 className="display mb-3 border-b-4 border-gold pb-2 text-4xl text-white">{t('groupN', { name: g.name })}</h3>
                    <GroupTable dark rows={rows} teams={data.teams} complete={groupComplete(ms)} topN={rr?.config.top_n} />
                  </div>
                )
              })}
            </div>
          )}
          {view === 'brackets' && (() => {
            const kos = data.stages.filter(s => s.kind === 'knockout')
            return (
              <div className="grid gap-10" style={{ gridTemplateColumns: `repeat(${Math.max(1, kos.length)}, 1fr)` }}>
                {kos.map(s => {
                  const c = champs.find(x => x.stage.id === s.id)
                  return (
                    <div key={s.id} className="min-w-0">
                      <h3 className="display mb-3 text-4xl text-gold">{s.name}</h3>
                      {c && <div className="mb-4"><ChampionCard size="tv" dark team={c.team} stageName={s.name} /></div>}
                      <BracketView tv dark stage={s} matches={data.matches} allMatches={data.matches} teams={data.teams} groups={data.groups} stages={data.stages} />
                    </div>
                  )
                })}
              </div>
            )
          })()}
          {view === 'champions' && (
            <div className="flex h-[900px] flex-col justify-center gap-10">
              {champs.map(c => <ChampionCard key={c.stage.id} size="tv" dark team={c.team} stageName={c.stage.name} />)}
            </div>
          )}
          {view === 'upnext' && (
            <ul className="space-y-3">
              {upNext.map(m => (
                <li key={m.id} className="flex items-center gap-6 rounded-lg border border-brand-800 bg-brand-900 px-6 py-4 text-3xl">
                  <span className="rounded bg-gold px-3 font-bold text-ink-950">{displayLabel(m, data.stages)}</span>
                  <span className="w-48 text-brand-100/70">{data.courts.find(c => c.id === m.court_id)?.name ?? '—'}</span>
                  <span className="flex-1 font-semibold">{teamName(data.teams, m.team_a_id)} <span className="mx-3 text-brand-100/50">{t('vs')}</span> {teamName(data.teams, m.team_b_id)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TvPage() {
  return <TidGate>{tid => <Tv tid={tid} />}</TidGate>
}
