import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '#/components/ui/drawer.tsx'
import {
  buildClaimShareSnapPoints,
  claimShareExpandedHeightPx,
  claimShareSnapOffsetPx,
  isClaimShareExpanded,
} from '#/lib/claim-share-drawer.ts'
import { cn } from '#/lib/utils.ts'

export type ClaimShareSnap = 'peek' | 'expanded'

function readExpandedHeightPx(): number {
  const viewportHeight =
    typeof window !== 'undefined' ? window.innerHeight : 800
  const rootFontSizePx =
    typeof window !== 'undefined'
      ? Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        ) || 16
      : 16
  return claimShareExpandedHeightPx(viewportHeight, rootFontSizePx)
}

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
  const [expandedHeightPx, setExpandedHeightPx] = useState(readExpandedHeightPx)
  const snapPoints = useMemo(
    () => buildClaimShareSnapPoints(peekHeightPx, expandedHeightPx),
    [peekHeightPx, expandedHeightPx],
  )
  const [activeSnapPoint, setActiveSnapPoint] = useState<
    number | string | null
  >(
    () =>
      buildClaimShareSnapPoints(initialPeekHeightPx, readExpandedHeightPx())[0],
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
      const height =
        header.offsetHeight + summaryEl.offsetHeight + padTop + padBottom
      if (height > 0) setPeekHeightPx(height)
    }

    updatePeekHeight()
    const observer = new ResizeObserver(updatePeekHeight)
    observer.observe(header)
    observer.observe(summaryEl)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateExpandedHeight = () => {
      setExpandedHeightPx(readExpandedHeightPx())
    }
    updateExpandedHeight()
    window.addEventListener('resize', updateExpandedHeight)
    return () => window.removeEventListener('resize', updateExpandedHeight)
  }, [])

  useEffect(() => {
    if (snapProp === 'expanded') {
      setActiveSnapPoint(snapPoints[1])
      return
    }
    if (snapProp === 'peek') {
      setActiveSnapPoint(snapPoints[0])
      return
    }
    setActiveSnapPoint((current) =>
      isClaimShareExpanded(current, snapPoints) ? snapPoints[1] : snapPoints[0],
    )
  }, [snapPoints, snapProp])

  const expanded = isClaimShareExpanded(activeSnapPoint, snapPoints)
  const snapHeightPx = expanded ? expandedHeightPx : peekHeightPx
  const viewportHeightPx =
    typeof window !== 'undefined' ? window.innerHeight : 800
  const snapOffsetPx = claimShareSnapOffsetPx(viewportHeightPx, snapHeightPx)

  function commitSnapPoint(next: number | string | null) {
    setActiveSnapPoint(next)
    if (next == null) return
    onSnapChange?.(isClaimShareExpanded(next, snapPoints) ? 'expanded' : 'peek')
  }

  function toggleSnap() {
    commitSnapPoint(expanded ? snapPoints[0] : snapPoints[1])
  }

  return (
    <>
      <div aria-hidden style={{ height: peekHeightPx }} />
      {expanded ? (
        <button
          type="button"
          aria-label="Свий разбивката"
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => commitSnapPoint(snapPoints[0])}
        />
      ) : null}
      <Drawer
        open
        modal={false}
        dismissible={false}
        // Prevent Vaul from fighting pointer-events on body while this
        // always-open peek drawer sits above the claim list.
        noBodyStyles
        snapPoints={snapPoints}
        activeSnapPoint={activeSnapPoint}
        setActiveSnapPoint={commitSnapPoint}
      >
        {/* Vaul offsets by windowHeight − snapHeight; shell is h-dvh, panel matches expanded px snap. */}
        <DrawerContent
          showOverlay={false}
          // Own transform + --snap-point-height: Vaul delayed-snap CSS can leave
          // computed translate stuck at the previous offset after React re-renders
          // wipe Vaul's imperative transform — parking pe-auto header/summary over
          // the claim search. pointer-events none still required on the h-dvh shell.
          style={{
            pointerEvents: 'none',
            transform: `translate3d(0px, ${snapOffsetPx}px, 0px)`,
            ['--snap-point-height' as string]: `${snapOffsetPx}px`,
          }}
          className="pointer-events-none z-50 mt-0 h-dvh gap-0 border-0 bg-transparent"
        >
          <div
            ref={contentRef}
            className={cn(
              'pointer-events-none mx-auto flex w-full max-w-lg min-h-0 flex-col sticky-surface px-4 pt-2',
              'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
              'rounded-t-xl',
            )}
            style={{
              // Keep panel height in lockstep with Vaul expanded snap (px).
              height: expandedHeightPx,
              pointerEvents: 'none',
            }}
          >
            <div
              ref={headerRef}
              className="pointer-events-auto order-1 shrink-0 flex flex-col border-b pb-3"
            >
              <button
                type="button"
                className="mx-auto flex w-full flex-col items-center gap-3 py-1"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={toggleSnap}
              >
                <span className="bg-muted mx-auto h-1.5 w-10 shrink-0 rounded-full" />
                <span className="flex w-full items-center justify-between gap-3 py-0.5 text-left">
                  <DrawerTitle className="text-base font-semibold">
                    {title}
                  </DrawerTitle>
                  {status}
                </span>
              </button>
            </div>
            <div
              id={detailsId}
              data-testid="claim-share-details"
              className={cn(
                'order-2 min-h-0 flex-1 overflow-y-auto',
                expanded ? 'pointer-events-auto pt-3' : 'hidden',
              )}
            >
              {details}
            </div>
            <div
              ref={summaryRef}
              className={cn(
                'pointer-events-auto shrink-0 pt-3',
                expanded ? 'order-3 border-t' : 'order-2',
              )}
            >
              {summary}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
