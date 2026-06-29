import type { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  background?: 'white' | 'muted'
  padding?: 'sm' | 'md' | 'lg'
}

const backgroundClasses = {
  white: 'bg-white',
  muted: 'bg-slate-50',
}

const paddingClasses = {
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
}

export default function Card({
  background = 'white',
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-lg border border-slate-200 shadow-sm ${backgroundClasses[background]} ${paddingClasses[padding]} ${className}`}
    />
  )
}
