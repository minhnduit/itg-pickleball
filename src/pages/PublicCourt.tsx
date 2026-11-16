import { Link, useParams } from 'react-router-dom'
import { TidGate } from '../components/TidGate'
import { findCourt, pubPath } from '../lib/paths'
import { LangToggle, useT } from '../lib/i18n'
import { useTournamentData } from '../lib/useTournamentData'
import { ScoreCard } from '../components/ScoreCard'
import { MatchRow } from '../components/MatchRow'
import { Icon } from '../components/Icon'

function PublicCourt({ tid }: { tid: string }) {
  const t = useT()
  const { court: courtParam = '' } = useParams()
  const { data, loading } = useTournamentData(tid)
  const tk = data.tournament ?? { id: tid, slug: null }
  const court = findCourt(data.courts, courtParam)
  const on = data.matches.filter(m => court && m.court_id === court.id)
  const cur = on.find(m => m.status === 'live') ?? on.find(m => m.status === 'called')
  const next = on.find(m => m.status === 'scheduled')
  const last = on.filter(m => m.status === 'finished' || m.status === 'confirmed')
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? '')).slice(0, 5)

  if (loading) return <div className="p-4">{t('loading')}</div>
  return (
    <div className="min-h-screen pb-6">
      <header className="border-b-2 border-gold bg-brand-900 text-white">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-3">
          <Link to={pubPath(tk)} aria-label={t('back')} className="btn btn-ghost !h-9 !px-2 !text-white hover:!bg-brand-800"><Icon name="chevronLeft" /></Link>
          <div className="min-w-0 flex-1">
            <div className="display truncate text-xl leading-tight">{court?.name}</div>
            <div className="truncate text-xs text-brand-100">{data.tournament?.name}</div>
          </div>
          <LangToggle dark />
        </div>
      </header>
      <main className="mx-auto max-w-md space-y-4 p-3">
        {cur ? <ScoreCard match={cur} teams={data.teams} stages={data.stages} big /> : <div className="card muted p-4 text-sm">{t('noCurrent')}</div>}
        <section>
          <h2 className="section-title mb-2">{t('next')}</h2>
          {next ? <MatchRow m={next} data={data} hideCourt /> : <div className="muted text-sm">—</div>}
        </section>
        <section>
          <h2 className="section-title mb-2">{t('lastResults')}</h2>
          <div className="space-y-2">{last.map(m => <MatchRow key={m.id} m={m} data={data} hideCourt />)}</div>
        </section>
      </main>
    </div>
  )
}

export default function PublicCourtPage() {
  return <TidGate>{tid => <PublicCourt tid={tid} />}</TidGate>
}
