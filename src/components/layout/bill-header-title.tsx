import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface BillHeaderTitleContextValue {
  title: string | null
  setTitle: (title: string | null) => void
  /** Header element pages can portal into (the phase timeline). */
  slotElement: HTMLElement | null
  setSlotElement: (element: HTMLElement | null) => void
  slotUsers: number
  setSlotUsers: (update: (count: number) => number) => void
}

function noopRef() {}

const BillHeaderTitleContext =
  createContext<BillHeaderTitleContextValue | null>(null)

export function BillHeaderTitleProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [title, setTitle] = useState<string | null>(null)
  const [slotElement, setSlotElement] = useState<HTMLElement | null>(null)
  const [slotUsers, setSlotUsers] = useState(0)

  return (
    <BillHeaderTitleContext.Provider
      value={{
        title,
        setTitle,
        slotElement,
        setSlotElement,
        slotUsers,
        setSlotUsers,
      }}
    >
      {children}
    </BillHeaderTitleContext.Provider>
  )
}

export function useBillHeaderTitleValue(): string | null {
  return useContext(BillHeaderTitleContext)?.title ?? null
}

/** For the header: where to mount the slot, and whether a page fills it. */
export function useBillHeaderSlot(): {
  ref: (element: HTMLElement | null) => void
  active: boolean
} {
  const context = useContext(BillHeaderTitleContext)
  return {
    // The state setter is stable, so React does not re-run the ref each render.
    ref: context?.setSlotElement ?? noopRef,
    active: (context?.slotUsers ?? 0) > 0,
  }
}

export function BillHeaderTitleSync({ title }: { title: string }) {
  const context = useContext(BillHeaderTitleContext)

  useEffect(() => {
    if (!context) return
    context.setTitle(title.trim() || 'Без име')
    return () => context.setTitle(null)
  }, [context, title])

  return null
}

/**
 * Replaces the header title with page content (the receipt's phase timeline),
 * so a bill has one bar instead of a header stacked on a step bar.
 */
export function BillHeaderSlot({ children }: { children: ReactNode }) {
  const context = useContext(BillHeaderTitleContext)
  const setSlotUsers = context?.setSlotUsers

  useEffect(() => {
    if (!setSlotUsers) return
    setSlotUsers((count) => count + 1)
    return () => setSlotUsers((count) => count - 1)
  }, [setSlotUsers])

  if (!context?.slotElement) return null
  return createPortal(children, context.slotElement)
}
