const PALETTE = ['#8F1416', '#9A6A00', '#45373A', '#7A3E1D', '#2F5D50', '#5B3A6B', '#1F4E6B', '#6B5B1E']
const SIZES = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-sm', lg: 'h-14 w-14 text-xl' }

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => Array.from(w)[0] ?? '').join('').toLocaleUpperCase('vi')

const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.codePointAt(0)!) >>> 0, 7)

export function Avatar({ name, size = 'sm', placeholder = false }: { name: string; size?: keyof typeof SIZES; placeholder?: boolean }) {
  if (placeholder) return <span className={`inline-block shrink-0 rounded-full border border-dashed border-ink-300 ${SIZES[size]}`} />
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${SIZES[size]}`}
      style={{ background: PALETTE[hash(name) % PALETTE.length] }}>{initials(name)}</span>
  )
}
