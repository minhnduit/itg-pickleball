import type { MatchStatus } from '../lib/types'
import { useT } from '../lib/i18n'

const STYLE: Record<MatchStatus, string> = {
  live: 'bg-live text-white',
  called: 'bg-gold text-ink-950',
  finished: 'bg-ink-100 text-ink-700',
  confirmed: 'bg-brand-50 text-brand-700',
  scheduled: 'bg-white border border-ink-200 text-ink-500',
}

export function StatusPill({ status, tv = false }: { status: MatchStatus; tv?: boolean }) {
  const t = useT()
  const dark = tv && status !== 'live' && status !== 'called'
  return (
    <span className={`pill ${STYLE[status]} ${tv ? '!px-4 !py-1.5 !text-2xl' : ''} ${dark ? '!bg-brand-800 !text-brand-100 !border-brand-800' : ''}`}>
      {status === 'live' && <span className={`animate-pulse rounded-full bg-white ${tv ? 'h-3 w-3' : 'h-1.5 w-1.5'}`} />}
      {t(`st_${status}` as const)}
    </span>
  )
}
