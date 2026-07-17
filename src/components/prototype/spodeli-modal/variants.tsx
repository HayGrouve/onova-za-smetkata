/**
 * PROTOTYPE — Сподели modal for qty > 1 per-unit claiming.
 * Question: What should the modal feel like when each unit is claimable
 * independently (join/leave, others visible, share preview)?
 * Three variants via ?variant= on /prototype/spodeli-modal.
 *
 * Parent row follows locked #36: identity + my count + coverage → Сподели.
 */
import { useState, type ReactNode } from 'react'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer.tsx'
import { Button } from '#/components/ui/button.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { cn } from '#/lib/utils.ts'
import {
  cloneMembership,
  coveredUnitCount,
  formatShareParticipantCount,
  isMeOnUnit,
  membershipStateDump,
  MOCK_ITEM,
  myUnitCount,
  otherLabelsOnUnit,
  toggleMeOnUnit,
  unitSharePreviewCents,
  type UnitMembership,
} from './membership.ts'

function PrototypeFrame({
  title,
  membership,
  onReset,
  children,
}: {
  title: string
  membership: UnitMembership
  onReset: () => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        <p className="font-medium">PROTOTYPE — Сподели modal</p>
        <p className="text-muted-foreground">{title}</p>
        <button
          type="button"
          className="mt-2 text-xs font-medium underline"
          onClick={onReset}
        >
          Reset membership
        </button>
        <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
          {membershipStateDump(membership)}
        </pre>
      </div>
      {children}
    </div>
  )
}

/** Locked parent row (#36) — shared only as decided product chrome, not modal layout. */
function ParentRow({
  membership,
  onOpen,
}: {
  membership: UnitMembership
  onOpen: () => void
}) {
  const mine = myUnitCount(membership)
  const covered = coveredUnitCount(membership)
  const lineTotal = MOCK_ITEM.unitPriceCents * MOCK_ITEM.quantity

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'guest-claim-card flex w-full flex-col gap-1 rounded-lg border p-4 text-left tap-feedback',
        mine > 0
          ? 'guest-claim-card--selected border-primary/50 bg-primary/10'
          : 'border-border bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{MOCK_ITEM.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatEur(MOCK_ITEM.unitPriceCents)} × {MOCK_ITEM.quantity}
          </p>
        </div>
        <p className="money font-medium">{formatEur(lineTotal)}</p>
      </div>
      {mine > 0 ? (
        <p className="text-xs font-medium text-primary">
          Ваши бройки: {mine} от {MOCK_ITEM.quantity}
        </p>
      ) : null}
      {covered > 0 ? (
        <p className="text-xs text-muted-foreground">
          {covered} от {MOCK_ITEM.quantity} заети
        </p>
      ) : null}
      <p className="text-xs font-medium text-foreground">Сподели →</p>
    </button>
  )
}

function unitTitle(unitIndex: number) {
  return `${MOCK_ITEM.name} · бройка ${unitIndex + 1}`
}

/* -------------------------------------------------------------------------- */
/* A — Stacked qty=1-style cards in a centered dialog                         */
/* -------------------------------------------------------------------------- */

export function VariantA() {
  const [membership, setMembership] = useState(cloneMembership)
  const [open, setOpen] = useState(false)

  return (
    <PrototypeFrame
      title="A — Stacked item cards in a dialog (units look like today’s qty=1 rows)"
      membership={membership}
      onReset={() => setMembership(cloneMembership())}
    >
      <ParentRow membership={membership} onOpen={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сподели · {MOCK_ITEM.name}</DialogTitle>
            <DialogDescription>
              Всяка бройка е отделен ред — докоснете, за да се присъедините или
              да излезете.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {Array.from({ length: MOCK_ITEM.quantity }, (_, unitIndex) => {
              const mine = isMeOnUnit(membership, unitIndex)
              const others = otherLabelsOnUnit(membership, unitIndex)
              const share = unitSharePreviewCents(membership, unitIndex, !mine)
              const empty = (membership[unitIndex] ?? []).length === 0

              return (
                <button
                  key={unitIndex}
                  type="button"
                  onClick={() =>
                    setMembership((m) => toggleMeOnUnit(m, unitIndex))
                  }
                  className={cn(
                    'guest-claim-card flex flex-col gap-1 rounded-lg border p-4 text-left tap-feedback',
                    mine
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border bg-card',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{unitTitle(unitIndex)}</p>
                    <p className="money text-sm font-medium">
                      {formatEur(MOCK_ITEM.unitPriceCents)}
                    </p>
                  </div>
                  {mine ? (
                    <p className="text-xs font-medium text-primary">✓ Ваше</p>
                  ) : null}
                  {others.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Споделено с {others.join(', ')} (
                      {formatShareParticipantCount(others.length + (mine ? 1 : 0))}
                      )
                    </p>
                  ) : empty ? (
                    <p className="text-xs text-muted-foreground">Празна бройка</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Вашият дял: {formatEur(share)}
                  </p>
                  {!mine ? (
                    <p className="text-xs font-medium text-muted-foreground">
                      Присъедини се
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-muted-foreground">
                      Докоснете, за да излезете
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </PrototypeFrame>
  )
}

/* -------------------------------------------------------------------------- */
/* B — Bottom drawer, dense checklist rows (not cards)                        */
/* -------------------------------------------------------------------------- */

export function VariantB() {
  const [membership, setMembership] = useState(cloneMembership)
  const [open, setOpen] = useState(false)

  return (
    <PrototypeFrame
      title="B — Bottom drawer + dense checklist (checkbox primary, no unit cards)"
      membership={membership}
      onReset={() => setMembership(cloneMembership())}
    >
      <ParentRow membership={membership} onOpen={() => setOpen(true)} />
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto max-h-[85dvh] max-w-lg">
          <DrawerHeader className="text-left">
            <DrawerTitle>Сподели · {MOCK_ITEM.name}</DrawerTitle>
            <DrawerDescription>
              Отметнете бройките, в които участвате. Имена и дял са на същия
              ред.
            </DrawerDescription>
          </DrawerHeader>
          <ul className="flex flex-col divide-y border-t px-4 pb-8">
            {Array.from({ length: MOCK_ITEM.quantity }, (_, unitIndex) => {
              const mine = isMeOnUnit(membership, unitIndex)
              const others = otherLabelsOnUnit(membership, unitIndex)
              const share = unitSharePreviewCents(membership, unitIndex, !mine)
              const empty = (membership[unitIndex] ?? []).length === 0

              return (
                <li key={unitIndex}>
                  <label className="flex cursor-pointer items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 accent-primary"
                      checked={mine}
                      onChange={() =>
                        setMembership((m) => toggleMeOnUnit(m, unitIndex))
                      }
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          Бройка {unitIndex + 1}
                        </span>
                        <span className="money text-sm tabular-nums">
                          {formatEur(share)}
                        </span>
                      </span>
                      {empty ? (
                        <span className="text-xs text-muted-foreground">
                          Никой още
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <UsersIcon className="size-3.5 shrink-0" />
                          {[
                            ...(mine ? ['Ти'] : []),
                            ...others,
                          ].join(', ')}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </DrawerContent>
      </Drawer>
    </PrototypeFrame>
  )
}

/* -------------------------------------------------------------------------- */
/* C — One-unit-at-a-time stepper with large join control                     */
/* -------------------------------------------------------------------------- */

export function VariantC() {
  const [membership, setMembership] = useState(cloneMembership)
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(0)

  function shift(delta: number) {
    setFocus((f) => (f + delta + MOCK_ITEM.quantity) % MOCK_ITEM.quantity)
  }

  const mine = isMeOnUnit(membership, focus)
  const others = otherLabelsOnUnit(membership, focus)
  const share = unitSharePreviewCents(membership, focus, !mine)
  const empty = (membership[focus] ?? []).length === 0

  return (
    <PrototypeFrame
      title="C — One unit at a time (stepper); large join/leave; strip of unit dots"
      membership={membership}
      onReset={() => {
        setMembership(cloneMembership())
        setFocus(0)
      }}
    >
      <ParentRow membership={membership} onOpen={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сподели · {MOCK_ITEM.name}</DialogTitle>
            <DialogDescription>
              Прелиствайте бройките. Присъединяването е една голяма действие на
              екрана.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center gap-2 py-1">
            {Array.from({ length: MOCK_ITEM.quantity }, (_, i) => {
              const on = isMeOnUnit(membership, i)
              const hasPeople = (membership[i] ?? []).length > 0
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Бройка ${i + 1}`}
                  onClick={() => setFocus(i)}
                  className={cn(
                    'size-3 rounded-full border transition-colors',
                    i === focus
                      ? 'border-primary bg-primary'
                      : on
                        ? 'border-primary/60 bg-primary/40'
                        : hasPeople
                          ? 'border-muted-foreground/50 bg-muted'
                          : 'border-muted-foreground/30 bg-transparent',
                  )}
                />
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Предишна бройка"
              onClick={() => shift(-1)}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-lg font-semibold">{unitTitle(focus)}</p>
              <p className="money text-sm text-muted-foreground">
                {formatEur(MOCK_ITEM.unitPriceCents)}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Следваща бройка"
              onClick={() => shift(1)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          <div className="rounded-lg border border-dashed px-3 py-3 text-sm">
            {empty ? (
              <p className="text-muted-foreground">Празна бройка — никой още</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {mine ? (
                  <li className="flex items-center gap-2 font-medium text-primary">
                    <CheckIcon className="size-4" /> Ти
                  </li>
                ) : null}
                {others.map((label) => (
                  <li key={label} className="text-muted-foreground">
                    {label}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Вашият дял при {mine ? 'текущото' : 'присъединяване'}:{' '}
              {formatEur(share)}
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full"
            variant={mine ? 'outline' : 'default'}
            onClick={() => setMembership((m) => toggleMeOnUnit(m, focus))}
          >
            {mine ? 'Напусни бройката' : 'Присъедини се'}
          </Button>
        </DialogContent>
      </Dialog>
    </PrototypeFrame>
  )
}

export const SPODELI_MODAL_VARIANTS = [
  {
    key: 'A',
    label: 'Stacked cards',
    Component: VariantA,
  },
  {
    key: 'B',
    label: 'Drawer checklist',
    Component: VariantB,
  },
  {
    key: 'C',
    label: 'Unit stepper',
    Component: VariantC,
  },
] as const
