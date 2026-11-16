export function getDeviceId(): string {
  let id = localStorage.getItem('plc_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('plc_device_id', id)
  }
  return id
}

export interface RefSession {
  key: string; court_id: string; court_name: string; tournament_id: string; expires_at: string
}

export function clearRefSession() { localStorage.removeItem('plc_ref') }
export function setRefSession(s: RefSession) { localStorage.setItem('plc_ref', JSON.stringify(s)) }
export function getRefSession(): RefSession | null {
  try {
    const raw = localStorage.getItem('plc_ref')
    if (!raw) return null
    const s = JSON.parse(raw) as RefSession
    if (new Date(s.expires_at).getTime() < Date.now()) { clearRefSession(); return null }
    return s
  } catch { clearRefSession(); return null }
}
