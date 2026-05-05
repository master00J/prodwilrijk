'use client'

import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react'

export type SignaturePadHandle = {
  clear: () => void
  toDataURL: () => string | null
  isEmpty: () => boolean
}

type Props = {
  label: string
  className?: string
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { label, className = '' },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  const setupCanvas = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const w = c.offsetWidth
    const h = c.offsetHeight
    if (w === 0 || h === 0) return
    c.width = w * dpr
    c.height = h * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    hasInk.current = false
    last.current = null
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => setupCanvas())
    return () => cancelAnimationFrame(id)
  }, [setupCanvas])

  const clear = useCallback(() => {
    setupCanvas()
  }, [setupCanvas])

  useImperativeHandle(ref, () => ({
    clear,
    toDataURL: () => {
      const c = canvasRef.current
      if (!c || !hasInk.current) return null
      return c.toDataURL('image/png')
    },
    isEmpty: () => !hasInk.current,
  }))

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    if ('touches' in e && e.touches[0]) {
      return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top }
    }
    if ('clientX' in e) {
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    return null
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const p = pos(e)
    if (!p) return
    drawing.current = true
    last.current = p
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !last.current) return
    const p = pos(e)
    if (!p) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    hasInk.current = true
  }

  const endDraw = () => {
    drawing.current = false
    last.current = null
  }

  return (
    <div className={className}>
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <canvas
        ref={canvasRef}
        className="w-full h-32 border-2 border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={e => {
          e.preventDefault()
          startDraw(e)
        }}
        onTouchMove={e => {
          e.preventDefault()
          draw(e)
        }}
        onTouchEnd={e => {
          e.preventDefault()
          endDraw()
        }}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        Wissen
      </button>
    </div>
  )
})
