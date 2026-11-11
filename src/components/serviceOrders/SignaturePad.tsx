import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
  className?: string
}

/**
 * Canvas de assinatura do cliente (toque / mouse / caneta).
 * Traço suave (curvas quadráticas), fundo branco, exporta PNG com fundo
 * opaco para o storage do PocketBase.
 */
export function SignaturePad({ onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const dirty = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  // Inicializa o bitmap com fundo branco e re-renderiza a linha-guia.
  const paintBackground = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#e2e8f0'
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(24, canvas.height - 40)
    ctx.lineTo(canvas.width - 24, canvas.height - 40)
    ctx.stroke()
    ctx.setLineDash([])
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    paintBackground(canvas)
  }, [])

  const getPos = (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const startStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = getPos(e)
  }

  const extendStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const pos = getPos(e)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // Curva quadrática com o ponto médio: traço suave mesmo em movimento rápido.
    const midX = (last.current.x + pos.x) / 2
    const midY = (last.current.y + pos.y) / 2
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.quadraticCurveTo(last.current.x, last.current.y, midX, midY)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    last.current = pos
    if (!dirty.current) {
      dirty.current = true
      setHasInk(true)
    }
  }

  const endStroke = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    if (dirty.current) {
      onChange?.(exportPng())
    }
  }

  /** PNG com fundo branco opaco (o bitmap já é pintado de branco). */
  const exportPng = (): string => {
    const canvas = canvasRef.current!
    return canvas.toDataURL('image/png')
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    paintBackground(canvas)
    dirty.current = false
    setHasInk(false)
    onChange?.(null)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <canvas
        ref={canvasRef}
        width={600}
        height={220}
        className="touch-none w-full cursor-crosshair rounded-md border border-input bg-white"
        onPointerDown={startStroke}
        onPointerMove={extendStroke}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <PenLine className="h-3.5 w-3.5" />
          Assine acima com o dedo, caneta ou mouse
        </span>
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={!hasInk}>
          <Eraser className="h-4 w-4" />
          Limpar
        </Button>
      </div>
    </div>
  )
}
