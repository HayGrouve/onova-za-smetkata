import { z } from 'zod'
import {
  BILL_DATE_MAX_FUTURE_MS,
  BILL_DATE_MIN_MS,
  DEVICE_ID_MAX,
  EUR_CENTS_MAX,
  GROUP_NAME_MAX,
  ITEM_NAME_MAX,
  NOTE_MAX,
  PERSON_NAME_MAX,
  QUANTITY_MAX,
  RESTAURANT_NAME_MAX,
} from './constants'

// eslint-disable-next-line no-control-regex -- reject control characters in user-facing names
const CONTROL_CHAR_PATTERN = /[\x00-\x1f]/

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Името не може да е празно')
  .max(PERSON_NAME_MAX, `Името може да е до ${PERSON_NAME_MAX} символа`)
  .refine(
    (value) => !CONTROL_CHAR_PATTERN.test(value),
    'Името съдържа невалидни символи',
  )

export function groupNameSchema() {
  return z
    .string()
    .trim()
    .min(1, 'Името на групата е задължително')
    .max(
      GROUP_NAME_MAX,
      `Името на групата може да е до ${GROUP_NAME_MAX} символа`,
    )
}

export function restaurantNameSchema(options: { required?: boolean } = {}) {
  const base = z
    .string()
    .trim()
    .max(
      RESTAURANT_NAME_MAX,
      `Името може да е до ${RESTAURANT_NAME_MAX} символа`,
    )

  if (options.required) {
    return base.min(1, 'Въведете име на ресторант.')
  }

  return base
}

export const itemNameSchema = z
  .string()
  .trim()
  .min(1, 'Наименованието не може да е празно')
  .max(ITEM_NAME_MAX, `Наименованието може да е до ${ITEM_NAME_MAX} символа`)

export function optionalNoteSchema(max = NOTE_MAX) {
  return z
    .string()
    .superRefine((raw, context) => {
      const trimmed = raw.trim()
      if (trimmed.length > max) {
        context.addIssue({
          code: 'custom',
          message: `Бележката може да е до ${max} символа`,
        })
      }
    })
    .transform((raw) => {
      const trimmed = raw.trim()
      return trimmed.length === 0 ? undefined : trimmed
    })
}

export const quantityInputSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (typeof value === 'number') return value
    const trimmed = value.trim()
    if (!trimmed) return Number.NaN
    return Number.parseInt(trimmed, 10)
  })
  .refine(
    (value) => Number.isInteger(value) && value >= 1,
    'Количеството трябва да е поне 1.',
  )
  .refine((value) => value <= QUANTITY_MAX, 'Количеството е твърде голямо.')

export function nonNegativeCentsSchema(label = 'Сумата') {
  return z
    .number()
    .int(`${label} трябва да е цяло число.`)
    .min(0, `${label} трябва да е ≥ 0.`)
    .max(EUR_CENTS_MAX, 'Невалидна сума.')
}

export function positiveCentsSchema(label = 'Сумата') {
  return z
    .number()
    .int(`${label} трябва да е цяло число.`)
    .min(1, `${label} трябва да е положителна.`)
    .max(EUR_CENTS_MAX, 'Невалидна сума.')
}

export const billDateSchema = z
  .number()
  .int('Невалидна дата.')
  .refine((value) => value >= BILL_DATE_MIN_MS, 'Невалидна дата.')
  .refine(
    (value) => value <= Date.now() + BILL_DATE_MAX_FUTURE_MS,
    'Невалидна дата.',
  )

export const deviceIdSchema = z
  .union([z.string(), z.undefined()])
  .transform((value) => (value ?? '').trim())
  .refine(
    (value) => value.length <= DEVICE_ID_MAX,
    `Идентификаторът може да е до ${DEVICE_ID_MAX} символа`,
  )
  .transform((value) => (value.length === 0 ? undefined : value))
