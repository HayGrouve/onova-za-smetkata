import { validateItemAddArgs, validateItemAddForm } from './item-schema'
import type {
  ItemAddArgs,
  ItemAddData,
  ItemAddFormInput,
  ItemField,
} from './item-schema'

export type ReceiptImportRowInput = ItemAddFormInput

export type ReceiptImportRowWithSelection = ReceiptImportRowInput & {
  checked: boolean
}

export type ReceiptImportRowErrors = Partial<Record<ItemField, string>>

export function validateReceiptImportRow(
  input: ReceiptImportRowInput,
):
  | { ok: true; data: ItemAddData }
  | { ok: false; fieldErrors: ReceiptImportRowErrors } {
  return validateItemAddForm(input)
}

export function validateReceiptImportSelection(
  rows: ReceiptImportRowWithSelection[],
):
  | { ok: true; data: ItemAddData[]; checkedIndexes: number[] }
  | {
      ok: false
      rowErrors: Record<number, ReceiptImportRowErrors>
      checkedCount: number
    } {
  const data: ItemAddData[] = []
  const checkedIndexes: number[] = []
  const rowErrors: Record<number, ReceiptImportRowErrors> = {}
  let checkedCount = 0

  for (const [index, row] of rows.entries()) {
    if (!row.checked) continue
    checkedCount += 1

    const validated = validateReceiptImportRow({
      name: row.name,
      priceInput: row.priceInput,
      quantityInput: row.quantityInput,
    })

    if (!validated.ok) {
      rowErrors[index] = validated.fieldErrors
      continue
    }

    checkedIndexes.push(index)
    data.push(validated.data)
  }

  if (Object.keys(rowErrors).length > 0) {
    return { ok: false, rowErrors, checkedCount }
  }

  return { ok: true, data, checkedIndexes }
}

export function validateReceiptImportItems(
  items: ItemAddArgs[],
):
  | { ok: true; data: ItemAddData[] }
  | { ok: false; message: string; index?: number } {
  const data: ItemAddData[] = []

  for (const [index, item] of items.entries()) {
    const validated = validateItemAddArgs(item)
    if (!validated.ok) {
      return {
        ok: false,
        message: `Артикул ${index + 1}: ${validated.message}`,
        index,
      }
    }
    data.push(validated.data)
  }

  return { ok: true, data }
}
