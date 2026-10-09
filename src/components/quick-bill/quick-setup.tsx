import { useEffect, useState } from 'react'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CameraIcon,
  ImageIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  UsersIcon,
} from 'lucide-react'
import { ItemFormSheet } from '#/components/bills/item-form-sheet.tsx'
import { QuickCameraButton } from '#/components/quick-bill/quick-camera-button.tsx'
import {
  QuickPageHeader,
  QuickActionBar,
} from '#/components/quick-bill/quick-layout.tsx'
import {
  LeaderRow,
  Receipt,
  ReceiptHeader,
  ReceiptTotals,
  RestaurantTitle,
  Rule,
} from '#/components/receipt/paper.tsx'
import { SeatAvatar, useSeats } from '#/components/receipt/seats.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  QUICK_SCAN_STALE_MS,
  isQuickScanStale,
  isQuickScanUploadLive,
  quickScanPhotoUrl,
} from '#/hooks/use-quick-scan.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { editQuickBill, updateQuickBill } from '#/lib/quick-bill-storage.ts'
import type { StoredQuickBill } from '#/lib/quick-bill-storage.ts'
import { cn } from '#/lib/utils.ts'
import {
  QUICK_BILL_SEATS_MAX,
  addQuickBillLine,
  canRemoveLastQuickBillSeat,
  removeQuickBillLine,
  setQuickBillLineForEveryone,
  setQuickBillSeatCount,
  summarizeQuickBill,
  updateQuickBillLine,
} from '../../../shared/quick-bill.ts'
import type { QuickBill, QuickBillLine } from '../../../shared/quick-bill.ts'

const UPLOAD_CUT_OFF = 'Качването прекъсна. Снимайте бележката отново.'
const SCAN_TOO_SLOW = 'Бележката се чете твърде дълго. Снимайте я отново.'

/** Render again once a photo still on its way counts as stuck. */
function useStaleRerender(startedAt: number | null) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (startedAt === null) return
    const wait = startedAt + QUICK_SCAN_STALE_MS - Date.now()
    if (wait < 0) return
    const timer = window.setTimeout(() => setTick((n) => n + 1), wait + 50)
    return () => window.clearTimeout(timer)
  }, [startedAt])
}

/**
 * First screen: the photo is read while the Host says how many are at the
 * table, then the lines print in to be checked. „За всички“ marks the bread
 * and the water before the phone goes round.
 */
export function QuickSetup({
  stored,
  onStart,
  onCancel,
}: {
  stored: StoredQuickBill
  onStart: () => void
  onCancel: () => void
}) {
  const { bill, scan } = stored
  const [editing, setEditing] = useState<QuickBillLine | null>(null)
  const [adding, setAdding] = useState(false)
  const summary = summarizeQuickBill(bill)

  const inFlight =
    scan.phase === 'uploading' || scan.phase === 'reading' ? scan : null
  useStaleRerender(inFlight?.startedAt ?? null)
  const stale = isQuickScanStale(scan, Date.now())
  const cutOff =
    scan.phase === 'uploading' && !isQuickScanUploadLive(scan.attempt)
  const reading = inFlight !== null && !cutOff && !stale
  const failure =
    scan.phase === 'failed'
      ? scan.message
      : cutOff
        ? UPLOAD_CUT_OFF
        : stale
          ? SCAN_TOO_SLOW
          : null
  const photoUrl =
    scan.phase === 'uploading' || scan.phase === 'reading'
      ? quickScanPhotoUrl(scan.attempt)
      : null
  const canStart = !reading && bill.lines.length > 0

  /** Typing a line by hand, or going on with the lines there are, answers a failed read. */
  function settleScan() {
    if (failure)
      updateQuickBill((current) => ({ ...current, scan: { phase: 'read' } }))
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-3 pt-4 pb-40 sm:pt-8">
      <QuickPageHeader
        title="Бърза сметка"
        hint="Не се качва никъде — остава само на този телефон. Всеки отбелязва своето, виждате сумите и я затваряте."
      />

      <SeatCount bill={bill} />

      <Receipt className="mt-5">
        <ReceiptHeader
          date={bill.createdAt}
          title={
            <RestaurantTitle name={bill.restaurantName || 'Бърза сметка'} />
          }
        />
        <Rule />

        {reading ? (
          <div className="flex items-start gap-3 py-2" role="status">
            <div className="receipt-scan-image-active w-20 shrink-0 overflow-hidden border-2 border-dashed border-rule">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt=""
                  className="block h-24 w-full object-cover object-top"
                />
              ) : (
                <div className="skeleton-print h-24 w-full" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
              <p className="flex items-center gap-2 font-semibold">
                <Loader2Icon
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                Четем бележката
              </p>
              <p className="mt-1 text-ink-muted">
                Междувременно кажете колко сте. Редовете ще се отпечатат тук.
              </p>
            </div>
          </div>
        ) : (
          <>
            {failure ? (
              <div className="mb-3 space-y-3" role="alert">
                <p className="flex items-start gap-2 text-[12px] font-semibold">
                  <AlertTriangleIcon
                    className="mt-0.5 size-4 shrink-0 text-stamp"
                    strokeWidth={2}
                    aria-hidden
                  />
                  {failure}
                </p>
                <div className="flex flex-wrap gap-2">
                  <QuickCameraButton mode="retake" size="sm">
                    <CameraIcon aria-hidden />
                    Снимай отново
                  </QuickCameraButton>
                  <QuickCameraButton
                    mode="retake"
                    camera={false}
                    size="sm"
                    variant="outline"
                  >
                    <ImageIcon aria-hidden />
                    От галерията
                  </QuickCameraButton>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Или добавете редовете ръчно.
                </p>
              </div>
            ) : null}

            {bill.lines.length > 0 ? (
              <>
                <p className="pb-1 text-[11px] leading-relaxed text-ink-muted">
                  Докоснете ред, за да го поправите. „За всички“ го дели
                  поравно: хляб, вода, бутилка за масата.
                </p>
                <ul>
                  {bill.lines.map((line) => (
                    <SetupLine
                      key={line.id}
                      line={line}
                      onEdit={() => setEditing(line)}
                    />
                  ))}
                </ul>
              </>
            ) : !failure ? (
              <p className="py-4 text-center text-[12px] text-ink-muted">
                Не намерихме редове на снимката. Добавете ги ръчно.
              </p>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setAdding(true)}
            >
              <PlusIcon aria-hidden />
              Добави ред
            </Button>

            <Rule />
            <ReceiptTotals subtotalCents={summary.linesCents} tipCents={0}>
              {bill.receiptTotalCents !== null ? (
                <LeaderRow
                  className="text-ink-muted"
                  label="По бележката"
                  value={formatEur(bill.receiptTotalCents)}
                />
              ) : null}
            </ReceiptTotals>
            {summary.receiptMismatch ? (
              <p
                className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed font-semibold"
                role="status"
              >
                <AlertTriangleIcon
                  className="mt-0.5 size-3.5 shrink-0 text-stamp"
                  strokeWidth={2}
                  aria-hidden
                />
                Редовете дават {formatEur(summary.receiptMismatch.linesCents)},
                а бележката — {formatEur(summary.receiptMismatch.receiptCents)}.
                Проверете цените и бройките.
              </p>
            ) : null}
          </>
        )}
      </Receipt>

      <div className="mt-6 text-center">
        <Button type="button" variant="link" onClick={onCancel}>
          Откажи бързата сметка
        </Button>
      </div>

      <QuickActionBar>
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!canStart}
          onClick={() => {
            settleScan()
            onStart()
          }}
        >
          Подай телефона
          <ArrowRightIcon aria-hidden />
        </Button>
      </QuickActionBar>

      <ItemFormSheet
        open={editing !== null || adding}
        onOpenChange={(open) => {
          if (open) return
          setEditing(null)
          setAdding(false)
        }}
        item={editing ?? undefined}
        itemKey={editing?.id ?? 'new'}
        onSave={(data, changes) => {
          if (editing) {
            editQuickBill((b) => updateQuickBillLine(b, editing.id, changes))
          } else {
            settleScan()
            editQuickBill((b) => addQuickBillLine(b, data))
          }
          return Promise.resolve(true)
        }}
        onDelete={
          editing
            ? () => editQuickBill((b) => removeQuickBillLine(b, editing.id))
            : undefined
        }
      />
    </div>
  )
}

function SetupLine({
  line,
  onEdit,
}: {
  line: QuickBillLine
  onEdit: () => void
}) {
  return (
    <li className="-mx-2 flex items-center">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Поправи ${line.name}`}
        className="min-h-[60px] min-w-0 flex-1 px-2 py-2.5 text-left hover:bg-paper-2"
      >
        <span className="flex items-baseline">
          <span className="min-w-0 font-medium">{line.name}</span>
          <span className="leader" aria-hidden />
          <span className="shrink-0 font-semibold">
            {formatEur(line.unitPriceCents * line.quantity)}
          </span>
        </span>
        <span className="mt-1 block text-[11px] text-ink-muted">
          {line.quantity > 1
            ? `${line.quantity} × ${formatEur(line.unitPriceCents)}`
            : '1 бр.'}
        </span>
      </button>
      <button
        type="button"
        aria-pressed={line.forEveryone}
        onClick={() =>
          editQuickBill((b) =>
            setQuickBillLineForEveryone(b, line.id, !line.forEveryone),
          )
        }
        className={cn(
          'mr-2 ml-1 flex min-h-11 shrink-0 items-center gap-1 rounded-full border-2 px-2.5 text-[11px] font-semibold transition-colors',
          line.forEveryone
            ? 'border-ink bg-ink text-paper'
            : 'border-ink-faint text-ink-muted hover:border-ink hover:text-ink',
        )}
      >
        <UsersIcon className="size-3.5" strokeWidth={2} aria-hidden />
        За всички
      </button>
    </li>
  )
}

/** „Колко сте?“: seats are ready to go as „Човек 1…N“. */
function SeatCount({ bill }: { bill: QuickBill }) {
  const seats = useSeats()
  return (
    <section
      className="mt-5 flex items-center justify-between gap-3"
      aria-labelledby="quick-seat-count"
    >
      <div className="min-w-0">
        <h2 id="quick-seat-count" className="text-[15px] font-bold">
          Колко сте?
        </h2>
        <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
          {seats.map((seat) => (
            <SeatAvatar key={seat.id} seat={seat} size="xs" />
          ))}
        </div>
      </div>
      <div
        className="flex shrink-0 items-center rounded-full border-2 border-current"
        role="group"
        aria-label="Брой хора"
      >
        <button
          type="button"
          aria-label="Един човек по-малко"
          disabled={!canRemoveLastQuickBillSeat(bill)}
          onClick={() =>
            editQuickBill((b) => setQuickBillSeatCount(b, b.seats.length - 1))
          }
          className="grid size-11 place-items-center disabled:opacity-30"
        >
          <MinusIcon className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <span
          className="w-9 text-center font-display text-[20px] font-bold"
          aria-live="polite"
        >
          {seats.length}
        </span>
        <button
          type="button"
          aria-label="Още един човек"
          disabled={seats.length >= QUICK_BILL_SEATS_MAX}
          onClick={() =>
            editQuickBill((b) => setQuickBillSeatCount(b, b.seats.length + 1))
          }
          className="grid size-11 place-items-center disabled:opacity-30"
        >
          <PlusIcon className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </section>
  )
}
