import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { useTid } from '../lib/paths'

// Resolves the :slug route param (slug or uuid) to a tournament id before rendering the page.
export function TidGate({ children }: { children: (tid: string) => ReactNode }) {
  const t = useT()
  const { slug } = useParams()
  const { tid, notFound } = useTid(slug)
  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="display text-3xl text-brand-700">{t('notFound')}</h1>
        <Link className="btn btn-primary" to="/">{t('home')}</Link>
      </div>
    )
  }
  if (!tid) return <div className="muted p-6 text-center">{t('loading')}</div>
  return <>{children(tid)}</>
}
