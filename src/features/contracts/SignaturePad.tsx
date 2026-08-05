import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Fixed backing-store size — the canvas is stretched by CSS, the bitmap is not. */
const WIDTH = 640
const HEIGHT = 180

export interface SignaturePadProps {
  /** Called with a PNG data-URL on every stroke end, and with `null` on clear. */
  onChange: (dataUrl: string | null) => void
  /**
   * The name typed into the signing form. When present, it can be rendered into
   * the pad as a signature — the keyboard path to signing (see below).
   */
  typedName?: string
  className?: string
}

/**
 * The beneficiary's hand-drawn signature.
 *
 * Pointer events (not mouse events) so the pad works identically with a mouse,
 * a finger and a stylus — the demo is shown on a tablet as often as a laptop.
 *
 * Drawing is inherently pointer-only, and signing is gated on a signature
 * existing — so on its own this pad dead-ends a keyboard or switch user partway
 * through the flow, with no way forward. `typedName` provides the equivalent
 * path: it writes the name already entered on the form into the pad as the
 * signature mark, reachable by Tab and operable by Enter.
 */
export function SignaturePad({ onChange, typedName, className }: SignaturePadProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const context = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // Reads the ink colour from the theme so the pad works in dark mode too.
    ctx.strokeStyle = getComputedStyle(canvas).color || '#000'
    return ctx
  }, [])

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    }
  }

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = context()
    if (!ctx) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    const { x, y } = pointFrom(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // A tap alone is still a mark.
    ctx.lineTo(x + 0.01, y)
    ctx.stroke()
    setHasInk(true)
  }

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = context()
    if (!ctx) return
    const { x, y } = pointFrom(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handleUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(null)
  }

  /** Writes the typed name into the pad — the keyboard equivalent of drawing. */
  const signWithTypedName = () => {
    const canvas = canvasRef.current
    const ctx = context()
    const name = typedName?.trim()
    if (!canvas || !ctx || !name) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = ctx.strokeStyle
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Shrink to fit rather than overflow a long name off the edge of the pad.
    let fontSize = 64
    do {
      ctx.font = `italic ${fontSize}px "Segoe Script", "Snell Roundhand", cursive`
      fontSize -= 2
    } while (ctx.measureText(name).width > WIDTH - 48 && fontSize > 16)

    ctx.fillText(name, WIDTH / 2, HEIGHT / 2)
    setHasInk(true)
    onChange(canvas.toDataURL('image/png'))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative overflow-hidden rounded-lg border border-dashed border-input bg-card">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          data-testid="signature-pad"
          data-has-ink={hasInk ? 'true' : 'false'}
          aria-label={t('contracts.signing.padLabel')}
          role="img"
          className="block h-40 w-full cursor-crosshair touch-none text-terracotta-ink"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          onPointerCancel={handleUp}
        />
        {!hasInk ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {t('contracts.signing.padHint')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('contracts.signing.padKeyboardHint')}</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={signWithTypedName}
            disabled={!typedName?.trim()}
            data-testid="signature-use-typed-name"
          >
            {t('contracts.signing.useTypedName')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasInk}>
            {t('contracts.signing.clearPad')}
          </Button>
        </div>
      </div>
    </div>
  )
}
