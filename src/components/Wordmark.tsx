export const BRAND_NAME = 'ITVTG Pickleball'

export function Wordmark({ className = '', size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={size} height={size}
        className="rounded-full object-cover ring-2 ring-gold" style={{ width: size, height: size }} />
      <span className="display text-lg">{BRAND_NAME}</span>
    </span>
  )
}
