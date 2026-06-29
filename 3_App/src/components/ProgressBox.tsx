import { Check } from 'lucide-react'
import { Button } from 'counterfoil-starter-kit'
import Modal from './Modal'

type ProgressBoxProps = {
  title: string
  total: number
  completed: number
  phase:
    | 'idle'
    | 'loading-queue'
    | 'applying'
    | 'writing-epub'
    | 'reloading'
    | 'complete'
  visible: boolean
  showDebug: boolean
  onDismiss: () => void
}

export default function ProgressBox({
  title,
  total,
  completed,
  phase,
  visible,
  onDismiss,
}: ProgressBoxProps) {
  const isComplete = phase === 'complete'
  const displayTitle = isComplete ? 'Epub update complete!' : title
  const phaseLabels: Record<string, string> = {
    'loading-queue': 'Loading queue',
    applying: 'Applying changes',
    'writing-epub': 'Writing epub',
    reloading: 'Reloading epub',
  }

  const steps = [
    {
      id: 'loading',
      label: phaseLabels['loading-queue'],
      done: phase !== 'loading-queue',
    },
    ...Array.from({ length: total }).map((_, index) => ({
      id: `change-${index}`,
      label: `Change ${index + 1}`,
      done: isComplete || completed > index,
    })),
    {
      id: 'writing',
      label: phaseLabels['writing-epub'],
      done: isComplete || phase === 'reloading' || phase === 'idle',
    },
    {
      id: 'reloading',
      label: phaseLabels['reloading'],
      done: isComplete || phase === 'idle',
    },
  ]

  return (
    <Modal open={visible} title={displayTitle} onClose={onDismiss}>
      <div
        className="mt-3 max-h-64 space-y-2 overflow-auto text-xs text-slate-700"
        data-component="ProgressBox"
      >
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2">
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                step.done
                  ? 'border-emerald-400 bg-emerald-100'
                  : 'border-slate-300'
              }`}
            >
              {step.done && <Check className="h-3 w-3 text-black" />}
            </span>
            <span>{step.label}</span>
          </div>
        ))}
      </div>
      {isComplete && (
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="lg" onClick={onDismiss}>
            Great!
          </Button>
        </div>
      )}
    </Modal>
  )
}
