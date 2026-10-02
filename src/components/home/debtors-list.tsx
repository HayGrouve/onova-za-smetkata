import { Link } from '@tanstack/react-router'
import { BellRingIcon, ChevronDownIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SeatAvatar } from '#/components/receipt/seats.tsx'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { buildBillJoinUrl, resolveAppOrigin } from '#/lib/bill-join-url.ts'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { buildParticipantInitials } from '#/lib/participant-initials.ts'
import { buildPaymentReminder } from '#/lib/payment-reminder.ts'
import { cn } from '#/lib/utils.ts'
import type { Debtor, DebtorBill } from '../../../shared/bill-collection.ts'

const shortDate = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'short',
})

export interface DebtorsListProps {
  debtors: Debtor[]
}

/** „Кой дължи“: Guests with Outstanding, merged by name across open bills. */
export function DebtorsList({ debtors }: DebtorsListProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const initials = useMemo(
    () =>
      buildParticipantInitials(
        Object.fromEntries(debtors.map((debtor) => [debtor.key, debtor.name])),
      ),
    [debtors],
  )

  if (debtors.length === 0) return null
  const merged = debtors.some((debtor) => debtor.bills.length > 1)

  return (
    <section
      aria-labelledby="home-debtors-title"
      className="flex flex-col gap-2"
    >
      <h2 id="home-debtors-title" className="text-[15px] font-bold">
        Кой дължи
      </h2>
      <div className="paper-shadow">
        <ul className="paper paper-edge thermal px-3">
          {debtors.map((debtor, index) => {
            const expanded = expandedKey === debtor.key
            const detailsId = `home-debtor-${index}`
            return (
              <li
                key={debtor.key}
                className="[&+&]:border-t-2 [&+&]:border-dashed [&+&]:border-rule"
              >
                <div className="flex items-center gap-2 py-2">
                  <button
                    type="button"
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={expanded}
                    aria-controls={detailsId}
                    onClick={() => setExpandedKey(expanded ? null : debtor.key)}
                  >
                    <SeatAvatar
                      seat={{
                        initials: initials[debtor.key] ?? '?',
                        hue: index % 5,
                      }}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {debtor.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-muted">
                        {debtor.bills.length === 1
                          ? debtor.bills[0].restaurantName.trim() || 'Без име'
                          : `в ${debtor.bills.length} сметки`}
                      </span>
                    </span>
                    <span className="shrink-0 font-display text-[14px] font-bold">
                      {formatEur(debtor.outstandingCents)}
                    </span>
                    <ChevronDownIcon
                      className={cn(
                        'size-4 shrink-0 text-ink-muted transition-transform motion-reduce:transition-none',
                        expanded && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                  <RemindButton debtor={debtor} />
                </div>
                {expanded ? (
                  <ul
                    id={detailsId}
                    className="mb-2 border-l-[3px] border-ink bg-paper-2 px-3 py-1"
                  >
                    {debtor.bills.map((bill) => (
                      <li key={bill.billId}>
                        <Link
                          to="/bills/$billId"
                          params={{ billId: bill.billId }}
                          search={{ step: 4 }}
                          className="flex min-h-11 items-baseline gap-2 py-2 text-[12px] text-ink hover:underline"
                        >
                          <span className="min-w-0 truncate">
                            {bill.restaurantName.trim() || 'Без име'},{' '}
                            {shortDate.format(new Date(bill.date))}
                          </span>
                          <span className="leader" aria-hidden />
                          <span className="money shrink-0">
                            {formatEur(bill.outstandingCents)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
      {merged ? (
        <p className="text-[11px] text-on-table-muted">
          Хората с еднакво име в различни сметки са обединени.
        </p>
      ) : null}
    </section>
  )
}

function RemindButton({ debtor }: { debtor: Debtor }) {
  async function handleRemind() {
    const origin = resolveAppOrigin(window.location.origin)
    const joinUrlFor = (bill: DebtorBill) =>
      bill.shareToken && origin
        ? buildBillJoinUrl(bill.billId, origin, bill.shareToken)
        : undefined
    const text = buildPaymentReminder(debtor, joinUrlFor)

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }
    if (await copyToClipboard(text)) {
      toast.success('Напомнянето е копирано. Поставете го в чата.')
    } else {
      toast.error('Неуспешно копиране')
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="shrink-0"
      aria-label={`Напомни на ${debtor.name}`}
      onClick={() => void handleRemind()}
    >
      <BellRingIcon className={ICON.button} aria-hidden />
      Напомни
    </Button>
  )
}
