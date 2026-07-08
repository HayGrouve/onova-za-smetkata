import { createContext, useContext, useEffect, useState } from 'react'

interface BillHeaderTitleContextValue {
  title: string | null
  setTitle: (title: string | null) => void
}

const BillHeaderTitleContext =
  createContext<BillHeaderTitleContextValue | null>(null)

export function BillHeaderTitleProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [title, setTitle] = useState<string | null>(null)

  return (
    <BillHeaderTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </BillHeaderTitleContext.Provider>
  )
}

export function useBillHeaderTitleValue(): string | null {
  return useContext(BillHeaderTitleContext)?.title ?? null
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
