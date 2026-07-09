import { describe, expect, it } from 'vitest'
import {
  BILL_DATE_MIN_MS,
  PERSON_NAME_MAX,
  RESTAURANT_NAME_MAX,
} from './constants'
import {
  billDateSchema,
  deviceIdSchema,
  groupNameSchema,
  nonNegativeCentsSchema,
  optionalNoteSchema,
  personNameSchema,
  positiveCentsSchema,
  quantityInputSchema,
  restaurantNameSchema,
} from './fields'

describe('personNameSchema', () => {
  it('accepts trimmed names', () => {
    expect(personNameSchema.safeParse('  Иван ').success).toBe(true)
  })

  it('rejects empty names', () => {
    expect(personNameSchema.safeParse('  ').success).toBe(false)
  })

  it('rejects names over max length', () => {
    expect(personNameSchema.safeParse('x'.repeat(PERSON_NAME_MAX + 1)).success).toBe(
      false,
    )
  })
})

describe('restaurantNameSchema', () => {
  it('allows empty when not required', () => {
    expect(restaurantNameSchema().safeParse('').success).toBe(true)
  })

  it('requires name when required option is set', () => {
    expect(restaurantNameSchema({ required: true }).safeParse('').success).toBe(
      false,
    )
  })

  it('rejects names over max length', () => {
    expect(
      restaurantNameSchema().safeParse('x'.repeat(RESTAURANT_NAME_MAX + 1))
        .success,
    ).toBe(false)
  })
})

describe('optionalNoteSchema', () => {
  it('returns undefined for blank notes', () => {
    const result = optionalNoteSchema().safeParse('   ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBeUndefined()
    }
  })

  it('returns trimmed note text', () => {
    const result = optionalNoteSchema().safeParse('  бележка  ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('бележка')
    }
  })
})

describe('quantityInputSchema', () => {
  it('parses string quantities', () => {
    const result = quantityInputSchema.safeParse('3')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(3)
    }
  })

  it('rejects zero quantity', () => {
    expect(quantityInputSchema.safeParse('0').success).toBe(false)
  })
})

describe('cents schemas', () => {
  it('accepts non-negative cents', () => {
    expect(nonNegativeCentsSchema().safeParse(0).success).toBe(true)
  })

  it('rejects negative cents', () => {
    expect(nonNegativeCentsSchema().safeParse(-1).success).toBe(false)
  })

  it('requires positive cents', () => {
    expect(positiveCentsSchema().safeParse(0).success).toBe(false)
    expect(positiveCentsSchema().safeParse(100).success).toBe(true)
  })
})

describe('billDateSchema', () => {
  it('accepts a valid date', () => {
    expect(billDateSchema.safeParse(Date.UTC(2024, 5, 1)).success).toBe(true)
  })

  it('rejects dates before 2000', () => {
    expect(billDateSchema.safeParse(BILL_DATE_MIN_MS - 1).success).toBe(false)
  })
})

describe('deviceIdSchema', () => {
  it('returns undefined for empty values', () => {
    const result = deviceIdSchema.safeParse(undefined)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBeUndefined()
    }
  })

  it('trims device ids', () => {
    const result = deviceIdSchema.safeParse('  device-1  ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('device-1')
    }
  })
})

describe('groupNameSchema', () => {
  it('requires a group name', () => {
    expect(groupNameSchema().safeParse('').success).toBe(false)
    expect(groupNameSchema().safeParse('Работа').success).toBe(true)
  })
})
