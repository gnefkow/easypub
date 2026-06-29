import type { ReactNode } from 'react'

type TooltipProps = {
  label: string
  children: ReactNode
}

export default function Tooltip({ label, children }: TooltipProps) {
  return (
    <div className="group/tooltip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/tooltip:opacity-100">
        {label}
      </span>
    </div>
  )
}
