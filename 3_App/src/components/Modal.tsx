import { createPortal } from 'react-dom'
import { type ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title?: string
  onClose?: () => void
  children: ReactNode
  widthClassName?: string
  stickyFooter?: boolean
  footer?: ReactNode
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  widthClassName = 'max-w-md',
  stickyFooter = false,
  footer,
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

  const cardClassName = [
    'modal-card',
    widthClassName,
    stickyFooter ? 'modal-card--sticky-footer' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const titleRow = title ? (
    <div
      className={
        stickyFooter
          ? 'modal-card__header flex items-center justify-between'
          : 'flex items-center justify-between'
      }
    >
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
  ) : null

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Modal'}
    >
      <div className={cardClassName}>
        {titleRow}
        {stickyFooter ? (
          <>
            <div className="modal-card__body">{children}</div>
            {footer ? <div className="modal-card__footer">{footer}</div> : null}
          </>
        ) : (
          children
        )}
      </div>
    </div>,
    modalRoot
  )
}
