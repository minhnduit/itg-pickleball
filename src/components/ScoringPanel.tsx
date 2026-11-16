import { useState, type ReactNode } from 'react'
import type { Match, ResultType, Side, Stage, Team } from '../lib/types'
import { scoreRally, scoreSpecial, scoreStart, scoreUndo, type RefAuth } from '../lib/api'
import { displayLabel, teamName } from '../lib/display'
import { useT } from '../lib/i18n'
import { useWakeLock } from '../lib/useWakeLock'
import { needsSwitch } from './ScoreCard'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

type Special = Exclude<ResultType, 'normal'>

export function ScoringPanel({ match, teams, stages, stageName, courtName, auth, onError, onUpdate, headerRight, footer }: {
  match: Match; teams: Team[]; stages: Stage[]; stageName: string; courtName: string
  auth?: RefAuth; onError: (msg: string) => void; onUpdate?: (m: Match) => void
  headerRight?: ReactNode; footer?: ReactNode
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [special, setSpecial] = useState<Special | null>(null)
  useWakeLock(match.status === 'live')

  const run = async (fn: () => Promise<Match>) => {
    setBusy(true)
    try { onUpdate?.(await fn()) } catch (e) { onError((e as Error).message) } finally { setBusy(false) }
  }
  const nameA = teamName(teams, match.team_a_id), nameB = teamName(teams, match.team_b_id)
  const name = (s: Side) => (s === 'A' ? nameA : nameB)
  const btn = 'btn !h-12 disabled:opacity-40'
  const outline = `${btn} border border-ink-700 text-white hover:bg-ink-800`
  const sideBg = (s: Side) => (s === 'A' ? 'bg-sideA active:bg-sideA-700 text-white' : 'bg-sideB active:bg-sideB-700 text-ink-950')

  const pickWinner = (s: Side) => {
    const kind = special
    setSpecial(null)
    if (kind && window.confirm(t('confirmSpecial', { result: t(`res_${kind}` as const), team: name(s) }))) {
      run(() => scoreSpecial(match.id, kind, s, auth))
    }
  }

  const specialMenu = (
    <>
      {special === null ? (
        <div className="flex flex-wrap gap-2">
          {(['forfeit', 'retired', 'no_show'] as const).map(k => (
            <button key={k} className={`${outline} !h-10 text-xs`} disabled={busy} onClick={() => setSpecial(k)}>{t(`res_${k}` as const)}</button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label !text-ink-400">{t('pickWinner')}</span>
          {(['A', 'B'] as const).map(s => (
            <button key={s} className={`${outline} !h-10 text-xs`} disabled={busy} onClick={() => pickWinner(s)}>{name(s)}</button>
          ))}
          <button className={`${btn} !h-10 text-xs text-ink-300`} onClick={() => setSpecial(null)}>{t('cancel')}</button>
        </div>
      )}
    </>
  )

  const header = (
    <div className="flex items-center gap-3 border-b-2 border-gold bg-brand-900 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold">{courtName}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-400">
          <span className="rounded bg-gold px-1.5 font-bold text-ink-950">{displayLabel(match, stages)}</span>
          <span className="truncate">{stageName}</span>
        </div>
      </div>
      {headerRight}
    </div>
  )
  const undo = (
    <button className={`${outline} px-4`} disabled={busy} onClick={() => run(() => scoreUndo(match.id, auth))}>
      <Icon name="undo" size={18} />{t('undo')}
    </button>
  )
  const root = (children: ReactNode) => <div className="min-h-[100dvh] bg-ink-950 text-white">{header}{children}{footer}</div>

  if (match.status === 'scheduled' || match.status === 'called') {
    return root(
      <div className="space-y-4 p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar name={nameA} size="lg" /><div className="text-2xl font-bold">{nameA}</div>
          <div className="label !text-ink-400">{t('vs')}</div>
          <Avatar name={nameB} size="lg" /><div className="text-2xl font-bold">{nameB}</div>
        </div>
        <div className="label !text-ink-400 pt-2">{t('whoServesFirst')}</div>
        <div className="space-y-3">
          {(['A', 'B'] as const).map(s => (
            <button key={s} className={`h-20 w-full rounded-lg text-xl font-bold disabled:opacity-40 ${sideBg(s)}`} disabled={busy}
              onClick={() => run(() => scoreStart(match.id, s, auth))}>{name(s)}</button>
          ))}
        </div>
        <div className="pt-2">{specialMenu}</div>
      </div>,
    )
  }

  if (match.status === 'finished' || match.status === 'confirmed') {
    const win = (s: Side) => match.winner === s
    return root(
      <div className="space-y-4 p-6 text-center">
        <div className="flex items-center justify-center gap-6">
          {(['A', 'B'] as const).map(s => (
            <div key={s} className={`min-w-0 flex-1 ${win(s) ? 'text-gold' : 'text-ink-500'}`}>
              <div className="font-score text-8xl font-bold leading-none tnum">{s === 'A' ? match.score_a : match.score_b}</div>
              <div className="mt-2 truncate text-base font-semibold">{name(s)}</div>
            </div>
          ))}
        </div>
        {match.result_type !== 'normal' && <div className="label !text-ink-400">{t(`res_${match.result_type}` as const)}</div>}
        <div className="text-ink-300">{match.status === 'finished' ? t('waitingConfirm') : t('st_confirmed')}</div>
        {match.status === 'finished' && match.result_type === 'normal' && <div>{undo}</div>}
      </div>,
    )
  }

  // live
  const servingScore = match.serving_team === 'A' ? match.score_a : match.score_b
  const receivingScore = match.serving_team === 'A' ? match.score_b : match.score_a
  const dot = (s: Side) => (match.serving_team === s ? <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-gold" /> : null)
  return root(
    <div>
      <div className="p-4 text-center">
        <div className="font-score text-[96px] font-bold leading-none tnum">{servingScore}-{receivingScore}-{match.server_number}</div>
        <div className="label mt-1 !text-ink-400">{t('scoreCallHint')}</div>
        <div className="mt-2 flex items-center justify-center gap-4 text-sm text-ink-300">
          <span>{dot('A')}{nameA} <b className="font-score text-lg text-white">{match.score_a}</b></span>
          <span>{dot('B')}{nameB} <b className="font-score text-lg text-white">{match.score_b}</b></span>
        </div>
        {needsSwitch(match) && (
          <div className="mt-3 rounded-lg bg-gold py-4 text-3xl font-extrabold uppercase tracking-wide text-ink-950">{t('switchSides')}</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 px-4">
        {(['A', 'B'] as const).map(s => (
          <button key={s} disabled={busy} aria-label={t('rallyWon', { team: name(s) })} onClick={() => run(() => scoreRally(match.id, s, auth))}
            className={`flex h-[42vh] flex-col items-center justify-center gap-2 rounded-xl px-2 disabled:opacity-40 ${sideBg(s)} ${match.serving_team === s ? `border-t-4 ${s === 'A' ? 'border-gold' : 'border-ink-950'}` : ''}`}>
            {match.serving_team === s && <span className={`flex items-center gap-1 text-xs font-bold uppercase ${s === 'A' ? 'text-gold' : 'text-ink-950'}`}><span className={`h-2 w-2 rounded-full ${s === 'A' ? 'bg-gold' : 'bg-ink-950'}`} />{t('serving')}</span>}
            <span className="break-words text-2xl font-bold">{name(s)}</span>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{t('rallyWonShort')}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        {undo}
        {specialMenu}
      </div>
    </div>,
  )
}
