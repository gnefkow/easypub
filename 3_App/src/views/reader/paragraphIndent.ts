const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

export function shouldIndentParagraph(
  tag: string,
  blockIndex: number,
  previousBlockTag: string | null
): boolean {
  if (tag !== 'p') {
    return false
  }
  if (blockIndex === 0) {
    return false
  }
  if (!previousBlockTag) {
    return false
  }
  const prev = previousBlockTag.toLowerCase()
  if (prev === 'hr' || HEADING_TAGS.has(prev)) {
    return false
  }
  return true
}
