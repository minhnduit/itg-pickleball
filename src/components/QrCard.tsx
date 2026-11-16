import { QRCodeSVG } from 'qrcode.react'
import { BRAND_NAME } from './Wordmark'

export function QrCard({ eyebrow, title, url, subtitle, pin }: { eyebrow?: string; title: string; url: string; subtitle?: string; pin?: string | null }) {
  return (
    <div className="inline-block break-inside-avoid rounded-lg border border-ink-300 bg-white p-6 text-center">
      <div className="mb-2 flex items-center gap-2 text-left text-xs font-bold text-ink-500">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-8 w-8 rounded-full object-cover" />{BRAND_NAME}
      </div>
      {eyebrow && <div className="display text-sm text-brand-700">{eyebrow}</div>}
      <div className="mb-3 text-2xl font-extrabold">{title}</div>
      <QRCodeSVG value={url} size={220} className="mx-auto" />
      {subtitle && <div className="muted mt-3 text-sm">{subtitle}</div>}
      {pin && <div className="mt-4 rounded-md border border-dashed border-gold px-3 py-2 font-score text-3xl font-bold tracking-[0.3em]">{pin}</div>}
    </div>
  )
}
