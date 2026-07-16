import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Drawer, DrawerContent } from '#/components/ui/drawer.tsx'
import {
  buildClaimShareSnapPoints,
  isClaimShareExpanded,
} from '#/lib/claim-share-drawer.ts'
import { cn } from '#/lib/utils.ts'

export type ClaimShareSnap = 'peek' | 'expanded'

export interface ClaimShareDrawerProps {
  title: ReactNode
  status?: ReactNode
  /** Sticky bottom region: amount + pay / host note (+ pending). */
  summary: ReactNode
  /** Expanded-only scroll region: breakdown lines (+ chips). */
  details: ReactNode
  snap?: ClaimShareSnap
  onSnapChange?: (snap: ClaimShareSnap) => void
  /** Fallback peek height before measure (px). Default 160. */
  initialPeekHeightPx?: number
}

export function ClaimShareDrawer({
  title,
  status,
  summary,
  details,
  snap: snapProp,
  onSnapChange,
  initialPeekHeightPx = 160,
}: ClaimShareDrawerProps) {
  const detailsId = useId()
  const contentRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [peekHeightPx, setPeekHeightPx] = useState(initialPeekHeightPx)
  const snapPoints = useMemo(
    () => buildClaimShareSnapPoints(peekHeightPx),
    [peekHeightPx],
  )
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(
    () => buildClaimShareSnapPoints(initialPeekHeightPx)[0]!,
  )

  useEffect(() => {
    const content = contentRef.current
    const header = headerRef.current
    const summaryEl = summaryRef.current
    if (!content || !header || !summaryEl) return

    const updatePeekHeight = () => {
      const style = getComputedStyle(content)
      const padTop = Number.parseFloat(style.paddingTop) || 0
      const padBottom = Number.parseFloat(style.paddingBottom) || 0
      const height = header.offsetHeight + summaryEl.offsetHeight + padTop + padBottom
      if (height > 0) setPeekHeightPx(height)
    }

    updatePeekHeight()
    const observer = new ResizeObserver(updatePeekHeight)
    observer.observe(header)
    observer.observe(summaryEl)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (snapProp === 'expanded') {
      setActiveSnapPoint(snapPoints[1]!)
      return
    }
    if (snapProp === 'peek') {
      setActiveSnapPoint(snapPoints[0]!)
      return
    }
    setActiveSnapPoint((current) =>
      isClaimShareExpanded(current, snapPoints)
        ? snapPoints[1]!
        : snapPoints[0]!,
    )
  }, [snapPoints, snapProp])

  const expanded = isClaimShareExpanded(activeSnapPoint, snapPoints)

  function commitSnapPoint(next: number | string | null) {
    setActiveSnapPoint(next)
    if (next == null) return
    onSnapChange?.(
      isClaimShareExpanded(next, snapPoints) ? 'expanded' : 'peek',
    )
  }

  function toggleSnap() {
    commitSnapPoint(expanded ? snapPoints[0]! : snapPoints[1]!)
  }

  return (
    <>
      <div aria-hidden style={{ height: peekHeightPx }} />
      {expanded ? (
        <button
          type="button"
          aria-label="Свий разбивката"
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => commitSnapPoint(snapPoints[0]!)}
        />
      ) : null}
      <Drawer
        open
        modal={false}
        dismissible={false}
        snapPoints={snapPoints}
        activeSnapPoint={activeSnapPoint}
        setActiveSnapPoint={commitSnapPoint}
      >
        <DrawerContent
          showOverlay={false}
          className="z-50 max-h-[min(75dvh,36rem)] gap-0 border-t sticky-surface"
        >
          <div
            ref={contentRef}
            className={cn(
              'mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col px-4 pt-2',
              'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
            )}
          >
            <div ref={headerRef} className="flex flex-col gap-3">
              <button
                type="button"
                className="mx-auto flex w-full flex-col items-center gap-2"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={toggleSnap}
              >
                <span className="bg-muted mx-auto mt-1 h-1.5 w-10 shrink-0 rounded-full" />
                <span className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="text-base font-semibold">{title}</span>
                  {status}
                </span>
              </button>
            </div>
            <div
              id={detailsId}
              data-testid="claim-share-details"
              hidden={!expanded}
              className={cn(
                'min-h-0 flex-1 overflow-y-auto',
                !expanded && 'hidden',
              )}
            >
              {details}
            </div>
            <div ref={summaryRef} className="shrink-0 border-t pt-3">
              {summary}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
