import type { QueueItem, TextBlock } from '../../types/reader'

const DEFAULT_INSERTED_TEXT = 'New Text Block'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br />')

const normalizeOrders = (blocks: TextBlock[]) =>
  blocks.map((block, index) => ({ ...block, order: index }))

export const getInsertedTagHint = (afterBlock: TextBlock) =>
  afterBlock.tag.toLowerCase() === 'li' ? 'li' : 'p'

export const getAddBlockQueueItemId = (afterBlock: TextBlock) => {
  const key = afterBlock.blockId || afterBlock.selector || String(afterBlock.order)
  return `add-block|${afterBlock.href}|${key}`
}

export const buildAddBlockQueueItem = (
  afterBlock: TextBlock,
  insertedText: string = DEFAULT_INSERTED_TEXT
): QueueItem => {
  const insertedTagHint = getInsertedTagHint(afterBlock)
  return {
    id: getAddBlockQueueItemId(afterBlock),
    action: 'add-block',
    fromHref: afterBlock.href,
    toHref: afterBlock.href,
    label: `Add text block after ${afterBlock.tag.toUpperCase()}`,
    afterBlockId: afterBlock.blockId,
    afterSelector: afterBlock.selector,
    afterIndex: afterBlock.order,
    insertedText,
    insertedTagHint,
  }
}

const makeTempBlockId = (afterBlock: TextBlock) => {
  const entropy =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `temp-add-block|${afterBlock.href}|${entropy}`
}

export const optimisticallyInsertBlockAfter = (
  blocks: TextBlock[],
  afterBlock: TextBlock,
  insertedText: string = DEFAULT_INSERTED_TEXT
): { nextBlocks: TextBlock[]; tempBlockId: string } | null => {
  const afterIndex = blocks.findIndex((block) => block.id === afterBlock.id)
  if (afterIndex === -1) {
    return null
  }

  const tempBlockId = makeTempBlockId(afterBlock)
  const nextTag = getInsertedTagHint(afterBlock)

  const nextBlock: TextBlock = {
    id: tempBlockId,
    blockId: undefined,
    tag: nextTag,
    html: escapeHtml(insertedText),
    selector: '',
    href: afterBlock.href,
    order: 0,
    justify: undefined,
  }

  const nextBlocks = normalizeOrders([
    ...blocks.slice(0, afterIndex + 1),
    nextBlock,
    ...blocks.slice(afterIndex + 1),
  ])

  return { nextBlocks, tempBlockId }
}

export const removeOptimisticAddBlock = (
  blocks: TextBlock[],
  tempBlockId: string
): TextBlock[] => normalizeOrders(blocks.filter((block) => block.id !== tempBlockId))

