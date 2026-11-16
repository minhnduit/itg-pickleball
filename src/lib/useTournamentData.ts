import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Court, Group, Match, Stage, Team, Tournament } from './types'

export interface TData {
  tournament: Tournament | null
  courts: Court[]; stages: Stage[]; groups: Group[]; teams: Team[]; matches: Match[]
}
const empty: TData = { tournament: null, courts: [], stages: [], groups: [], teams: [], matches: [] }

export const sortMatches = (ms: Match[]) =>
  [...ms].sort((a, b) => (a.queue_order ?? 1e9) - (b.queue_order ?? 1e9) || a.id - b.id)

export function useTournamentData(tid: string) {
  const [data, setData] = useState<TData>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [t, c, s, tm, m] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tid).maybeSingle(),
        supabase.from('courts').select('*').eq('tournament_id', tid).order('sort').order('name'),
        supabase.from('stages').select('*').eq('tournament_id', tid).order('sort'),
        supabase.from('teams').select('*').eq('tournament_id', tid).order('name'),
        supabase.from('matches').select('*').eq('tournament_id', tid)
          .order('queue_order', { nullsFirst: false }).order('id'),
      ])
      const err = t.error ?? c.error ?? s.error ?? tm.error ?? m.error
      if (err) throw new Error(err.message)
      const stages = (s.data ?? []) as Stage[]
      const g = stages.length
        ? await supabase.from('groups').select('*').in('stage_id', stages.map(x => x.id)).order('sort')
        : { data: [], error: null }
      if (g.error) throw new Error(g.error.message)
      setData({
        tournament: (t.data as Tournament | null), courts: (c.data ?? []) as Court[], stages,
        groups: (g.data ?? []) as Group[], teams: (tm.data ?? []) as Team[], matches: (m.data ?? []) as Match[],
      })
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [tid])

  useEffect(() => {
    reload()
    const ch = supabase.channel(`t-${tid}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tid}` }, payload => {
        setData(d => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: number }).id
            return { ...d, matches: d.matches.filter(x => x.id !== id) }
          }
          const row = payload.new as Match
          return { ...d, matches: sortMatches([...d.matches.filter(x => x.id !== row.id), row]) }
        })
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') reload() })
    const iv = setInterval(reload, 20000)
    return () => { clearInterval(iv); supabase.removeChannel(ch) }
  }, [tid, reload])

  return { data, loading, error, reload }
}

export interface TabProps { tid: string; data: TData; reload: () => Promise<void> }
