import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { CheckCircleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { calculateBillTotals } from '#/lib/bill-calculations.ts'
import { toBillCalculationSnapshot } from '#/lib/bill-calculation-snapshot.ts'
import { buildBillJoinUrl, resolveAppOrigin } from '#/lib/bill-join-url.ts'
import { formatBillShareText, shareOrCopyText } from '#/lib/bill-share.ts'
import { getBillDeleteCopy } from '#/lib/destructive-action-copy.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { navigateToFinalBillSummary } from '#/lib/navigate-to-final-bill-summary.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { shareLink } from '#/lib/share-link.ts'
import { ICON } from '#/lib/app-icons.ts'
import type { AppHeaderMenuBillActionId } from '../../shared/app-header-menu-config.ts'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export interface BillData {
  bill: {
    _id: Id<'bills'>
    status: 'draft' | 'final'
    restaurantName: string
    date: number
    note?: string
    shareToken?: string
    tipCents?: number
    hostParticipantId?: Id<'participants'>
  }
  participants: Array<{
    _id: Id<'participants'>
    name: string
    sortOrder: number
  }>
  items: Array<{
    _id: Id<'items'>
    name: string
    unitPriceCents: number
    quantity: number
  }>
  assignments: Array<{
    itemId: Id<'items'>
    participantId: Id<'participants'>
    unitIndex: number
  }>
  payments: Array<{
    participantId: Id<'participants'>
    amountCents: number
  }>
}

export interface UseBillHeaderMenuActionsOptions {
  billId: Id<'bills'> | undefined
  billData: BillData | undefined
  unpaidCount: number
}

export function useBillHeaderMenuActions({
  billId,
  billData,
  unpaidCount,
}: UseBillHeaderMenuActionsOptions) {
  const navigate = useNavigate()
  const { confirm } = useConfirmAction()
  const finalizeBill = useMutation(api.bills.finalize)
  const removeBill = useMutation(api.bills.remove)
  const rotateShareToken = useMutation(api.bills.rotateShareToken)

  const [rotateOpen, setRotateOpen] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const billSnapshot = useMemo(() => {
    if (!billData) return null
    return toBillCalculationSnapshot(
      {
        participants: billData.participants,
        items: billData.items,
        assignments: billData.assignments,
        payments: billData.payments,
      },
      {
        tipCents: billData.bill.tipCents ?? 0,
        hostParticipantId: billData.bill.hostParticipantId,
      },
    )
  }, [billData])

  const totals = useMemo(() => {
    if (!billSnapshot) return null
    return calculateBillTotals(billSnapshot.calculationInput)
  }, [billSnapshot])

  async function handleShareJoinLink() {
    if (!billData?.bill.shareToken) return
    const origin = resolveAppOrigin(window.location.origin)
    const joinUrl = buildBillJoinUrl(billId, origin, billData.bill.shareToken)
    const result = await shareLink({
      url: joinUrl,
      title: 'Онова за сметката',
    })
    if (result === 'shared') {
      toast.success('Линкът е споделен')
    } else if (result === 'copied') {
      toast.success('Линкът е копиран')
    } else if (result === 'failed') {
      toast.error('Неуспешно споделяне')
    }
  }

  async function handleRotateConfirm() {
    setIsRotating(true)
    try {
      await rotateShareToken({ billId })
      setRotateOpen(false)
      toast.success('Линкът е обновен')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setIsRotating(false)
    }
  }

  async function handleFinalize() {
    setIsFinalizing(true)
    try {
      await finalizeBill({ billId })
      setFinalizeOpen(false)
      toast.success('Сметката е завършена')
      await navigateToFinalBillSummary(navigate, billId)
    } catch {
      toast.error('Неуспешно завършване на сметката')
    } finally {
      setIsFinalizing(false)
    }
  }

  async function handleDeleteWithConfirm() {
    const confirmed = await confirm(getBillDeleteCopy())
    if (!confirmed) return
    setIsDeleting(true)
    try {
      await removeBill({ billId })
      await navigate({ to: '/' })
    } catch {
      toast.error('Неуспешно изтриване на сметката')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleShareBillText() {
    if (!billData || !billSnapshot || !totals) return
    const labels = buildParticipantLabels(billData.participants)
    const text = formatBillShareText({
      restaurantName: billData.bill.restaurantName,
      date: new Date(billData.bill.date),
      note: billData.bill.note,
      billTotalCents: totals.billTotalCents,
      breakdown: billSnapshot.breakdownInput,
      participants: billData.participants.map((participant) => ({
        id: participant._id,
        label: labels[participant._id] ?? participant.name,
        sortOrder: participant.sortOrder,
        totals: totals.byParticipant[participant._id],
      })),
    })

    try {
      const result = await shareOrCopyText(
        text,
        billData.bill.restaurantName.trim() || 'Сметка',
      )
      toast.success(result === 'shared' ? 'Споделено' : 'Копирано')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      toast.error('Неуспешно копиране')
    }
  }

  function handleBillAction(actionId: AppHeaderMenuBillActionId) {
    if (!billId) return
    switch (actionId) {
      case 'shareJoinLink':
        void handleShareJoinLink()
        break
      case 'rotateShareToken':
        setRotateOpen(true)
        break
      case 'finalizeBill':
        setFinalizeOpen(true)
        break
      case 'deleteBill':
        void handleDeleteWithConfirm()
        break
      case 'editBill':
      case 'goToEditor':
        void navigate({
          to: '/bills/$billId',
          params: { billId },
          search: { step: 1 },
        })
        break
      case 'shareBillText':
        void handleShareBillText()
        break
    }
  }

  const dialogs = (
    <>
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Обнови линка за покана?</DialogTitle>
            <DialogDescription>
              Старите линкове и QR кодове ще спрат да работят. Споделете новия
              линк с хората на масата.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isRotating}
              onClick={() => setRotateOpen(false)}
            >
              Отказ
            </Button>
            <Button
              type="button"
              disabled={isRotating}
              onClick={() => void handleRotateConfirm()}
            >
              {isRotating ? 'Обновяване...' : 'Обнови линка'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {totals ? (
        <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Завършване на сметката?</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <p>
                    Обща сума:{' '}
                    <span className="money font-medium text-foreground">
                      {formatEur(totals.billTotalCents)}
                    </span>
                  </p>
                  {unpaidCount > 0 ? (
                    <p>
                      {unpaidCount} участник{unpaidCount === 1 ? '' : 'а'} все
                      още не {unpaidCount === 1 ? 'е' : 'са'} платил
                      {unpaidCount === 1 ? '' : 'и'} напълно.
                    </p>
                  ) : (
                    <p>Всички участници са платили.</p>
                  )}
                  <p>
                    След завършване сметката е само за преглед — гостите не
                    могат да променят артикулите, а плащанията не могат да се
                    отменят или добавят.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFinalizeOpen(false)}
                disabled={isFinalizing}
              >
                Отказ
              </Button>
              <Button
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={() => void handleFinalize()}
                disabled={isFinalizing || unpaidCount > 0 || isDeleting}
              >
                <CheckCircleIcon className={ICON.button} aria-hidden />
                {isFinalizing ? 'Завършване...' : 'Завърши сметка'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )

  return {
    handleBillAction,
    dialogs,
    isDeleting,
  }
}
