const ALLOWED_TAGS = new Set(['strong', 'em', 'br', 'sup', 'sub'])

export default function sanitizeInlineHtml(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<div>${html}</div>`,
    'text/html',
  )
  const root = doc.body.firstElementChild
  if (!root) return ''

  walkAndSanitize(root)

  return root.innerHTML
}

function walkAndSanitize(node: Node): void {
  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.tagName.toLowerCase()

      if (!ALLOWED_TAGS.has(tag)) {
        el.replaceWith(...Array.from(el.childNodes))
        walkAndSanitize(node)
        return
      }

      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name)
      }

      walkAndSanitize(el)
    }
  }
}

export function stripHtmlTags(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent ?? ''
}
