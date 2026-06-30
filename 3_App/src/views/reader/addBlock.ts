import type { QueueItem, TextBlock } from '../../types/reader'

export type InsertPosition = 'before' | 'after'

const DEFAULT_INSERTED_TEXT = 'New Text Block'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br />')

export const normalizeOrders = (blocks: TextBlock[]) =>
  blocks.map((block, index) => ({ ...block, order: index }))

export const getInsertedTagHint = (afterBlock: TextBlock) =>
  afterBlock.tag.toLowerCase() === 'li' ? 'li' : 'p'

export const getAddBlockQueueItemId = (
  anchorBlock: TextBlock,
  position: InsertPosition
) => {
  const key = anchorBlock.blockId || anchorBlock.selector || String(anchorBlock.order)
  return `add-block|${position}|${anchorBlock.href}|${key}`
}

export const buildAddBlockQueueItem = (
  anchorBlock: TextBlock,
  position: InsertPosition,
  insertedText: string = DEFAULT_INSERTED_TEXT
): QueueItem => {
  const insertedTagHint = getInsertedTagHint(anchorBlock)
  const positionLabel = position === 'before' ? 'before' : 'after'
  return {
    id: getAddBlockQueueItemId(anchorBlock, position),
    action: 'add-block',
    fromHref: anchorBlock.href,
    toHref: anchorBlock.href,
    label: `Add text block ${positionLabel} ${anchorBlock.tag.toUpperCase()}`,
    afterBlockId: anchorBlock.blockId,
    afterSelector: anchorBlock.selector,
    afterIndex: anchorBlock.order,
    insertedText,
    insertedTagHint,
    insertPosition: position,
  }
}

const makeTempBlockId = (anchorBlock: TextBlock) => {
  const entropy =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `temp-add-block|${anchorBlock.href}|${entropy}`
}

export const optimisticallyInsertBlock = (
  blocks: TextBlock[],
  anchorBlock: TextBlock,
  position: InsertPosition,
  insertedText: string = DEFAULT_INSERTED_TEXT
): { nextBlocks: TextBlock[]; tempBlockId: string } | null => {
  const anchorIndex = blocks.findIndex((block) => block.id === anchorBlock.id)
  if (anchorIndex === -1) {
    return null
  }

  const tempBlockId = makeTempBlockId(anchorBlock)
  const insertIndex = position === 'before' ? anchorIndex : anchorIndex + 1
  const nextTag = getInsertedTagHint(anchorBlock)

  const nextBlock: TextBlock = {
    id: tempBlockId,
    blockId: undefined,
    tag: nextTag,
    html: escapeHtml(insertedText),
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

/** @deprecated Use optimisticallyInsertBlock with position 'after' */
export const optimisticallyInsertBlockAfter = (
  blocks: TextBlock[],
  afterBlock: TextBlock,
  insertedText?: string
) => optimisticallyInsertBlock(blocks, afterBlock, 'after', insertedText)

export const removeOptimisticAddBlock = (
  blocks: TextBlock[],
  tempBlockId: string
): TextBlock[] => normalizeOrders(blocks.filter((block) => block.id !== tempBlockId))
