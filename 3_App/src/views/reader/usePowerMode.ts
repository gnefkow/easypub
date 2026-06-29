import { useCallback, useState } from 'react'

export type BlockRef = { sectionIndex: number; blockId: string }

export function isSameBlockRef(a: BlockRef | null, b: BlockRef | null) {
  return !!a && !!b && a.sectionIndex === b.sectionIndex && a.blockId === b.blockId
}

export function usePowerModeState() {
  const [powerMode, setPowerMode] = useState(false)
  const [focusedBlock, setFocusedBlock] = useState<BlockRef | null>(null)
  const [editingBlock, setEditingBlock] = useState<BlockRef | null>(null)

  const togglePowerMode = useCallback(() => {
    setPowerMode((prev) => !prev)
  }, [])

  const clearFocus = useCallback(() => {
    setFocusedBlock(null)
  }, [])

  const stopEditing = useCallback(() => {
    setEditingBlock(null)
  }, [])

  return {
    powerMode,
    setPowerMode,
    togglePowerMode,
    focusedBlock,
    setFocusedBlock,
    editingBlock,
    setEditingBlock,
    clearFocus,
    stopEditing,
  }
}

