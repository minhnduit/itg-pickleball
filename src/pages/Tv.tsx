import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TidGate } from '../components/TidGate'
import { useT } from '../lib/i18n'
import { useTournamentData } from '../lib/useTournamentData'
import { displayLabel, teamName } from '../lib/display'
import { computeGroupStandings, groupComplete } from '../lib/standings'
import { ScoreCard } from '../components/ScoreCard'
import { GroupTable } from '../components/GroupTable'
import { BracketView } from '../components/BracketView'

const VIEWS = ['courts', 'standings', 'brackets', 'upnext'] as const
type View = (typeof VIEWS)[number]

function Tv({ tid }: { tid: string }) {
  const t = useT()
  const [params] = useSearchParams()
  const { data } = useTournamentData(tid)
  const [now, setNow] = useState(new Date())
  const [idx, setIdx] = useState(0)
  const [scale, setScale] = useState(1)

  const pinned = params.get('view') as View | null
  const view: View = pinned && VIEWS.includes(pinned) ? pinned : VIEWS[idx % VIEWS.length]

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    const r = setInterval(() => setIdx(x => x + 1), 15000)
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    fit(); window.addEventListener('resize', fit)
    return () => { clearInterval(i); clearInterval(r); window.removeEventListener('resize', fit) }
  }, [])

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
          <div className="flex gap-3">
            {VIEWS.map(v => <span key={v} className={`h-3 w-3 rounded-full ${v === view ? 'bg-gold' : 'bg-brand-800'}`} />)}
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
          {view === 'brackets' && data.stages.filter(s => s.kind === 'knockout').map(s => (
            <div key={s.id} className="mb-8"><h3 className="display mb-3 text-4xl text-gold">{s.name}</h3>
              <BracketView dark stage={s} matches={data.matches} allMatches={data.matches} teams={data.teams} groups={data.groups} stages={data.stages} /></div>
          ))}
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
