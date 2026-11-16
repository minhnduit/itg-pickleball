import { Link, useParams } from 'react-router-dom'
import { adminPath } from '../../lib/paths'
import { TidGate } from '../../components/TidGate'
import { useT } from '../../lib/i18n'
import { useTournamentData } from '../../lib/useTournamentData'
import { ScoringPanel } from '../../components/ScoringPanel'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'

function OrgScore({ tid }: { tid: string }) {
  const t = useT()
  const toast = useToast()
  const { mid = '' } = useParams()
  const { data, loading, reload } = useTournamentData(tid)
  const tk = data.tournament ?? { id: tid, slug: null }
  const match = data.matches.find(m => String(m.id) === mid)
  return (
    <div className="mx-auto min-h-[100dvh] max-w-md bg-ink-950 text-white">
      <Link className="btn btn-ghost !text-white hover:!bg-brand-800" to={adminPath(tk)}><Icon name="chevronLeft" size={18} />{t('back')}</Link>
      {loading ? <div className="p-4">{t('loading')}</div> : !match ? <div className="p-4">{t('noMatch')}</div> : (
        <ScoringPanel match={match} teams={data.teams} stages={data.stages} stageName={data.stages.find(s => s.id === match.stage_id)?.name ?? ''}
          courtName={data.courts.find(c => c.id === match.court_id)?.name ?? ''} onError={toast.error} onUpdate={() => reload()} />
      )}
    </div>
  )
}

export default function OrgScorePage() {
  return <TidGate>{tid => <OrgScore tid={tid} />}</TidGate>
}
