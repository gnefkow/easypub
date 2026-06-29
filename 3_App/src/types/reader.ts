export type TextBlock = {
  id: string
  blockId?: string
  tag: string
  html: string
  selector: string
  href: string
  queuedForDelete?: boolean
  appendedFromId?: string
  appendedHtml?: string
  appendedPosition?: 'prepend' | 'append'
  queuedWithAppend?: boolean
  originalHtml?: string
  order: number
  justify?: string
  spellcheckHtml?: string
}

export type LoadedSection = {
  index: number
  href: string
  blocks: TextBlock[]
}

export type SectionMeta = {
  index: number
  href: string
  title: string
  loading?: boolean
}

export type Endnote = {
  uid: string
  text: string
}

export type QueueItem = {
  id: string
  action:
    | 'merge'
    | 'change-tag'
    | 'delete-block'
    | 'append-block'
    | 'rename-section'
    | 'split-section'
    | 'edit-text'
    | 'edit-html'
    | 'change-justify'
    | 'add-block'
  fromHref: string
  toHref: string
  label: string
  selector?: string
  fromTag?: string
  toTag?: string
  fromSelector?: string
  toSelector?: string
  direction?: 'previous' | 'following'
  blockId?: string
  fromBlockId?: string
  toBlockId?: string
  splitBlockId?: string
  blockIndex?: number
  fromIndex?: number
  toIndex?: number
  title?: string
  splitIndex?: number
  newHref?: string
  text?: string
  html?: string
  fromJustify?: string
  toJustify?: string
  afterBlockId?: string
  afterSelector?: string
  afterIndex?: number
  insertedText?: string
  insertedTagHint?: string
}
