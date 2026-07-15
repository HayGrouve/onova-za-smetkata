/**
 * PROTOTYPE — Host claim footer + summary paid presentation.
 * Question: What should host claim footer and bill summary look like when
 * share is visible, no pay actions, host row looks paid by rule?
 * Three variants via ?variant= on /prototype/host-paid-presentation.
 */
import type { ReactNode } from 'react'
import { CheckCircle2Icon, PieChartIcon } from 'lucide-react'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { cn } from '#/lib/utils.ts'
import {
  MOCK_BILL_TOTAL_CENTS,
  MOCK_HOST_LINES,
  MOCK_HOST_NAME,
  MOCK_PARTICIPANTS,
  type PrototypeParticipant,
} from './mock-data.ts'

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function FakeClaimList() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 opacity-60">
      <p className="text-sm font-medium">Артикули (мок)</p>
      {MOCK_HOST_LINES.filter((l) => l.label !== 'Бакшиш').map((line) => (
        <div
          key={line.label}
          className="flex items-center justify-between text-sm"
        >
          <span>{line.label}</span>
          <span className="money">{formatEur(line.amountCents)}</span>
        </div>
      ))}
    </div>
  )
}

function PrototypeFrame({
  title,
  state,
  children,
}: {
  title: string
  state: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        <p className="font-medium">PROTOTYPE — host paid presentation</p>
        <p className="text-muted-foreground">{title}</p>
        <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
          {state}
        </pre>
      </div>
      {children}
    </div>
  )
}

function guestBadge(p: PrototypeParticipant) {
  if (p.guestStatus === 'paid') return <Badge>платено</Badge>
  if (p.guestStatus === 'partial') return <Badge variant="secondary">частично</Badge>
  return <Badge variant="outline">неплатено</Badge>
}

/** A — Minimal parity: same shapes as guest paid row / share footer, no pay UI. */
export function VariantA() {
  const host = MOCK_PARTICIPANTS[0]!
  const state = JSON.stringify(
    {
      variant: 'A',
      idea: 'parity-with-paid-guest',
      hostShareCents: host.shareCents,
      outstandingGuests: MOCK_PARTICIPANTS.filter((p) => p.outstandingCents > 0)
        .length,
    },
    null,
    2,
  )

  return (
    <PrototypeFrame title="A — Minimal parity" state={state}>
      <section className="flex flex-col gap-3">
        <SectionLabel>Claim screen (host)</SectionLabel>
        <FakeClaimList />
        <div className="sticky bottom-0 rounded-t-xl border bg-background p-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="mb-3 flex items-center gap-2">
            <PieChartIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Вашият дял</p>
            <Badge className="ml-auto">платено</Badge>
          </div>
          <ul className="mb-3 flex flex-col gap-1 text-sm">
            {MOCK_HOST_LINES.map((line) => (
              <li key={line.label} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{line.label}</span>
                <span className="money">{formatEur(line.amountCents)}</span>
              </li>
            ))}
          </ul>
          <Separator className="mb-3" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Дял</p>
              <p className="money font-medium">{formatEur(host.shareCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Остатък</p>
              <p className="money font-medium">{formatEur(0)}</p>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Без бутони за плащане — покрито като домакин
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Summary — Плащания</SectionLabel>
        <p className="money text-xl font-bold">
          {formatEur(MOCK_BILL_TOTAL_CENTS)}
        </p>
        <p className="text-sm text-muted-foreground">
          1 от 2 гости с остатък (домакинът не влиза в outstanding)
        </p>
        <div className="flex flex-col gap-3">
          {[...MOCK_PARTICIPANTS]
            .sort((a, b) => {
              const order = { unpaid: 0, partial: 1, paid: 2 } as const
              const aKey = a.role === 'host' ? 'paid' : a.guestStatus
              const bKey = b.role === 'host' ? 'paid' : b.guestStatus
              return order[aKey] - order[bKey]
            })
            .map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border p-3',
                  p.role === 'guest' &&
                    p.guestStatus === 'unpaid' &&
                    'border-l-4 border-l-red-500',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{p.name}</p>
                  {p.role === 'host' ? (
                    <Badge>платено</Badge>
                  ) : (
                    guestBadge(p)
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                  <div>
                    <p className="text-xs">Дължи</p>
                    <p className="money text-foreground">
                      {formatEur(p.shareCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs">Платено</p>
                    <p className="money text-foreground">
                      {formatEur(
                        p.role === 'host'
                          ? p.shareCents
                          : p.shareCents - p.outstandingCents,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs">Остатък</p>
                    <p className="money text-foreground">
                      {formatEur(p.outstandingCents)}
                    </p>
                  </div>
                </div>
                {p.role === 'guest' && p.outstandingCents > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    [guest pay / mark-paid actions…]
                  </p>
                ) : null}
              </div>
            ))}
        </div>
      </section>
    </PrototypeFrame>
  )
}

/** B — Host-labeled compact: „домакин“ chip; share-only row; calm one-line footer. */
export function VariantB() {
  const host = MOCK_PARTICIPANTS[0]!
  const guests = MOCK_PARTICIPANTS.filter((p) => p.role === 'guest')
  const state = JSON.stringify(
    {
      variant: 'B',
      idea: 'host-labeled-compact',
      hostShareCents: host.shareCents,
      summaryShowsShareOnlyForHost: true,
    },
    null,
    2,
  )

  return (
    <PrototypeFrame title="B — Host-labeled compact" state={state}>
      <section className="flex flex-col gap-3">
        <SectionLabel>Claim screen (host)</SectionLabel>
        <FakeClaimList />
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Вашият дял</p>
            <p className="money text-lg font-semibold">
              {formatEur(host.shareCents)}
            </p>
          </div>
          <div className="text-right">
            <Badge variant="secondary">домакин</Badge>
            <p className="mt-1 text-xs text-muted-foreground">покрито</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Summary — Плащания</SectionLabel>
        <p className="money text-xl font-bold">
          {formatEur(MOCK_BILL_TOTAL_CENTS)}
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3">
            <div className="flex items-center gap-2">
              <p className="font-medium">{MOCK_HOST_NAME}</p>
              <Badge variant="secondary">домакин</Badge>
            </div>
            <p className="money font-medium">{formatEur(host.shareCents)}</p>
          </div>
          {guests.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-3',
                p.guestStatus === 'unpaid' && 'border-l-4 border-l-red-500',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{p.name}</p>
                {guestBadge(p)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs">Дължи</p>
                  <p className="money text-foreground">
                    {formatEur(p.shareCents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs">Платено</p>
                  <p className="money text-foreground">
                    {formatEur(p.shareCents - p.outstandingCents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs">Остатък</p>
                  <p className="money text-foreground">
                    {formatEur(p.outstandingCents)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PrototypeFrame>
  )
}

/** C — Separated host strip: footer status bar; host above guests in own block. */
export function VariantC() {
  const host = MOCK_PARTICIPANTS[0]!
  const guests = MOCK_PARTICIPANTS.filter((p) => p.role === 'guest')
  const unpaidGuests = guests.filter((p) => p.outstandingCents > 0).length
  const state = JSON.stringify(
    {
      variant: 'C',
      idea: 'separated-host-strip',
      hostShareCents: host.shareCents,
      guestOutstandingCount: unpaidGuests,
    },
    null,
    2,
  )

  return (
    <PrototypeFrame title="C — Separated host strip" state={state}>
      <section className="flex flex-col gap-3">
        <SectionLabel>Claim screen (host)</SectionLabel>
        <FakeClaimList />
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center gap-2 bg-success/15 px-4 py-2 text-sm">
            <CheckCircle2Icon className="size-4 text-success" />
            <span className="font-medium">Покрито от домакина</span>
          </div>
          <div className="flex flex-col gap-2 px-4 py-3">
            {MOCK_HOST_LINES.map((line) => (
              <div
                key={line.label}
                className="flex justify-between gap-2 text-sm"
              >
                <span className="text-muted-foreground">{line.label}</span>
                <span className="money">{formatEur(line.amountCents)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Общо ваш дял</span>
              <span className="money">{formatEur(host.shareCents)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Summary</SectionLabel>
        <p className="money text-xl font-bold">
          {formatEur(MOCK_BILL_TOTAL_CENTS)}
        </p>

        <div className="rounded-lg bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Домакин
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-success" />
              <p className="font-medium">{MOCK_HOST_NAME}</p>
            </div>
            <p className="money">{formatEur(host.shareCents)}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            В дяла и бакшиша · без събиране
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Гости · {unpaidGuests} с остатък
          </p>
          {guests.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border p-3',
                p.guestStatus === 'unpaid' && 'border-l-4 border-l-red-500',
              )}
            >
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  дял {formatEur(p.shareCents)}
                  {p.outstandingCents > 0
                    ? ` · остатък ${formatEur(p.outstandingCents)}`
                    : ''}
                </p>
              </div>
              {guestBadge(p)}
            </div>
          ))}
        </div>
      </section>
    </PrototypeFrame>
  )
}

export const HOST_PAID_VARIANTS = [
  { key: 'A', label: 'Minimal parity', Component: VariantA },
  { key: 'B', label: 'Host-labeled compact', Component: VariantB },
  { key: 'C', label: 'Separated host strip', Component: VariantC },
] as const
