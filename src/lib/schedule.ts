import type { Court, Group, Match, Stage, Team } from './types'
import type { T } from './i18n'
import { sortMatches } from './useTournamentData'

export type By = 'order' | 'court' | 'team' | 'group'
export type Filters = { court?: string; team?: string; group?: string }
export type Section = { key: string; title: string; matches: Match[] }

export const BYS: By[] = ['order', 'court', 'team', 'group']

export function filterMatches(ms: Match[], f: Filters): Match[] {
  return ms.filter(m =>
    (!f.court || (f.court === 'none' ? m.court_id === null : m.court_id === f.court)) &&
    (!f.team || m.team_a_id === f.team || m.team_b_id === f.team) &&
    (!f.group || m.group_id === f.group || m.stage_id === f.group))
}

const bySort = <X extends { sort: number }>(xs: X[]) => [...xs].sort((a, b) => a.sort - b.sort)

export function sectionize(
  ms: Match[], by: By, d: { courts: Court[]; teams: Team[]; groups: Group[]; stages: Stage[] }, t: T, teamFilter?: string,
): Section[] {
  const mk = (key: string, title: string, list: Match[]): Section => ({ key, title, matches: sortMatches(list) })
  let out: Section[] = []
  if (by === 'order') {
    const st = (...s: string[]) => ms.filter(m => s.includes(m.status))
    const done = st('finished', 'confirmed').sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    out = [mk('now', t('sec_now'), st('live', 'called')), mk('up', t('sec_upcoming'), st('scheduled')), { key: 'done', title: t('sec_done'), matches: done }]
  } else if (by === 'court') {
    out = [...bySort(d.courts).map(c => mk(c.id, c.name, ms.filter(m => m.court_id === c.id))),
      mk('none', t('sec_noCourt'), ms.filter(m => !m.court_id || !d.courts.some(c => c.id === m.court_id)))]
  } else if (by === 'team') {
    out = [...d.teams].filter(x => !teamFilter || x.id === teamFilter).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map(x => mk(x.id, x.name, ms.filter(m => m.team_a_id === x.id || m.team_b_id === x.id)))
  } else {
    const rr = d.stages.find(s => s.kind === 'round_robin')
    const stageIds = new Set(d.stages.filter(s => s.kind === 'knockout').map(s => s.id))
    const groupIds = new Set(d.groups.filter(g => g.stage_id === rr?.id).map(g => g.id))
    out = [...bySort(d.groups.filter(g => g.stage_id === rr?.id)).map(g => mk(g.id, t('groupN', { name: g.name }), ms.filter(m => m.group_id === g.id))),
      ...bySort(d.stages.filter(s => s.kind === 'knockout')).map(s => mk(s.id, s.name, ms.filter(m => m.stage_id === s.id))),
      mk('other', '', ms.filter(m => !(m.group_id && groupIds.has(m.group_id)) && !stageIds.has(m.stage_id)))]
  }
  return out.filter(s => s.matches.length)
}
