import { PAYMENT_NOTE_MAX } from './validation/constants'
import { parseEurInputStrict } from './validation/eur'
import { optionalNoteSchema, positiveCentsSchema } from './validation/fields'

export type PaymentAddFormInput = {
  amountInput: string
  note?: string
}

export type PaymentAddArgs = {
  amountCents: number
  note?: string
}

export type PaymentAddContext = {
  remainingCents: number
}

export type PaymentAddServerContext = {
  owedCents: number
  paidCents: number
}

export type PaymentAddData = {
  amountCents: number
  note?: string
}

const OVER_CAP_MESSAGE = 'Сумата надвишава дължимото.'
const paymentNoteSchema = () => optionalNoteSchema(PAYMENT_NOTE_MAX)

export function parsePaymentAmountInput(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string } {
  return parseEurInputStrict(value)
}

function validatePaymentAmountCents(
  amountCents: number,
):
  | { ok: true; amountCents: number }
  | { ok: false; message: string } {
  const parsed = positiveCentsSchema('Сумата').safeParse(amountCents)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Невалидна сума.',
    }
  }
  return { ok: true, amountCents: parsed.data }
}

function validatePaymentNote(
  note: string | undefined,
):
  | { ok: true; note?: string }
  | { ok: false; message: string } {
  if (note === undefined) {
    return { ok: true }
  }
  const parsed = paymentNoteSchema().safeParse(note)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Невалидна бележка',
    }
  }
  return { ok: true, note: parsed.data }
}

export function validatePaymentAddForm(
  input: PaymentAddFormInput,
  context: PaymentAddContext,
):
  | { ok: true; data: PaymentAddData }
  | { ok: false; message: string } {
  const parsedAmount = parsePaymentAmountInput(input.amountInput)
  if (!parsedAmount.ok) {
    return { ok: false, message: parsedAmount.message }
  }

  const validatedAmount = validatePaymentAmountCents(parsedAmount.cents)
  if (!validatedAmount.ok) {
    return { ok: false, message: validatedAmount.message }
  }

  if (validatedAmount.amountCents > context.remainingCents) {
    return { ok: false, message: OVER_CAP_MESSAGE }
  }

  const validatedNote = validatePaymentNote(input.note)
  if (!validatedNote.ok) {
    return { ok: false, message: validatedNote.message }
  }

  return {
    ok: true,
    data: {
      amountCents: validatedAmount.amountCents,
      ...(validatedNote.note !== undefined ? { note: validatedNote.note } : {}),
    },
  }
}

export function validatePaymentAdd(
  args: PaymentAddArgs,
  context: PaymentAddServerContext,
):
  | { ok: true; data: PaymentAddData }
  | { ok: false; message: string } {
  const validatedAmount = validatePaymentAmountCents(args.amountCents)
  if (!validatedAmount.ok) {
    return { ok: false, message: validatedAmount.message }
  }

  const validatedNote = validatePaymentNote(args.note)
  if (!validatedNote.ok) {
    return { ok: false, message: validatedNote.message }
  }

  if (context.paidCents + validatedAmount.amountCents > context.owedCents) {
    return { ok: false, message: OVER_CAP_MESSAGE }
  }

  return {
    ok: true,
    data: {
      amountCents: validatedAmount.amountCents,
      ...(validatedNote.note !== undefined ? { note: validatedNote.note } : {}),
    },
  }
}
