import { CheckIcon, MinusIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { JoinUnitSheet } from '#/components/bills/join-unit-sheet.tsx'
import { ShareUnitSheet } from '#/components/bills/share-unit-sheet.tsx'
import type { ShareCandidate } from '#/components/bills/share-unit-sheet.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useClaimActions } from '#/hooks/use-claim-actions.ts'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { joinLabels } from '#/lib/participant-labels.ts'
import { cn } from '#/lib/utils.ts'
import type { ParticipantInput } from '../../../shared/bill-calculations.ts'
import type { UnitRef } from '../../../shared/claim-groups.ts'
import type { GuestClaimGroupView } from '../../../shared/guest-claim-session.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface ClaimGroupRowProps {
  view: GuestClaimGroupView
  seatId: Id<'participants'>
  participants: ParticipantInput[]
  participantLabels: Record<string, string>
  shareCandidates: ShareCandidate[]
  readOnly: boolean
  sessionToken?: string
  onChanged?: () => void
}

type ShareSheetState =
  { mode: 'new' } | { mode: 'edit'; unit: UnitRef; coMemberIds: string[] }

export function ClaimGroupRow({
  view,
  seatId,
  participants,
  participantLabels,
  shareCandidates,
  readOnly,
  sessionToken,
  onChanged,
}: ClaimGroupRowProps) {
  const { group, seat } = view
  const actions = useClaimActions({ seatId, sessionToken, onChanged })
  const [shareSheet, setShareSheet] = useState<ShareSheetState | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)

  const names = (ids: string[]) =>
    joinLabels(ids.map((id) => participantLabels[id] ?? 'Участник'))
  const isSingle = seat.totalUnits === 1
  const isMine = seat.myUnitCount > 0
  const takenByOthersOnly =
    !isMine && seat.freeUnits.length === 0 && seat.othersUnits.length > 0

  const cardClassName = cn(
    'guest-claim-card flex flex-col gap-3 rounded-lg border p-4',
    'border-border bg-card',
    isMine &&
      'guest-claim-card--selected border-primary/50 bg-primary/10 dark:border-primary/40 dark:bg-primary/15',
    takenByOthersOnly && 'bg-muted/40',
  )

  const sharedUnitRows = seat.mySharedUnits.map((shared) => (
    <div
      key={`${shared.unit.itemId}:${shared.unit.unitIndex}`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background/70 px-3 py-2"
    >
      <p className="text-xs">
        {isSingle ? 'Споделено' : '1 бройка'} с {names(shared.coMemberIds)} ·
        ваш дял{' '}
        <span className="money font-medium">
          {formatEur(shared.myShareCents)}
        </span>
      </p>
      {!readOnly ? (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            disabled={actions.busy}
            onClick={() =>
              setShareSheet({
                mode: 'edit',
                unit: shared.unit,
                coMemberIds: shared.coMemberIds,
              })
            }
          >
            Промени
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            disabled={actions.busy}
            onClick={() => void actions.leave(shared.unit)}
          >
            Махни ме
          </Button>
        </div>
      ) : null}
    </div>
  ))

  function renderSingle() {
    if (seat.mySoloUnits.length === 1) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <CheckIcon className="size-4" aria-hidden />
            Ваше
          </p>
          {!readOnly ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={actions.busy}
                onClick={() => setShareSheet({ mode: 'new' })}
              >
                <UsersIcon className={ICON.button} aria-hidden />
                Сподели
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 text-muted-foreground"
                aria-label={`Махни ${group.name}`}
                disabled={actions.busy}
                onClick={() => void actions.release(group.itemIds)}
              >
                Махни
              </Button>
            </div>
          ) : null}
        </div>
      )
    }

    if (seat.mySharedUnits.length === 1) return sharedUnitRows

    if (seat.othersUnits.length === 1) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Взето от {names(seat.othersUnits[0].memberIds)}
          </p>
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={actions.busy}
              onClick={() => setJoinOpen(true)}
            >
              <UsersIcon className={ICON.button} aria-hidden />
              Споделихме я
            </Button>
          ) : null}
        </div>
      )
    }

    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Свободно</p>
        {!readOnly ? (
          <Button
            type="button"
            className="h-11 px-6"
            aria-label={`Мое: ${group.name}`}
            disabled={actions.busy}
            onClick={() => void actions.take(group.itemIds)}
          >
            Мое
          </Button>
        ) : null}
      </div>
    )
  }

  function renderMulti() {
    const soloCount = seat.mySoloUnits.length
    const freeCount = seat.freeUnits.length
    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">Ваши</span>
            {readOnly ? (
              <span className="money min-w-8 text-center text-lg font-semibold">
                {soloCount}
              </span>
            ) : (
              <div
                className="flex items-center rounded-lg border bg-background"
                role="group"
                aria-label={`Бройки ${group.name} за вас`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="size-11"
                  aria-label={`Една ${group.name} по-малко`}
                  disabled={actions.busy || soloCount === 0}
                  onClick={() => void actions.release(group.itemIds)}
                >
                  <MinusIcon className="size-4" />
                </Button>
                <span
                  className="money min-w-8 text-center text-lg font-semibold"
                  aria-live="polite"
                  data-testid={`claim-count-${group.itemIds[0]}`}
                >
                  {soloCount}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="size-11"
                  aria-label={`Още една ${group.name}`}
                  disabled={actions.busy || freeCount === 0}
                  onClick={() => void actions.take(group.itemIds)}
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {freeCount > 0
              ? `Свободни: ${freeCount} от ${seat.totalUnits}`
              : 'Всички са отбелязани'}
          </p>
        </div>
        {seat.otherClaimantCounts.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Отбелязали:{' '}
            {seat.otherClaimantCounts
              .map(
                (entry) =>
                  `${participantLabels[entry.participantId] ?? 'Участник'} ${entry.units}`,
              )
              .join(' · ')}
          </p>
        ) : null}
        {sharedUnitRows}
        {!readOnly ? (
          <div className="-ml-2 flex flex-wrap gap-1">
            {soloCount > 0 || freeCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-primary"
                disabled={actions.busy}
                onClick={() => setShareSheet({ mode: 'new' })}
              >
                <UsersIcon className={ICON.button} aria-hidden />
                Сподели бройка
              </Button>
            ) : null}
            {seat.joinOptions.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                disabled={actions.busy}
                onClick={() => setJoinOpen(true)}
              >
                <UsersIcon className={ICON.button} aria-hidden />
                Споделихме бройка
              </Button>
            ) : null}
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div
      className={cardClassName}
      data-testid={`claim-group-${group.itemIds[0]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{group.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatEur(group.unitPriceCents)}
            {isSingle ? null : ` × ${seat.totalUnits}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="money font-medium">
            {formatEur(group.unitPriceCents * seat.totalUnits)}
          </p>
          {isMine && !isSingle ? (
            <p className="money text-xs font-medium text-primary">
              ваш дял {formatEur(seat.myShareCents)}
            </p>
          ) : null}
        </div>
      </div>

      {isSingle ? renderSingle() : renderMulti()}

      <ShareUnitSheet
        open={shareSheet !== null}
        onOpenChange={(open) => {
          if (!open) setShareSheet(null)
        }}
        itemName={group.name}
        unitPriceCents={group.unitPriceCents}
        seatId={seatId}
        participants={participants}
        candidates={shareCandidates}
        mode={shareSheet?.mode ?? 'new'}
        initialSelectedIds={
          shareSheet?.mode === 'edit' ? shareSheet.coMemberIds : []
        }
        onConfirm={(ids) =>
          actions.share(
            group.itemIds,
            ids,
            shareSheet?.mode === 'edit' ? shareSheet.unit : undefined,
          )
        }
      />
      <JoinUnitSheet
        open={joinOpen}
        onOpenChange={setJoinOpen}
        itemName={group.name}
        options={seat.joinOptions}
        participantLabels={participantLabels}
        onJoin={(unit) => actions.join(unit)}
      />
    </div>
  )
}
