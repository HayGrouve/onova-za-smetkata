/** PROTOTYPE — Direction A: read-only view of the sample bills on Home. */
import { ChevronLeftIcon, LockIcon } from 'lucide-react'
import { HOME_BILLS } from '../../mock/data.ts'
import {
  Avatar,
  Btn,
  Group,
  GroupLabel,
  IconBtn,
  Money,
  Pill,
  STROKE,
  shortDate,
} from '../ui.tsx'
import { statusPill } from './shared.tsx'

export function StaticBill({
  id,
  pane,
  onBack,
  onOpenLive,
}: {
  id: string
  pane: boolean
  onBack: () => void
  onOpenLive: () => void
}) {
  const b = HOME_BILLS.find((x) => x._id === id)
  if (!b) return null
  const status =
    b.status === 'final' ? 'final' : b.guestCount > 0 ? 'collecting' : 'draft'
  const pill = statusPill(status)
  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-1 bg-(--a-bg) px-2">
        {!pane && (
          <IconBtn label="Назад" onClick={onBack}>
            <ChevronLeftIcon strokeWidth={STROKE} />
          </IconBtn>
        )}
        <h1 className="min-w-0 flex-1 truncate px-2 text-[17px] font-semibold tracking-[-0.01em]">
          {b.restaurantName ?? 'Без име'}
        </h1>
        <Pill tone={pill.tone} className="mr-2">
          {pill.label}
        </Pill>
      </div>
      <div className="flex flex-col gap-6 px-4 pt-2">
        <div className="grid grid-cols-2 gap-4 rounded-[14px] border border-(--a-hairline) bg-(--a-surface) p-4">
          <div>
            <p className="text-[13px] text-(--a-muted)">Общо</p>
            <p className="text-[22px] font-semibold tracking-[-0.02em]">
              <Money cents={b.totalCents} />
            </p>
          </div>
          <div>
            <p className="text-[13px] text-(--a-muted)">Остават</p>
            <p className="text-[22px] font-semibold tracking-[-0.02em]">
              <Money cents={b.outstandingCents} />
            </p>
          </div>
          <p className="col-span-2 text-[13px] text-(--a-muted)">
            {shortDate(b.date)},{' '}
            {b.guestCount === 0
              ? 'още няма хора'
              : `${b.paidGuestCount} от ${b.guestCount} платили`}
          </p>
        </div>
        {b.debtors.length > 0 && (
          <section>
            <GroupLabel>Дължат</GroupLabel>
            <Group>
              {b.debtors.map((d) => (
                <div key={d.name} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={d.name} />
                  <span className="flex-1 text-[15px] font-medium">
                    {d.name}
                  </span>
                  <Money cents={d.cents} className="font-semibold" />
                  <Pill tone="due">Дължи</Pill>
                </div>
              ))}
            </Group>
          </section>
        )}
        <div className="flex items-start gap-3 rounded-[14px] bg-(--a-surface-2) p-4 text-[13px] text-(--a-muted)">
          <LockIcon strokeWidth={STROKE} className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>
              Това е примерна сметка само за преглед. Всичко може да се пробва в
              Механа Чучура.
            </p>
            <Btn
              size="sm"
              variant="ghost"
              className="mt-2 -ml-3"
              onClick={onOpenLive}
            >
              Отвори Механа Чучура
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
