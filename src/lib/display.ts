import type { Group, Match, Stage, Team } from './types'
import type { T } from './i18n'

export const teamName = (teams: Team[], id: string | null) => teams.find(x => x.id === id)?.name ?? '—'

export function displayLabel(m: Pick<Match, 'label' | 'stage_id'>, stages: Stage[]): string {
  const st = stages.find(s => s.id === m.stage_id)
  if (!st || st.kind !== 'knockout') return m.label ?? ''
  const last = st.name.trim().split(/\s+/).pop() ?? ''
  return `${last.length === 1 ? last : st.name}-${m.label ?? ''}`
}

export function slotLabel(slot: string | null, d: { groups: Group[]; matches: Match[]; stages: Stage[] }, t: T): string {
  if (!slot) return '—'
  const [kind, a, b] = slot.split(':')
  if (kind === 'G') {
    const n = Number(b)
    const rank = n >= 1 && n <= 4 ? t(`rank_${n}` as 'rank_1') : t('rankN', { n })
    return t('slotGroupRank', { group: d.groups.find(g => g.id === a)?.name ?? '?', rank })
  }
  if (kind === 'W') {
    const m = d.matches.find(x => String(x.id) === a)
    return t('slotWinner', { label: m?.label ?? '?' })
  }
  return slot
}

// case/accent-insensitive text for search
export const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

import type { Lang } from './i18n'
const loc = (l: Lang) => (l === 'vi' ? 'vi-VN' : 'en-GB')
const DATE = { day: '2-digit', month: '2-digit', year: 'numeric' } as const
const fmt = (d: Date, lang: Lang, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc(lang), o).format(d)
export const fmtDateTime = (iso: string, lang: Lang) => {
  const d = new Date(iso)
  return `${fmt(d, lang, DATE)} ${fmt(d, lang, { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
export const fmtDate = (isoDate: string, lang: Lang) => fmt(new Date(`${isoDate}T00:00:00`), lang, DATE)
