export interface OcrActivityBarProps {
  isUploading: boolean
  isScanning: boolean
}

export function OcrActivityBar({
  isUploading,
  isScanning,
}: OcrActivityBarProps) {
  const busy = isUploading || isScanning
  if (!busy) return null

  const label = isUploading ? 'Качване…' : 'Разпознаване…'

  return (
    <div
      className="ocr-activity-bar"
      role="progressbar"
      aria-valuetext={label}
      aria-live="polite"
    >
      <div className="ocr-activity-bar__track" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
