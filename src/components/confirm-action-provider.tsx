import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog.tsx'
import { buttonVariants } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'
import type { ConfirmOptions } from '#/lib/destructive-action-copy.ts'
import { createConfirmActionState } from '#/lib/confirm-action-state.ts'

type ConfirmActionContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmActionContext = createContext<ConfirmActionContextValue | null>(
  null,
)

export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef(createConfirmActionState())
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<
    ReturnType<typeof stateRef.current.getPendingRequest>
  >(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const close = useCallback((confirmed: boolean) => {
    stateRef.current.resolveConfirm(confirmed)
    setOpen(false)
    setRequest(null)
    setIsConfirming(false)
  }, [])

  const confirm = useCallback(async (options: ConfirmOptions) => {
    const full = {
      title: options.title,
      description: options.description ?? '',
      confirmLabel: options.confirmLabel ?? 'Потвърди',
      cancelLabel: options.cancelLabel ?? 'Отказ',
      variant: options.variant ?? 'destructive',
    } as const

    setRequest(full)
    setOpen(true)
    setIsConfirming(false)
    return stateRef.current.requestConfirm(full)
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmActionContext.Provider value={value}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isConfirming) close(false)
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description ? (
              <AlertDialogDescription>
                {request.description}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>
              {request?.cancelLabel ?? 'Отказ'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirming}
              aria-busy={isConfirming}
              className={cn(
                request?.variant === 'destructive' &&
                  buttonVariants({ variant: 'destructive' }),
              )}
              onClick={(event) => {
                event.preventDefault()
                setIsConfirming(true)
                close(true)
              }}
            >
              {request?.confirmLabel ?? 'Потвърди'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmActionContext.Provider>
  )
}

export function useConfirmAction() {
  const ctx = useContext(ConfirmActionContext)
  if (!ctx) {
    throw new Error('useConfirmAction must be used within ConfirmActionProvider')
  }
  return ctx
}
