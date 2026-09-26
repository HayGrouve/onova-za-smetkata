import { Link } from '@tanstack/react-router'
import { BellRingIcon, ChevronDownIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
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
      <h2 id="home-debtors-title" className="text-base font-semibold">
        Кой дължи
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {debtors.map((debtor, index) => {
          const expanded = expandedKey === debtor.key
          const detailsId = `home-debtor-${index}`
          return (
            <li key={debtor.key}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  className="tap-feedback flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-expanded={expanded}
                  aria-controls={detailsId}
                  onClick={() => setExpandedKey(expanded ? null : debtor.key)}
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold"
                    aria-hidden
                  >
                    {initials[debtor.key]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {debtor.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {debtor.bills.length === 1
                        ? debtor.bills[0].restaurantName.trim() || 'Без име'
                        : `в ${debtor.bills.length} сметки`}
                    </span>
                  </span>
                  <span className="money shrink-0 font-semibold">
                    {formatEur(debtor.outstandingCents)}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
                      expanded && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                <RemindButton debtor={debtor} />
              </div>
              {expanded ? (
                <ul id={detailsId} className="border-t bg-muted/30 px-3 py-1">
                  {debtor.bills.map((bill) => (
                    <li key={bill.billId}>
                      <Link
                        to="/bills/$billId"
                        params={{ billId: bill.billId }}
                        search={{ step: 4 }}
                        className="flex items-center justify-between gap-2 py-2 text-sm hover:underline"
                      >
                        <span className="min-w-0 truncate">
                          {bill.restaurantName.trim() || 'Без име'} ·{' '}
                          {shortDate.format(new Date(bill.date))}
                        </span>
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
      {merged ? (
        <p className="text-xs text-muted-foreground">
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
      toast.success('Напомнянето е копирано — поставете го в чата')
    } else {
      toast.error('Неуспешно копиране')
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 shrink-0"
      aria-label={`Напомни на ${debtor.name}`}
      onClick={() => void handleRemind()}
    >
      <BellRingIcon className={ICON.button} aria-hidden />
      Напомни
    </Button>
  )
}
