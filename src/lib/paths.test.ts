import { describe, expect, it } from 'vitest'
import { courtKey, isUuid, isValidSlug, slugify } from './paths'

describe('slugify', () => {
  it('handles accents, đ and punctuation', () => {
    expect(slugify('ITVTG Pickleball Season 3')).toBe('itvtg-pickleball-season-3')
    expect(slugify('Sân 1')).toBe('san-1')
    expect(slugify('Đội Đặc Biệt!!')).toBe('doi-dac-biet')
  })
  it('caps at 40 chars without trailing dash', () => {
    const s = slugify('a'.repeat(39) + ' bbb')
    expect(s.length).toBeLessThanOrEqual(40)
    expect(s.endsWith('-')).toBe(false)
  })
})
describe('validators', () => {
  it('isValidSlug', () => {
    expect(isValidSlug('lsp-open')).toBe(true)
    expect(isValidSlug('Bad Slug!')).toBe(false)
    expect(isValidSlug('a')).toBe(false)
  })
  it('isUuid', () => {
    expect(isUuid('11111111-1111-1111-1111-111111111111')).toBe(true)
    expect(isUuid('lsp-open')).toBe(false)
  })
})

describe('reserved and court keys', () => {
  it('rejects reserved slugs', () => {
    for (const r of ['login', 'ref', 'admin', 'tv', 'api']) expect(isValidSlug(r)).toBe(false)
  })
  it('court key falls back to id on empty, reserved or duplicate', () => {
    const cs = [{ id: 'a', name: 'Sân 1' }, { id: 'b', name: 'San 1' }, { id: 'c', name: 'TV' }, { id: 'd', name: '!!' }, { id: 'e', name: 'Sân 2' }]
    expect(courtKey(cs[0], cs)).toBe('a')
    expect(courtKey(cs[2], cs)).toBe('c')
    expect(courtKey(cs[3], cs)).toBe('d')
    expect(courtKey(cs[4], cs)).toBe('san-2')
  })
})
