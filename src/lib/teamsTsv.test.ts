import { expect, it } from 'vitest'
import { parseTeamsTsv } from './teamsTsv'

it('parses rows, skips header and blanks, reports errors', () => {
  const r = parseTeamsTsv('Team\tP1\tP2\tSeed\r\nAlpha\tAn\tBinh\t1\n\nBeta\tCuong\tDung\nBad\tOnly\n')
  expect(r.rows).toEqual([
    { name: 'Alpha', player1: 'An', player2: 'Binh', seed: 1 },
    { name: 'Beta', player1: 'Cuong', player2: 'Dung', seed: null },
  ])
  expect(r.errors).toEqual([{ line: 5, text: 'Bad\tOnly' }])
})
