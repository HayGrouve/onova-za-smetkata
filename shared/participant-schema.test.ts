import { describe, expect, it } from 'vitest'
import {
  participantNameKey,
  parseParticipantName,
  validateParticipantAdd,
} from './participant-schema'
import { BILL_PARTICIPANTS_MAX, PERSON_NAME_MAX } from './validation/constants'

describe('participantNameKey', () => {
  it('treats names that only differ in spacing or invisible marks as one', () => {
    const key = participantNameKey('Иван Петров')
    for (const lookalike of [
      'Иван  Петров',
      'Иван\u00a0Петров',
      'Иван Петров\u200b',
      'Иван \u200dПетров',
    ]) {
      expect(participantNameKey(lookalike)).toBe(key)
    }
    expect(participantNameKey('Йордан'.normalize('NFD'))).toBe(
      participantNameKey('Йордан'),
    )
  })

  it('normalizes case and trim', () => {
    expect(participantNameKey('  Иван ')).toBe('иван')
  })
})

describe('parseParticipantName', () => {
  it('accepts valid names', () => {
    const result = parseParticipantName('  Мария ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('Мария')
  })

  it('rejects empty names', () => {
    expect(parseParticipantName('  ').success).toBe(false)
  })

  it('rejects overlong names', () => {
    expect(parseParticipantName('x'.repeat(PERSON_NAME_MAX + 1)).success).toBe(
      false,
    )
  })
})

describe('validateParticipantAdd', () => {
  const baseContext = {
    existingNames: ['Иван'],
    participantCount: 1,
  }

  it('rejects duplicates case-insensitively', () => {
    const result = validateParticipantAdd({ name: 'иван' }, baseContext)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Този участник вече е на сметката')
    }
  })

  it('rejects when cap reached', () => {
    const result = validateParticipantAdd(
      { name: 'Петър' },
      { existingNames: [], participantCount: BILL_PARTICIPANTS_MAX },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Максимум 50 участника на сметка')
    }
  })

  it('accepts a new valid name', () => {
    const result = validateParticipantAdd({ name: 'Георги' }, baseContext)
    expect(result).toEqual({ ok: true, name: 'Георги' })
  })
})
