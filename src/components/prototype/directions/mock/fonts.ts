/** PROTOTYPE — load a Google Fonts stylesheet for one direction (prototype only; production would self-host). */
import { useEffect } from 'react'

export function useGoogleFont(href: string) {
  useEffect(() => {
    if (document.querySelector(`link[data-proto-font="${href}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.protoFont = href
    document.head.appendChild(link)
  }, [href])
}
