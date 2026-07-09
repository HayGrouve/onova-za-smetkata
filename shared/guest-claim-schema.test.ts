import { describe, expect, it } from 'vitest'
import {
  buildClaimActorKey,
  parseGuestClaimInput,
} from './guest-claim-schema'
import { DEVICE_ID_MAX } from './validation/constants'

describe('parseGuestClaimInput', () => {
  it('returns undefined deviceId when omitted or blank', () => {
    expect(parseGuestClaimInput({})).toEqual({ ok: true, deviceId: undefined })
    expect(parseGuestClaimInput({ deviceId: '  ' })).toEqual({
      ok: true,
      deviceId: undefined,
    })
  })

  it('trims valid deviceId', () => {
    expect(parseGuestClaimInput({ deviceId: '  abc  ' })).toEqual({
      ok: true,
      deviceId: 'abc',
    })
  })

  it('accepts max-length deviceId', () => {
    const id = 'x'.repeat(DEVICE_ID_MAX)
    expect(parseGuestClaimInput({ deviceId: id })).toEqual({
      ok: true,
      deviceId: id,
    })
  })

  it('rejects overlong deviceId instead of truncating', () => {
    const result = parseGuestClaimInput({
      deviceId: 'x'.repeat(DEVICE_ID_MAX + 1),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('64')
    }
  })
})

describe('buildClaimActorKey', () => {
  it('uses device prefix when deviceId present', () => {
    expect(buildClaimActorKey('token-uuid', 'dev-1')).toBe('device:dev-1')
  })

  it('falls back to token prefix when deviceId absent', () => {
    expect(buildClaimActorKey('0123456789abcdef0123456789abcdef', undefined)).toBe(
      'token:0123456789abcdef0123456789abcdef',
    )
  })
})
