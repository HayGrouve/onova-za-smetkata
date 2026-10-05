import { toast } from 'sonner'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CopyIcon,
  Share2Icon,
} from 'lucide-react'
import {
  QuickActionBar,
  QuickPageHeader,
} from '#/components/quick-bill/quick-layout.tsx'
import {
  LeaderRow,
  Receipt,
  ReceiptHeader,
  ReceiptTotals,
  RestaurantTitle,
  Rule,
} from '#/components/receipt/paper.tsx'
import { SeatAvatar, useSeatLookup } from '#/components/receipt/seats.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import { Label } from '#/components/ui/label.tsx'
import { shareOrCopyText } from '#/lib/bill-share.ts'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { editQuickBill } from '#/lib/quick-bill-storage.ts'
import { formatQuickBillShareText } from '#/lib/quick-bill-share.ts'
import { cn } from '#/lib/utils.ts'
import {
  CASH_ROUNDING_CENTS,
  splitQuickBillLeftovers,
  summarizeQuickBill,
} from '../../../shared/quick-bill.ts'
import type { QuickBill } from '../../../shared/quick-bill.ts'
import { TIP_PRESETS } from '../../../shared/tip-calculations.ts'

/**
 * Everybody's total, for information only: people pay the Host in cash or
 * by transfer however they like. Sending the amounts is the only record.
 */
export function QuickSummary({
  bill,
  labels,
  onBackToSeats,
  onClose,
}: {
  bill: QuickBill
  labels: Record<string, string>
  onBackToSeats: () => void
  onClose: () => void
}) {
  const seatOf = useSeatLookup()
  const summary = summarizeQuickBill(bill)
  const shareText = () => formatQuickBillShareText(bill, summary)

  async function share() {
    try {
      const result = await shareOrCopyText(shareText(), 'Бърза сметка')
      if (result === 'copied') toast.success('Сумите са копирани')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      toast.error('Неуспешно изпращане. Опитайте „Копирай“.')
    }
  }

  async function copy() {
    if (await copyToClipboard(shareText())) {
      toast.success('Сумите са копирани')
    } else {
      toast.error('Неуспешно копиране')
    }
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-3 pt-4 pb-44 sm:pt-8">
      <QuickPageHeader
        title="Обобщение"
        hint="Само за сведение: всеки си плаща, както му е удобно."
      />

      {summary.unassignedCents > 0 ? (
        <div
          className="paper stub thermal mt-5 px-4 py-3 text-ink"
          role="status"
        >
          <p className="flex items-start gap-2 text-[13px] font-semibold">
            <AlertTriangleIcon
              className="mt-0.5 size-4 shrink-0 text-stamp"
              strokeWidth={2}
              aria-hidden
            />
            Неразпределено: {summary.unassignedUnits} бр.,{' '}
            {formatEur(summary.unassignedCents)}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            Никой не ги е отбелязал. Някой забрави ли хляба?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => editQuickBill(splitQuickBillLeftovers)}
            >
              Раздели по равно
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onBackToSeats}
            >
              Върни телефона
            </Button>
          </div>
        </div>
      ) : null}

      <Receipt className="mt-5">
        <ReceiptHeader
          date={bill.createdAt}
          title={
            <RestaurantTitle name={bill.restaurantName || 'Бърза сметка'} />
          }
        />
        <Rule />
        <ul className="space-y-0.5" aria-label="Кой колко дава">
          {summary.seats.map((total) => {
            const seat = seatOf(total.id)
            const rounded = total.amountCents !== total.shareCents
            return (
              <li
                key={total.id}
                className="flex min-h-12 list-none items-center gap-3"
              >
                {seat ? <SeatAvatar seat={seat} size="sm" /> : null}
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {labels[total.id] ?? total.label}
                </span>
                <span className="shrink-0 text-right leading-tight">
                  <span
                    className={cn(
                      'block font-display text-[18px] font-bold',
                      total.amountCents === 0 && 'text-ink-muted',
                    )}
                    data-testid={`quick-summary-amount-${total.id}`}
                  >
                    {formatEur(total.amountCents)}
                  </span>
                  {rounded ? (
                    <span className="block text-[10px] text-ink-muted">
                      точно {formatEur(total.shareCents)}
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
        <Rule />

        <div className="space-y-3">
          <div>
            <p id="quick-tip" className="mb-1.5 text-[12px] font-semibold">
              Бакшиш, разделен поравно
            </p>
            <div
              className="grid grid-cols-4 gap-1.5"
              role="group"
              aria-labelledby="quick-tip"
            >
              {TIP_PRESETS.map((percent) => (
                <Button
                  key={percent}
                  type="button"
                  size="sm"
                  variant={
                    bill.tipPercent === percent ? 'secondary' : 'outline'
                  }
                  aria-pressed={bill.tipPercent === percent}
                  onClick={() =>
                    editQuickBill((b) => ({ ...b, tipPercent: percent }))
                  }
                >
                  {percent}%
                </Button>
              ))}
            </div>
          </div>
          <div className="flex min-h-11 items-center gap-2.5">
            <Checkbox
              id="quick-round"
              checked={bill.roundForCash}
              onCheckedChange={(checked) =>
                editQuickBill((b) => ({ ...b, roundForCash: checked === true }))
              }
            />
            <Label htmlFor="quick-round" className="text-[12px] font-normal">
              Закръгли всяка сума до {formatEur(CASH_ROUNDING_CENTS)} за плащане
              в брой
            </Label>
          </div>
        </div>
        <Rule />

        <ReceiptTotals
          subtotalCents={summary.linesCents}
          tipCents={summary.tipCents}
        >
          {summary.unassignedCents > 0 ? (
            <LeaderRow
              className="text-ink-muted"
              label="От тях неразпределени"
              value={formatEur(summary.unassignedCents)}
            />
          ) : null}
        </ReceiptTotals>
        {bill.roundForCash ? (
          <LeaderRow
            className="mt-1 text-[12px] text-ink-muted"
            label="След закръгляне събирате"
            value={formatEur(summary.amountsTotalCents)}
          />
        ) : null}
      </Receipt>

      <div className="mt-6 flex flex-col items-center gap-2">
        <Button type="button" variant="link" onClick={onBackToSeats}>
          <ArrowLeftIcon aria-hidden />
          Чий ред е?
        </Button>
        <Button
          type="button"
          variant="link"
          className="text-destructive"
          onClick={onClose}
        >
          Затвори бързата сметка
        </Button>
      </div>

      <QuickActionBar>
        <div className="flex gap-2">
          <Button
            type="button"
            size="lg"
            className="min-w-0 flex-1"
            onClick={() => void share()}
          >
            <Share2Icon aria-hidden />
            Изпрати сумите
          </Button>
          <Button
            type="button"
            size="icon-lg"
            variant="secondary"
            aria-label="Копирай сумите"
            onClick={() => void copy()}
          >
            <CopyIcon aria-hidden />
          </Button>
        </div>
      </QuickActionBar>
    </div>
  )
}
