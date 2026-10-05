import { describe, expect, it } from 'vitest'
import { nextSyncedAuthName, resolveHostParticipantName } from './host-profile'

describe('resolveHostParticipantName', () => {
  it('uses Auth name for the Host seat', () => {
    expect(
      resolveHostParticipantName({
        authName: 'Tsvetomir Google',
      }),
    ).toBe('Tsvetomir Google')
  })

  it('trims Auth name', () => {
    expect(
      resolveHostParticipantName({
        authName: '  Иван Петров  ',
      }),
    ).toBe('Иван Петров')
  })

  it('keeps the Host seat within participant name bounds', () => {
    expect(
      resolveHostParticipantName({ authName: `Иван\u0007${'я'.repeat(80)}` }),
    ).toBe(`Иван${'я'.repeat(46)}`)
  })

  it('falls back to „домакин“ for an Auth name nobody could see', () => {
    expect(resolveHostParticipantName({ authName: '\u200b\u3164' })).toBe(
      'домакин',
    )
  })

  it('falls back to „домакин“ when Auth name is missing or blank', () => {
    expect(resolveHostParticipantName({})).toBe('домакин')
    expect(resolveHostParticipantName({ authName: null })).toBe('домакин')
    expect(resolveHostParticipantName({ authName: '  ' })).toBe('домакин')
  })
})

describe('nextSyncedAuthName', () => {
  it('returns the Clerk name when Convex has none', () => {
    expect(nextSyncedAuthName(undefined, 'Иван Петров')).toBe('Иван Петров')
  })

  it('returns undefined when the stored name already matches', () => {
    expect(nextSyncedAuthName('Иван Петров', 'Иван Петров')).toBeUndefined()
    expect(nextSyncedAuthName('  Иван Петров  ', 'Иван Петров')).toBeUndefined()
  })

  it('returns the Clerk name when it changed', () => {
    expect(nextSyncedAuthName('Старо', 'Ново')).toBe('Ново')
  })

  it('does not clear a stored name when Clerk omits one', () => {
    expect(nextSyncedAuthName('Иван', undefined)).toBeUndefined()
    expect(nextSyncedAuthName('Иван', '  ')).toBeUndefined()
  })
})
