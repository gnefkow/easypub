import type { HTMLAttributes } from 'react'

type TagBadgeProps = HTMLAttributes<HTMLSpanElement>

export default function TagBadge({ className = '', ...props }: TagBadgeProps) {
  return (
    <span
      {...props}
      className={`rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ${className}`}
    />
  )
}
