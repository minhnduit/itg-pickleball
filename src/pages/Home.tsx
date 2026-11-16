import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Tournament } from '../lib/types'
import { LangToggle, useT } from '../lib/i18n'
import { adminPath, isValidSlug, pubPath, slugify, tvPath } from '../lib/paths'
import { useToast } from '../components/Toast'
import { SlugField } from '../components/SlugField'
import { BRAND_NAME } from '../components/Wordmark'
import { Icon } from '../components/Icon'

function DateBlock({ date }: { date: string | null }) {
  const d = date ? new Date(`${date}T00:00:00`) : null
  return (
    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md bg-brand-50 text-brand-700">
      {d ? (
        <>
          <span className="font-score text-3xl font-bold leading-none">{d.getDate()}</span>
          <span className="label !text-brand-700">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
        </>
      ) : <Icon name="trophy" size={26} />}
    </div>
  )
}

export default function Home() {
  const t = useT()
  const toast = useToast()
  const [list, setList] = useState<Tournament[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [slug, setSlug] = useState<string | null>(null) // null = follow the name suggestion
  const slugValue = slug ?? slugify(name)

  const load = async () => {
    const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
    if (error) toast.error(error.message); else setList(data as Tournament[])
  }
  useEffect(() => {
    load()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (slugValue && !isValidSlug(slugValue)) return toast.error(t('slugInvalid'))
    const { error } = await supabase.from('tournaments').insert({ name, event_date: date || null, slug: slugValue || null })
    if (error) return toast.error(error.message)
    setName(''); setDate(''); setSlug(null); load()
  }

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-gold bg-brand-900 text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-end px-4">
          <div className="flex items-center gap-3">
            <LangToggle dark />
            {session
              ? <button className="btn btn-ghost btn-sm !text-white hover:!bg-brand-800" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={16} />{t('logout')}</button>
              : <Link className="btn btn-ghost btn-sm !text-white hover:!bg-brand-800" to="/login">{t('login')}</Link>}
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-4">
          <div className="flex items-center gap-4">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-gold" />
            <div>
              <h1 className="display text-3xl">{BRAND_NAME}</h1>
              <p className="text-sm text-brand-100">{t('tournamentsSub')}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-3 p-4">
        <h2 className="section-title">{t('tournaments')}</h2>
        {list.map(x => (
          <div key={x.id} className="card flex flex-wrap items-center gap-4 p-4">
            <DateBlock date={x.event_date} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{x.name}</div>
              <div className="muted text-sm">{x.event_date}</div>
            </div>
            <div className="flex gap-2">
              <Link className="btn btn-secondary btn-sm" to={pubPath(x)}>{t('public')}</Link>
              <Link className="btn btn-secondary btn-sm" to={tvPath(x)}>{t('tv')}</Link>
              <Link className="btn btn-dark btn-sm" to={adminPath(x)}>{t('organizer')}</Link>
            </div>
          </div>
        ))}
        {!list.length && <div className="muted rounded-lg border border-dashed border-ink-300 p-8 text-center text-sm">{t('noTournaments')}</div>}
        {session && (
          <form onSubmit={create} className="card mt-6 grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block"><span className="label">{t('tournamentName')}</span>
              <input className="input mt-1" required value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="block"><span className="label">{t('date')}</span>
              <input className="input mt-1" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <div className="sm:col-span-2"><SlugField value={slugValue} onChange={setSlug} /></div>
            <button className="btn btn-primary sm:col-span-2">{t('createTournament')}</button>
          </form>
        )}
      </main>
    </div>
  )
}
