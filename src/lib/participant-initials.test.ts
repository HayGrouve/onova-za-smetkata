import { describe, expect, it } from 'vitest'
import { buildParticipantInitials } from './participant-initials'

describe('buildParticipantInitials', () => {
  it('uses first and last word initials', () => {
    expect(buildParticipantInitials({ a: 'Иван Петров', b: 'Мария' })).toEqual({
      a: 'ИП',
      b: 'М',
    })
  })

  it('disambiguates names that share a first letter', () => {
    expect(buildParticipantInitials({ a: 'test', b: 'test2' })).toEqual({
      a: 'TT',
      b: 'T2',
    })
    expect(buildParticipantInitials({ a: 'Иван', b: 'Ивана' })).toEqual({
      a: 'ИН',
      b: 'ИА',
    })
  })

  it('keeps distinct two-word initials untouched', () => {
    expect(
      buildParticipantInitials({ a: 'Иван Иванов', b: 'Иван Петров' }),
    ).toEqual({ a: 'ИИ', b: 'ИП' })
  })

  it('falls back to a numeric suffix for identical labels', () => {
    expect(buildParticipantInitials({ a: 'Ани', b: 'Ани', c: 'Ани' })).toEqual({
      a: 'АИ',
      b: 'А2',
      c: 'А3',
    })
  })

  it('never reuses initials that another participant already has', () => {
    expect(
      buildParticipantInitials({ a: 'test', b: 'test2', c: 'T 2' }),
    ).toEqual({ a: 'TT', b: 'T3', c: 'T2' })
  })

  it('handles empty or punctuation-only labels', () => {
    expect(buildParticipantInitials({ a: '  ', b: '„Боби“' })).toEqual({
      a: '?',
      b: 'Б',
    })
  })
})
