import { useT } from '../lib/i18n'
import { absUrl, isValidSlug } from '../lib/paths'

export function SlugField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT()
  const bad = value !== '' && !isValidSlug(value)
  return (
    <label className="block">
      <span className="label">{t('shortLink')}</span>
      <div className="mt-1 flex items-center rounded-md border border-ink-200 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <span className="hidden shrink-0 pl-3 text-sm text-ink-500 sm:block">{absUrl('/')}</span>
        <input className="h-10 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm outline-none" value={value} maxLength={40}
          onChange={e => onChange(e.target.value.toLowerCase())} />
      </div>
      {bad && <span className="text-xs font-semibold text-live">{t('slugInvalid')}</span>}
    </label>
  )
}
