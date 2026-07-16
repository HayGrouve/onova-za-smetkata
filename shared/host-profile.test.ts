import { describe, expect, it } from 'vitest'
import {
  formatUsernameError,
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
  it('prefers Username over Auth name', () => {
    expect(
      resolveHostParticipantName({
        username: 'Цветомир',
        authName: 'Tsvetomir Google',
      }),
    ).toBe('Цветомир')
  })

  it('falls back to Auth name when Username is unset', () => {
    expect(
      resolveHostParticipantName({
        username: undefined,
        authName: 'Tsvetomir Google',
      }),
    ).toBe('Tsvetomir Google')
  })

  it('treats blank Username as unset and uses Auth name', () => {
    expect(
      resolveHostParticipantName({
        username: '   ',
        authName: 'Tsvetomir Google',
      }),
    ).toBe('Tsvetomir Google')
  })

  it('falls back to „домакин“ when Username and Auth name are missing', () => {
    expect(resolveHostParticipantName({})).toBe('домакин')
    expect(resolveHostParticipantName({ username: null, authName: '  ' })).toBe(
      'домакин',
    )
  })
})
