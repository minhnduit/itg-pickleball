import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { TidGate } from '../../components/TidGate'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/i18n'

function Guard({ tid, children }: { tid: string; children: ReactNode }) {
  const t = useT()
  const loc = useLocation()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [isOrg, setIsOrg] = useState<boolean | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !tid) return
    supabase.from('organizers').select('user_id').eq('tournament_id', tid).eq('user_id', session.user.id)
      .then(({ data, error }) => { if (error) setErr(error.message); else setIsOrg(!!data?.length) })
  }, [session, tid])

  if (session === undefined) return <div className="p-4">{t('loading')}</div>
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (err) return <div className="p-4 font-semibold text-live">{err}</div>
  if (isOrg === null) return <div className="p-4">{t('loading')}</div>
  if (!isOrg) return <div className="p-4 font-semibold text-live">{t('notOrganizer')}</div>
  return <>{children}</>
}

export default function OrgGuard({ children }: { children: ReactNode }) {
  return <TidGate>{tid => <Guard tid={tid}>{children}</Guard>}</TidGate>
}
