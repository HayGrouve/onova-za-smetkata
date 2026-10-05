import { isQuickBillExpired, parseQuickBill } from '../../shared/quick-bill.ts'
import type { QuickBill, QuickBillResult } from '../../shared/quick-bill.ts'

/**
 * The quick bill lives on this phone only: one at a time, in localStorage,
 * gone after a while (`QUICK_BILL_TTL_MS`) or when the Host closes it.
 */
export const QUICK_BILL_STORAGE_KEY = 'quick-bill'

/** How far the receipt photo got on its way to lines. */
export type QuickScanState =
  | { phase: 'uploading'; attempt: string; startedAt: number }
  | { phase: 'reading'; attempt: string; startedAt: number; scanId: string }
  | { phase: 'failed'; message: string }
  | { phase: 'read' }

export interface StoredQuickBill {
  bill: QuickBill
  scan: QuickScanState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseScan(value: unknown): QuickScanState | null {
  if (!isRecord(value)) return null
  const { phase, attempt, startedAt, scanId, message } = value
  if (phase === 'read') return { phase }
  if (phase === 'failed' && typeof message === 'string') {
    return { phase, message }
  }
  if (typeof attempt !== 'string' || typeof startedAt !== 'number') return null
  if (phase === 'uploading') return { phase, attempt, startedAt }
  if (phase === 'reading' && typeof scanId === 'string') {
    return { phase, attempt, startedAt, scanId }
  }
  return null
}

function parseStored(raw: string | null): StoredQuickBill | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value)) return null
    const bill = parseQuickBill(value.bill)
    const scan = parseScan(value.scan)
    return bill && scan ? { bill, scan } : null
  } catch {
    return null
  }
}

const listeners = new Set<() => void>()
let cached: { raw: string | null; value: StoredQuickBill | null } | null = null
/** Set while storage refuses writes: the quick bill lives on until a reload. */
let unsaved: { value: StoredQuickBill | null } | null = null

/** The quick bill on this phone, unless it expired. Same object until it changes. */
export function readQuickBill(
  now: number = Date.now(),
): StoredQuickBill | null {
  if (typeof localStorage === 'undefined') return null
  let value: StoredQuickBill | null
  if (unsaved) {
    value = unsaved.value
  } else {
    const raw = localStorage.getItem(QUICK_BILL_STORAGE_KEY)
    if (cached?.raw !== raw) cached = { raw, value: parseStored(raw) }
    value = cached.value
  }
  return value && !isQuickBillExpired(value.bill, now) ? value : null
}

/** Replace the quick bill (null closes it) and tell every reader. */
export function writeQuickBill(next: StoredQuickBill | null): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (next) {
      localStorage.setItem(QUICK_BILL_STORAGE_KEY, JSON.stringify(next))
    } else {
      localStorage.removeItem(QUICK_BILL_STORAGE_KEY)
    }
    unsaved = null
  } catch {
    unsaved = { value: next }
  }
  for (const listener of listeners) listener()
}

/** Change the current quick bill; touching it keeps it from expiring. */
export function updateQuickBill(
  change: (current: StoredQuickBill) => StoredQuickBill,
  now: number = Date.now(),
): void {
  const current = readQuickBill(now)
  if (!current) {
    // Expired while on screen: let every reader drop the stale view.
    for (const listener of listeners) listener()
    return
  }
  const next = change(current)
  if (next === current) return
  writeQuickBill({ ...next, bill: { ...next.bill, updatedAt: now } })
}

/**
 * Apply a quick bill rule to the stored quick bill, on its current state (two
 * taps between renders must not overwrite each other). A refusal changes
 * nothing and comes back with its message.
 */
export function editQuickBill(
  change: (bill: QuickBill) => QuickBill | QuickBillResult,
): { ok: true } | { ok: false; message: string } {
  let outcome: { ok: true } | { ok: false; message: string } = {
    ok: false,
    message: 'Бързата сметка изтече.',
  }
  updateQuickBill((current) => {
    outcome = { ok: true }
    const next = change(current.bill)
    if (!('ok' in next)) return { ...current, bill: next }
    if (!next.ok) {
      outcome = next
      return current
    }
    return { ...current, bill: next.bill }
  })
  return outcome
}

export function subscribeQuickBill(listener: () => void): () => void {
  listeners.add(listener)
  // Another tab of the app may close or change it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUICK_BILL_STORAGE_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
