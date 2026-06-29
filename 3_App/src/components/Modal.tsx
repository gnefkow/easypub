import { createPortal } from 'react-dom'
import { type ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title?: string
  onClose?: () => void
  children: ReactNode
  widthClassName?: string
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  widthClassName = 'max-w-md',
}: ModalProps) {
  if (!open || typeof document === 'undefined') {
    return null
  }

  let modalRoot = document.getElementById('modal-root')
  if (!modalRoot) {
    modalRoot = document.createElement('div')
    modalRoot.id = 'modal-root'
    document.body.appendChild(modalRoot)
  }

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Modal'}
    >
      <div className={`modal-card ${widthClassName}`}>
        {title && (
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                aria-label="Close modal"
              >
                X
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    modalRoot
  )
}
