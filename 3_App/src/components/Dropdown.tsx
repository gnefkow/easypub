import { useState, type ReactNode } from 'react'
import { isValidElement, cloneElement, type ReactElement } from 'react'
import { Button } from 'counterfoil-starter-kit'

type DropdownVariant = 'button' | 'text'
type DropdownSize = 'sm' | 'md' | 'lg'

type DropdownItem = {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
}

type DropdownProps = {
  label?: string
  items: DropdownItem[]
  variant?: DropdownVariant
  size?: DropdownSize
  showText?: boolean
  showIconLeft?: boolean
  showIconRight?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

const sizeClasses: Record<DropdownSize, string> = {
  sm: 'p-2 text-xs',
  md: 'p-3 text-sm',
  lg: 'p-4 text-base',
}

const iconSizes: Record<DropdownSize, number> = {
  sm: 12,
  md: 16,
  lg: 24,
}

export default function Dropdown({
  label = '',
  items,
  variant = 'button',
  size = 'md',
  showText = true,
  showIconLeft,
  showIconRight,
  iconLeft,
  iconRight,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const iconSize = iconSizes[size]
  const displayIconLeft = showIconLeft ?? Boolean(iconLeft)
  const displayIconRight = showIconRight ?? Boolean(iconRight)

  const renderIcon = (icon: ReactNode) => {
    if (!icon) return null
    if (isValidElement(icon)) {
      return cloneElement(icon as ReactElement<{ size?: number }>, {
        size: iconSize,
      })
    }
    return icon
  }

  // Determine icon and iconPosition for Counterfoil Button
  const getIconProps = () => {
    if (displayIconRight && iconRight) {
      return {
        icon: renderIcon(iconRight),
        iconPosition: 'right' as const,
      }
    }
    if (displayIconLeft && iconLeft) {
      return {
        icon: renderIcon(iconLeft),
        iconPosition: 'left' as const,
      }
    }
    return {}
  }

  return (
    <div className="relative" data-component="Dropdown">
      {variant === 'button' ? (
        <Button
          size={size}
          onClick={() => setOpen((prev) => !prev)}
          {...getIconProps()}
        >
          {showText ? label : null}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`inline-flex items-center gap-2 rounded-md text-black hover:bg-slate-100 ${sizeClasses[size]}`}
        >
          {displayIconLeft && (
            <span className="inline-flex items-center text-black">
              {renderIcon(iconLeft)}
            </span>
          )}
          {showText && label}
          {displayIconRight && (
            <span className="inline-flex items-center text-black">
              {renderIcon(iconRight)}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border border-slate-200 bg-white shadow-lg z-50">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              data-component="button"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              disabled={item.disabled}
              className="w-full px-3 py-2 text-left text-sm text-black hover:bg-slate-50 disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
