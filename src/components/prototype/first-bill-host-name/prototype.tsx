/**
 * PROTOTYPE — three structurally different placements for first-bill Host
 * name confirmation, switchable via ?variant=.
 */
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { CheckCircle2Icon, PlusIcon, ReceiptTextIcon } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { formatUsernameError, parseUsername } from '#/lib/host-profile.ts'

const SUGGESTED_NAME = 'Цветомир'

interface CreatedBillState {
  hostParticipantName: string
  usernameSaved: boolean
  futureUsername?: string
}

interface NamePrototypeState {
  name: string
  fieldError?: string
  createdBill?: CreatedBillState
  setName: (name: string) => void
  createBill: () => boolean
}

function useNamePrototype(): NamePrototypeState {
  const [name, setNameValue] = useState(SUGGESTED_NAME)
  const [fieldError, setFieldError] = useState<string>()
  const [createdBill, setCreatedBill] = useState<CreatedBillState>()

  function setName(nextName: string) {
    setNameValue(nextName)
    if (fieldError) setFieldError(undefined)
  }

  function createBill(): boolean {
    const parsed = parseUsername(name)
    if (!parsed.success) {
      setFieldError(formatUsernameError(parsed.error))
      return false
    }
    if (!parsed.data) {
      setFieldError('Името не може да е празно')
      return false
    }

    const usernameSaved = parsed.data !== SUGGESTED_NAME
    setCreatedBill({
      hostParticipantName: parsed.data,
      usernameSaved,
      futureUsername: usernameSaved ? parsed.data : SUGGESTED_NAME,
    })
    setFieldError(undefined)
    return true
  }

  return { name, fieldError, createdBill, setName, createBill }
}

function PrototypeState({
  variant,
  flow,
  extra,
}: {
  variant: string
  flow: NamePrototypeState
  extra?: Record<string, unknown>
}) {
  const state = JSON.stringify(
    {
      variant,
      source: 'username',
      suggestedName: SUGGESTED_NAME,
      fieldValue: flow.name,
      fieldError: flow.fieldError ?? null,
      createdBill: flow.createdBill ?? null,
      ...extra,
    },
    null,
    2,
  )

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      <p className="font-medium">
        PROTOTYPE — first-bill Host name confirmation
      </p>
      <p className="text-muted-foreground">{variant}</p>
      <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
        {state}
      </pre>
    </div>
  )
}

function BillState({ createdBill }: { createdBill?: CreatedBillState }) {
  if (!createdBill) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-10 text-center">
        <ReceiptTextIcon
          className="mx-auto mb-3 size-8 text-muted-foreground"
          aria-hidden
        />
        <p className="font-medium">Все още нямате сметки</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Създайте първата си сметка!
        </p>
      </div>
    )
  }

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Първата сметка е създадена</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Вашето място като участник е „{createdBill.hostParticipantName}“.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {createdBill.usernameSaved
              ? `„${createdBill.futureUsername}“ е запазено за бъдещи сметки.`
              : 'Потребителското име не е променено.'}
          </p>
        </div>
      </div>
    </article>
  )
}

function HomeSurface({
  flow,
  variant,
  extraState,
  onNewBill,
  children,
}: {
  flow: NamePrototypeState
  variant: string
  extraState?: Record<string, unknown>
  onNewBill: () => void
  children?: ReactNode
}) {
  return (
    <div className="page-container flex flex-col gap-5 pb-24">
      <PrototypeState variant={variant} flow={flow} extra={extraState} />
      <Button type="button" className="h-11 w-full" onClick={onNewBill}>
        <PlusIcon aria-hidden />
        {flow.createdBill ? 'Нова сметка' : 'Създай първата сметка'}
      </Button>
      {children}
      <BillState createdBill={flow.createdBill} />
    </div>
  )
}

function NameField({ flow }: { flow: NamePrototypeState }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="prototype-host-name">Вашето име в сметките</Label>
      <Input
        id="prototype-host-name"
        value={flow.name}
        onChange={(event) => flow.setName(event.target.value)}
        className="h-11"
        autoComplete="nickname"
        aria-invalid={Boolean(flow.fieldError)}
        aria-describedby="prototype-host-name-help"
      />
      <p
        id="prototype-host-name-help"
        className={
          flow.fieldError
            ? 'text-xs text-destructive'
            : 'text-xs text-muted-foreground'
        }
      >
        {flow.fieldError ?? 'Може да го промените по-късно от Профил.'}
      </p>
    </div>
  )
}

function VariantA() {
  const flow = useNamePrototype()
  const [open, setOpen] = useState(true)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (flow.createBill()) setOpen(false)
  }

  return (
    <>
      <HomeSurface
        flow={flow}
        variant="A — Integrated welcome"
        extraState={{ welcomeOpen: open }}
        onNewBill={() => setOpen(true)}
      />
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <form onSubmit={handleSubmit}>
            <SheetHeader>
              <SheetTitle className="text-xl">Добре дошли! 👋</SheetTitle>
              <SheetDescription>
                Нека създадем първата ви сметка. Така ще ви виждат останалите
                участници:
              </SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <NameField flow={flow} />
            </div>
            <SheetFooter className="pb-20">
              <Button type="submit" className="h-11 w-full">
                Създай първата сметка
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full"
                onClick={() => setOpen(false)}
              >
                Не сега
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}

function VariantB() {
  const flow = useNamePrototype()
  const [open, setOpen] = useState(true)
  const [stage, setStage] = useState<'welcome' | 'name'>('welcome')

  function openWelcome() {
    setStage('welcome')
    setOpen(true)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (flow.createBill()) setOpen(false)
  }

  return (
    <>
      <HomeSurface
        flow={flow}
        variant="B — Separate second step"
        extraState={{ welcomeOpen: open, stage }}
        onNewBill={openWelcome}
      />
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {stage === 'welcome' ? (
            <>
              <SheetHeader className="py-8 text-center">
                <div className="mb-2 text-4xl" aria-hidden>
                  👋
                </div>
                <SheetTitle className="text-xl">Добре дошли!</SheetTitle>
                <SheetDescription>
                  Ще ви преведем през първата ви истинска сметка.
                </SheetDescription>
              </SheetHeader>
              <SheetFooter className="pb-20">
                <Button
                  type="button"
                  className="h-11 w-full"
                  onClick={() => setStage('name')}
                >
                  Да започваме
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full"
                  onClick={() => setOpen(false)}
                >
                  Не сега
                </Button>
              </SheetFooter>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <SheetHeader>
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  Стъпка 2
                </p>
                <SheetTitle className="text-xl">
                  Как да ви изписваме?
                </SheetTitle>
                <SheetDescription>
                  Името ще се използва за вашето място като участник.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <NameField flow={flow} />
              </div>
              <SheetFooter className="pb-20">
                <Button type="submit" className="h-11 w-full">
                  Потвърди и продължи
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full"
                  onClick={() => setStage('welcome')}
                >
                  Назад
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function VariantC() {
  const flow = useNamePrototype()
  const [showCard, setShowCard] = useState(true)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (flow.createBill()) setShowCard(false)
  }

  return (
    <HomeSurface
      flow={flow}
      variant="C — Inline home card"
      extraState={{ inlineCardVisible: showCard }}
      onNewBill={() => setShowCard(true)}
    >
      {showCard ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-card p-4 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Създайте първата си сметка</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Първо потвърдете как ще ви виждат участниците.
          </p>
          <div className="mt-4">
            <NameField flow={flow} />
          </div>
          <Button type="submit" className="mt-4 h-11 w-full">
            Създай сметка
          </Button>
        </form>
      ) : null}
    </HomeSurface>
  )
}

export const NAME_VARIANTS = [
  { key: 'A', label: 'Integrated welcome', Component: VariantA },
  { key: 'B', label: 'Separate second step', Component: VariantB },
  { key: 'C', label: 'Inline home card', Component: VariantC },
] as const

export type NameVariantKey = (typeof NAME_VARIANTS)[number]['key']
