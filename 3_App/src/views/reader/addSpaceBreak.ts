import type { QueueItem, TextBlock } from '../../types/reader'
import type { InsertPosition } from './addBlock'
import { normalizeOrders } from './addBlock'

export const getAddSpaceBreakQueueItemId = (
  anchorBlock: TextBlock,
  position: InsertPosition
) => {
  const key = anchorBlock.blockId || anchorBlock.selector || String(anchorBlock.order)
  return `add-space-break|${position}|${anchorBlock.href}|${key}`
}

export const buildAddSpaceBreakQueueItem = (
  anchorBlock: TextBlock,
  position: InsertPosition
): QueueItem => {
  const positionLabel = position === 'before' ? 'before' : 'after'
  return {
    id: getAddSpaceBreakQueueItemId(anchorBlock, position),
    action: 'add-space-break',
    fromHref: anchorBlock.href,
    toHref: anchorBlock.href,
    label: `Add space break ${positionLabel} ${anchorBlock.tag.toUpperCase()}`,
    afterBlockId: anchorBlock.blockId,
    afterSelector: anchorBlock.selector,
    afterIndex: anchorBlock.order,
    insertPosition: position,
  }
}

const makeTempHrBlockId = (anchorBlock: TextBlock) => {
  const entropy =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `temp-add-space-break|${anchorBlock.href}|${entropy}`
}

export const optimisticallyInsertSpaceBreak = (
  blocks: TextBlock[],
  anchorBlock: TextBlock,
  position: InsertPosition
): { nextBlocks: TextBlock[]; tempBlockId: string } | null => {
  const anchorIndex = blocks.findIndex((block) => block.id === anchorBlock.id)
  if (anchorIndex === -1) {
    return null
  }

  const tempBlockId = makeTempHrBlockId(anchorBlock)
  const insertIndex = position === 'before' ? anchorIndex : anchorIndex + 1

  const nextBlock: TextBlock = {
    id: tempBlockId,
    blockId: undefined,
    tag: 'hr',
    html: '',
    selector: '',
    href: anchorBlock.href,
    order: 0,
    justify: undefined,
  }

  const nextBlocks = normalizeOrders([
    ...blocks.slice(0, insertIndex),
    nextBlock,
    ...blocks.slice(insertIndex),
  ])

  return { nextBlocks, tempBlockId }
}
