import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp } from 'lucide-react'

type TooltipPlacement = 'left' | 'center' | 'right'

export function HelpTooltip({ text, label = 'Afficher l’explication', placement = 'center' }: { text: ReactNode; label?: string; placement?: TooltipPlacement }) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  function showTooltip() {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const mobile = window.matchMedia('(max-width: 840px)').matches
    if (mobile) {
      setPanelStyle({ left: 16, right: 16, bottom: 82, width: 'auto' })
    } else {
      const width = 280
      const preferredLeft = placement === 'left' ? rect.left : placement === 'right' ? rect.right - width : rect.left + rect.width / 2 - width / 2
      const left = Math.max(16, Math.min(window.innerWidth - width - 16, preferredLeft))
      setPanelStyle(rect.top > 150
        ? { left, bottom: window.innerHeight - rect.top + 10, width }
        : { left, top: rect.bottom + 10, width })
    }
    setOpen(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      event.currentTarget.blur()
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      showTooltip()
    }
  }

  return (
    <span className="help-tooltip" onMouseEnter={showTooltip} onMouseLeave={() => setOpen(false)}>
      <span
        ref={triggerRef}
        className="help-tooltip-trigger"
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onFocus={showTooltip}
        onBlur={() => setOpen(false)}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); showTooltip() }}
        onKeyDown={handleKeyDown}
      >
        <CircleHelp />
      </span>
      {open && createPortal(<span id={tooltipId} className="help-tooltip-panel portal-tooltip" role="tooltip" style={panelStyle}>{text}</span>, document.body)}
    </span>
  )
}

export function ExplainedLabel({ children, help, placement = 'center' }: { children: ReactNode; help: ReactNode; placement?: TooltipPlacement }) {
  const label = typeof children === 'string' ? `Aide : ${children}` : 'Afficher l’explication de ce bloc'
  return <span className="explained-label">{children}<HelpTooltip text={help} label={label} placement={placement} /></span>
}
