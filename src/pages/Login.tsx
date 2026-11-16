import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'
import { Wordmark } from '../components/Wordmark'

export default function Login() {
  const t = useT()
  const toast = useToast()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return toast.error(error.message)
    nav(params.get('next') || '/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <Wordmark className="text-brand-700" size={36} />
        <h1 className="text-xl font-bold">{t('login')}</h1>
        <label className="block"><span className="label">{t('email')}</span>
          <input className="input mt-1" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block"><span className="label">{t('password')}</span>
          <input className="input mt-1" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button disabled={busy} className="btn btn-primary w-full">{t('login')}</button>
      </form>
    </div>
  )
}
