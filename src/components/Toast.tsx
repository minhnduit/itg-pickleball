import { friendlyError } from '../lib/errors'
import { isDictValue, useT } from '../lib/i18n'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Toast = { id: number; msg: string; kind: 'error' | 'info' }
const Ctx = createContext<{ error: (m: string) => void; info: (m: string) => void }>({ error: () => {}, info: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((msg: string, kind: Toast['kind']) => {
    const id = Date.now() + Math.random()
    setItems(x => [...x, { id, msg, kind }])
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 5000)
  }, [])
  const api = { error: (m: string) => push(isDictValue(m) ? m : friendlyError(m, t), 'error'), info: (m: string) => push(m, 'info') }
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-20 left-2 right-2 z-50 flex flex-col items-center gap-2 sm:bottom-4">
        {items.map(i => (
          <div key={i.id} role="status" className={`pointer-events-auto max-w-md rounded-md border-l-[3px] bg-ink-900 px-4 py-3 text-sm text-white shadow-lg ${i.kind === 'error' ? 'border-live' : 'border-brand-500'}`}>
            {i.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
