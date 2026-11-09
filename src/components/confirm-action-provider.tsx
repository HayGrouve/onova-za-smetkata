import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
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
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
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
  const [request, setRequest] =
    useState<ReturnType<typeof stateRef.current.getPendingRequest>>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [typed, setTyped] = useState('')

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
      typedConfirmation: options.typedConfirmation ?? null,
    } as const

    setRequest(full)
    setTyped('')
    setOpen(true)
    setIsConfirming(false)
    return stateRef.current.requestConfirm(full)
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])
  const typedConfirmation = request?.typedConfirmation ?? null
  const typedMismatch =
    typedConfirmation !== null && typed !== typedConfirmation.expected

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
          {typedConfirmation ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-action-typed">
                {typedConfirmation.label}
              </Label>
              <Input
                id="confirm-action-typed"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                className="h-11"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                disabled={isConfirming}
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>
              {request?.cancelLabel ?? 'Отказ'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirming || typedMismatch}
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
    throw new Error(
      'useConfirmAction must be used within ConfirmActionProvider',
    )
  }
  return ctx
}
