export interface TsvTeam { name: string; player1: string; player2: string; seed: number | null }

export function parseTeamsTsv(text: string): { rows: TsvTeam[]; errors: { line: number; text: string }[] } {
  const rows: TsvTeam[] = []
  const errors: { line: number; text: string }[] = []
  text.split(/\r?\n/).forEach((raw, idx) => {
    if (!raw.trim()) return
    const c = raw.split('\t').map(s => s.trim())
    if (idx === 0 && c[3] && Number.isNaN(Number(c[3]))) return // header
    const seed = c[3] ? Number(c[3]) : null
    if (!c[0] || !c[1] || !c[2] || (seed !== null && !Number.isInteger(seed))) {
      errors.push({ line: idx + 1, text: raw })
      return
    }
    rows.push({ name: c[0], player1: c[1], player2: c[2], seed })
  })
  return { rows, errors }
}
