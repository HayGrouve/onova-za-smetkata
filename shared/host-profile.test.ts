import { describe, expect, it } from 'vitest'
import {
  formatUsernameError,
  nextSyncedAuthName,
  parseUsername,
  resolveHostParticipantName,
} from './host-profile'
import { PERSON_NAME_MAX } from './validation/constants'

describe('parseUsername', () => {
  it('accepts a valid Username and trims', () => {
    const result = parseUsername('  Цветомир ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('Цветомир')
  })

  it('treats empty and whitespace as unset', () => {
    expect(parseUsername('')).toEqual({ success: true, data: undefined })
    expect(parseUsername('   ')).toEqual({ success: true, data: undefined })
  })

  it('rejects overlong Username', () => {
    const result = parseUsername('x'.repeat(PERSON_NAME_MAX + 1))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(formatUsernameError(result.error)).toContain(
        String(PERSON_NAME_MAX),
      )
    }
  })

  it('rejects control characters like Participant names', () => {
    expect(parseUsername('Ив\u0001ан').success).toBe(false)
  })
})

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
