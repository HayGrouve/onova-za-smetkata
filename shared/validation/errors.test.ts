import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { firstZodIssueMessage, formatZodFieldErrors } from './errors'

describe('formatZodFieldErrors', () => {
  it('maps first issue per top-level field', () => {
    const schema = z.object({
      name: z.string().min(1, 'Името е задължително'),
      note: z.string().max(2, 'Бележката е твърде дълга'),
    })
    const result = schema.safeParse({ name: '', note: 'abc' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        formatZodFieldErrors(result.error, ['name', 'note'] as const),
      ).toEqual({
        name: 'Името е задължително',
        note: 'Бележката е твърде дълга',
      })
    }
  })

  it('ignores fields not in the allowlist', () => {
    const schema = z.object({
      hidden: z.string().min(1, 'Скрита грешка'),
    })
    const result = schema.safeParse({ hidden: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(formatZodFieldErrors(result.error, ['name'] as const)).toEqual({})
    }
  })
})

describe('firstZodIssueMessage', () => {
  it('returns the first issue message', () => {
    const error = z.string().min(1, 'Първа грешка').safeParse('')
    expect(error.success).toBe(false)
    if (!error.success) {
      expect(firstZodIssueMessage(error.error, 'Резервен')).toBe('Първа грешка')
    }
  })

  it('returns fallback when no issues', () => {
    const error = new z.ZodError([])
    expect(firstZodIssueMessage(error, 'Резервен')).toBe('Резервен')
  })
})
