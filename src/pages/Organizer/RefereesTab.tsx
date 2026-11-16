import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { printCourtsPath, refUrl } from '../../lib/paths'
import { supabase } from '../../lib/supabase'
import { orgCreateRefToken, orgRevokeRefToken } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { useToast } from '../../components/Toast'
import { QrCard } from '../../components/QrCard'
import { Icon } from '../../components/Icon'
import type { TabProps } from '../../lib/useTournamentData'
import type { Court, RefTokenRow } from '../../lib/types'

function CourtRefs({ court, tokens, refresh }: { court: Court; tokens: RefTokenRow[]; refresh: () => void }) {
  const t = useT()
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [hours, setHours] = useState('18')
  const [label, setLabel] = useState('')
  const [created, setCreated] = useState<{ key: string; pin: string } | null>(null)

  const status = (r: RefTokenRow) =>
    r.revoked ? t('tokRevoked') : new Date(r.expires_at) < new Date() ? t('tokExpired') : r.device_id ? t('tokClaimed') : t('tokNotClaimed')
  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const key = await orgCreateRefToken(court.id, pin || null, Number(hours), label || null)
      setCreated({ key, pin }); setPin(''); setLabel(''); refresh()
    } catch (err) { toast.error((err as Error).message) }
  }
  const revoke = async (id: string) => {
    try { await orgRevokeRefToken(id); refresh() } catch (err) { toast.error((err as Error).message) }
  }

  const tone = (r: RefTokenRow) =>
    r.revoked || new Date(r.expires_at) < new Date() ? 'bg-live-50 text-live' : r.device_id ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-700'
  const active = tokens.filter(r => !r.revoked && new Date(r.expires_at) >= new Date()).length
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h3 className="section-title">{court.name}</h3>
        <span className="muted text-xs">{t('activeKeys', { n: active })}</span>
      </div>
      <div className="space-y-4 p-4">
        {tokens.length > 0 && (
          <table className="table-std">
            <tbody>
              {tokens.map(r => (
                <tr key={r.id}>
                  <td>{r.label ?? ''}</td>
                  <td><span className={`pill ${tone(r)}`}>{status(r)}</span></td>
                  <td className="muted text-xs">{new Date(r.expires_at).toLocaleString()}</td>
                  <td className="text-right">{!r.revoked && <button className="btn btn-danger btn-sm" onClick={() => revoke(r.id)}>{t('revoke')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form className="flex flex-wrap gap-2" onSubmit={create}>
          <input className="input !w-28" inputMode="numeric" pattern="[0-9]{4,6}" placeholder={t('pinOptional')} value={pin} onChange={e => setPin(e.target.value)} />
          <input className="input !w-20" type="number" min={1} value={hours} onChange={e => setHours(e.target.value)} title={t('hours')} aria-label={t('hours')} />
          <input className="input min-w-0 flex-1" placeholder={t('label')} value={label} onChange={e => setLabel(e.target.value)} />
          <button className="btn btn-primary">{t('createKey')}</button>
        </form>
        {created && (
          <div className="rounded-lg border-2 border-gold p-4 text-center">
            <div className="no-print mb-2 text-sm font-semibold">{t('shownOnce')}</div>
            <QrCard eyebrow={t('eyebrowRef')} title={court.name} url={refUrl(created.key)} subtitle={t('refQrSubtitle')} pin={created.pin ? t('pinLabel', { pin: created.pin }) : null} />
            <div><button className="no-print btn btn-dark mt-3" onClick={() => window.print()}>{t('print')}</button></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RefereesTab({ tid, data }: TabProps) {
  const t = useT()
  const toast = useToast()
  const [tokens, setTokens] = useState<RefTokenRow[]>([])
  const refresh = useCallback(async () => {
    const { data: rows, error } = await supabase.from('ref_tokens')
      .select('id,tournament_id,court_id,label,device_id,expires_at,revoked,created_at').eq('tournament_id', tid).order('created_at')
    if (error) toast.error(error.message); else setTokens(rows as RefTokenRow[])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid])
  useEffect(() => { refresh() }, [refresh])

  return (
    <div>
      <Link className="no-print btn btn-secondary mb-4" to={printCourtsPath(data.tournament ?? { id: tid, slug: null })}><Icon name="qr" size={16} />{t('printCourtQrs')}</Link>
      <div className="grid gap-4 xl:grid-cols-2">
        {data.courts.map(c => <CourtRefs key={c.id} court={c} tokens={tokens.filter(r => r.court_id === c.id)} refresh={refresh} />)}
      </div>
    </div>
  )
}
