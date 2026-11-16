import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isRefKeyDead, refClaim } from '../../lib/api'
import { clearRefSession, getDeviceId, getRefSession, setRefSession, type RefSession } from '../../lib/device'
import { LangToggle, useT } from '../../lib/i18n'
import { sortMatches } from '../../lib/useTournamentData'
import type { Match, Stage, Team } from '../../lib/types'
import { ScoringPanel } from '../../components/ScoringPanel'
import { useToast } from '../../components/Toast'

export default function Referee() {
  const t = useT()
  const toast = useToast()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const k = params.get('k')
  const [session, setSession] = useState<RefSession | null>(() => (k ? null : getRefSession()))
  const [needPin, setNeedPin] = useState(false)
  const [pin, setPin] = useState('')
  const [dead, setDead] = useState(false)
  const [claimErr, setClaimErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [focusId, setFocusId] = useState<number | null>(null)
  const lastLive = useRef<number | null>(null)

  const claim = useCallback(async (key: string, p: string | null) => {
    setBusy(true)
    try {
      const c = await refClaim(key, p)
      const s: RefSession = { key, court_id: c.court_id, court_name: c.court_name, tournament_id: c.tournament_id, expires_at: c.expires_at }
      setRefSession(s)
      setSession(s); setNeedPin(false); setDead(false); setClaimErr(null)
      nav('/ref', { replace: true }) // removes ?k= from the URL
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('wrong PIN')) { setNeedPin(true); if (p) toast.error(msg) }
      else if (isRefKeyDead(msg)) { clearRefSession(); setSession(null); setDead(true) }
      else { setClaimErr(msg); toast.error(msg) }
    } finally { setBusy(false) }
  }, [nav, toast])

  useEffect(() => { if (k) claim(k, null) }, [k]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!session) return
    const [m, tm, st] = await Promise.all([
      supabase.from('matches').select('*').eq('court_id', session.court_id),
      supabase.from('teams').select('*').eq('tournament_id', session.tournament_id),
      supabase.from('stages').select('*').eq('tournament_id', session.tournament_id),
    ])
    if (m.data) setMatches(sortMatches(m.data as Match[]))
    if (tm.data) setTeams(tm.data as Team[])
    if (st.data) setStages(st.data as Stage[])
  }, [session])

  useEffect(() => {
    if (!session) return
    load()
    const ch = supabase.channel(`court-${session.court_id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `court_id=eq.${session.court_id}` }, () => load())
      .subscribe(s => { if (s === 'SUBSCRIBED') load() })
    const iv = setInterval(load, 20000)
    return () => { clearInterval(iv); supabase.removeChannel(ch) }
  }, [session, load])

  const live = matches.find(m => m.status === 'live')
  useEffect(() => {
    if (live) lastLive.current = live.id
    else if (lastLive.current !== null) {
      const m = matches.find(x => x.id === lastLive.current)
      if (m && (m.status === 'finished' || m.status === 'confirmed')) setFocusId(m.id)
      lastLive.current = null
    }
  }, [live, matches])

  const shown = live
    ?? matches.find(m => m.id === focusId)
    ?? matches.find(m => m.status === 'called')
    ?? matches.find(m => m.status === 'scheduled' && m.team_a_id && m.team_b_id)

  const onError = (msg: string) => {
    if (isRefKeyDead(msg)) { clearRefSession(); setSession(null); setDead(true) } else toast.error(msg)
  }
  const onUpdate = (m: Match) => setMatches(ms => sortMatches([...ms.filter(x => x.id !== m.id), m]))

  const card = 'w-full rounded-xl border border-brand-800 bg-brand-900 p-6'
  if (dead) return <Centered><div className={`${card} text-xl font-bold`}>{t('newQr')}</div></Centered>
  if (needPin) {
    return (
      <Centered>
        <form className={`${card} space-y-4`} onSubmit={e => { e.preventDefault(); if (k) claim(k, pin) }}>
          <div className="text-lg font-bold">{t('enterPin')}</div>
          <input className="input !h-16 text-center font-score !text-3xl tracking-[0.5em]" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} />
          <button disabled={busy} className="btn btn-primary !h-14 w-full">{t('continue')}</button>
        </form>
      </Centered>
    )
  }
  if (!session && k && claimErr) {
    return (
      <Centered>
        <div className={`${card} space-y-4`}>
          <div className="text-live">{claimErr}</div>
          <button disabled={busy} className="btn btn-primary !h-14 w-full" onClick={() => { setClaimErr(null); claim(k, null) }}>{t('retry')}</button>
        </div>
      </Centered>
    )
  }
  if (!session) return <Centered>{k ? t('loading') : <div className={`${card} text-xl font-bold`}>{t('newQr')}</div>}</Centered>

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md bg-ink-950">
      {shown ? (
        <ScoringPanel key={shown.id} match={shown} teams={teams} stages={stages} courtName={session.court_name}
          stageName={stages.find(s => s.id === shown.stage_id)?.name ?? ''}
          auth={{ token: session.key, device: getDeviceId() }} onError={onError} onUpdate={onUpdate}
          headerRight={<LangToggle dark />}
          footer={focusId === shown.id && (
            <div className="p-4">
              <button className="btn btn-primary !h-14 w-full text-lg" onClick={() => setFocusId(null)}>{t('nextMatch')}</button>
            </div>
          )} />
      ) : (
        <div>
          <div className="flex items-center justify-between border-b-2 border-gold bg-brand-900 px-4 py-3">
            <span className="text-lg font-bold text-white">{session.court_name}</span><LangToggle dark />
          </div>
          <div className="p-6 text-center text-ink-300">{t('noMatchOnCourt')}</div>
        </div>
      )}
    </div>
  )
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 p-6 text-center text-white">
    <div className="w-full max-w-md">{children}</div>
  </div>
)
