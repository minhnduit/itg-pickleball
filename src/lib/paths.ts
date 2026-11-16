import { useEffect, useState } from 'react'
import { norm } from './display'
import { supabase } from './supabase'
import type { Court } from './types'

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const RESERVED = ['login', 'ref', 't', 'org', 'admin', 'tv', 'assets', 'api']
export const isValidSlug = (s: string) => SLUG_RE.test(s) && s.length >= 2 && s.length <= 40 && !RESERVED.includes(s)

export const slugify = (s: string) =>
  norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '')

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

type TKey = { id: string; slug: string | null }
export const tKey = (t: TKey) => t.slug ?? t.id
export const pubPath = (t: TKey) => `/${tKey(t)}`
export const tvPath = (t: TKey) => `/${tKey(t)}/tv`
export const adminPath = (t: TKey) => `/${tKey(t)}/admin`
export const scorePath = (t: TKey, mid: number | string) => `/${tKey(t)}/admin/score/${mid}`
export const printCourtsPath = (t: TKey) => `/${tKey(t)}/admin/print-courts`
const COURT_RESERVED = ['tv', 'admin', 'print-courts', 'score']
// Court slug, or the id when the name slugifies to nothing, is reserved, or clashes with another court
export const courtKey = (c: Pick<Court, 'id' | 'name'>, courts: Pick<Court, 'id' | 'name'>[]) => {
  const s = slugify(c.name)
  const clash = courts.some(o => o.id !== c.id && slugify(o.name) === s)
  return !s || COURT_RESERVED.includes(s) || clash ? c.id : s
}
export const courtPath = (t: TKey, c: Pick<Court, 'id' | 'name'>, courts: Pick<Court, 'id' | 'name'>[]) => `/${tKey(t)}/${courtKey(c, courts)}`

const basePath = () => import.meta.env.BASE_URL.replace(/\/$/, '')
export const absUrl = (path: string) => `${location.origin}${basePath()}${path}`
export const refUrl = (key: string) => absUrl(`/ref?k=${key}`)

export const findCourt = (courts: Court[], param: string) =>
  courts.find(c => c.id === param || courtKey(c, courts) === param)

// Resolves the :slug route param (slug or raw uuid) to a tournament id.
export function useTid(param: string | undefined): { tid: string | null; notFound: boolean } {
  const [state, setState] = useState<{ tid: string | null; notFound: boolean }>(
    param && isUuid(param) ? { tid: param, notFound: false } : { tid: null, notFound: false })
  useEffect(() => {
    if (!param) return setState({ tid: null, notFound: true })
    if (isUuid(param)) return setState({ tid: param, notFound: false })
    let live = true
    setState({ tid: null, notFound: false })
    supabase.from('tournaments').select('id').eq('slug', param).maybeSingle()
      .then(({ data }) => { if (live) setState(data ? { tid: (data as { id: string }).id, notFound: false } : { tid: null, notFound: true }) })
    return () => { live = false }
  }, [param])
  return state
}
