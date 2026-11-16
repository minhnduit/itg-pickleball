import { Link } from 'react-router-dom'
import { absUrl, adminPath } from '../../lib/paths'
import { TidGate } from '../../components/TidGate'
import { useT } from '../../lib/i18n'
import { useTournamentData } from '../../lib/useTournamentData'
import { QrCard } from '../../components/QrCard'

function PrintCourts({ tid }: { tid: string }) {
  const t = useT()
  const { data } = useTournamentData(tid)
  const tk = data.tournament ?? { id: tid, slug: null }
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="no-print mb-6 flex items-center gap-3">
        <Link className="btn btn-secondary" to={adminPath(tk)}>{t('back')}</Link>
        <button className="btn btn-dark" onClick={() => window.print()}>{t('print')}</button>
      </div>
      <p className="no-print muted mb-4 text-sm">{t('printIdNote')}</p>
      <div className="grid grid-cols-2 justify-items-center gap-6">
        {data.courts.map(c => (
          <QrCard key={c.id} eyebrow={t('eyebrowCourt')} title={c.name} subtitle={data.tournament?.name} url={absUrl(`/${tk.id}/${c.id}`)} />
        ))}
      </div>
    </div>
  )
}

export default function PrintCourtsPage() {
  return <TidGate>{tid => <PrintCourts tid={tid} />}</TidGate>
}
