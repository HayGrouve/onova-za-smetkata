import { useEffect, useRef } from 'react'

/**
 * Keeps `--dock-height` on the root in step with a bottom dock pinned over the
 * page, so `scroll-padding-bottom` (styles.css) leaves a focused field clear
 * of it. Where the dock sits in the flow (wide screens) it takes no space and
 * the variable is dropped.
 */
export function useDockInset<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    function update() {
      if (!el) return
      if (getComputedStyle(el).position === 'fixed') {
        root.style.setProperty('--dock-height', `${el.offsetHeight}px`)
      } else {
        root.style.removeProperty('--dock-height')
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      root.style.removeProperty('--dock-height')
    }
  }, [])
  return ref
}
