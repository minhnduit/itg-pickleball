import type { Team } from '../lib/types'
import type { StandingRow } from '../lib/standings'
import { useT } from '../lib/i18n'
import { Avatar } from './Avatar'

export function GroupTable({ rows, teams, complete, onReorder, topN, dark = false }: {
  rows: StandingRow[]; teams: Team[]; complete: boolean
  onReorder?: (teamId: string, dir: -1 | 1) => void; topN?: number; dark?: boolean
}) {
  const t = useT()
  const r = 'text-right'
  const hide = 'hidden sm:table-cell'
  const wrap = `[&_td]:!px-2 [&_th]:!px-2 sm:[&_td]:!px-3 sm:[&_th]:!px-3 ${dark ? '[&_th]:!bg-brand-800 [&_th]:!text-brand-100 [&_th]:!border-brand-800 [&_td]:!border-brand-800 text-white' : ''}`
  const th = (short: string, full: string, cls = r) => <th className={cls}><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{full}</span></th>
  return (
    <table className={`table-std ${wrap}`}>
      <thead>
        <tr>
          <th className="w-8">#</th><th>{t('team')}</th>
          {th(t('colPShort'), t('colP'))}{th(t('colWShort'), t('colW'))}{th(t('colLShort'), t('colL'))}
          <th className={`${r} ${hide}`}>{t('colPF')}</th><th className={`${r} ${hide}`}>{t('colPA')}</th><th className={r}>{t('diffCol')}</th><th className={hide} />
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const team = teams.find(x => x.id === row.teamId)
          const adv = topN !== undefined && row.rank <= topN
          const notes = (
            <>
              {row.tiebreak === 'h2h' && <span className="pill bg-ink-100 text-ink-700">{t('tbH2h')}</span>}
              {row.tiebreak === 'manual' && <span className="pill bg-ink-100 text-ink-700">{t('tbManual')}</span>}
              {row.needsDecision && complete && <span className="pill bg-gold text-ink-950">{t('tbNeedsDecision')}</span>}
            </>
          )
          return (
            <tr key={row.teamId}>
              <td>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${adv ? 'bg-brand-600 text-white' : dark ? 'bg-brand-800 text-brand-100' : 'bg-ink-100 text-ink-700'}`}>{row.rank}</span>
              </td>
              <td className="max-w-0 w-full sm:max-w-none">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="hidden sm:inline-flex"><Avatar name={team?.name ?? ''} /></span>
                  <span className="min-w-0 truncate font-semibold">{team?.name}</span>
                </span>
                <span className="mt-0.5 flex gap-1 sm:hidden">{notes}</span>
              </td>
              <td className={r}>{row.played}</td><td className={`${r} font-bold`}>{row.wins}</td><td className={r}>{row.losses}</td>
              <td className={`${r} ${hide}`}>{row.pointsFor}</td><td className={`${r} ${hide}`}>{row.pointsAgainst}</td>
              <td className={`${r} font-semibold ${row.diff > 0 ? (dark ? 'text-gold' : 'text-brand-700') : row.diff < 0 ? 'text-live' : ''}`}>{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
              <td className={hide}>
                <span className="flex items-center gap-1">
                  {notes}
                  {onReorder && row.needsDecision && (
                    <>
                      <button className="btn btn-secondary btn-sm !px-2" aria-label="↑" onClick={() => onReorder(row.teamId, -1)}>↑</button>
                      <button className="btn btn-secondary btn-sm !px-2" aria-label="↓" onClick={() => onReorder(row.teamId, 1)}>↓</button>
                    </>
                  )}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
