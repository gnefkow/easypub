const PLACEHOLDER_RAW_RE = /<a>placeholder-([a-z0-9]+)<\/a>/gi
const PLACEHOLDER_ESCAPED_RE = /&lt;a&gt;placeholder-([a-z0-9]+)&lt;\/a&gt;/gi

function toEndnoteTag(uid: string, selectedEndnoteUid: string | null | undefined): string {
  const selectedClass =
    selectedEndnoteUid && uid === selectedEndnoteUid ? ' endnote-tag--selected' : ''
  return `<span class="endnote-tag${selectedClass}" data-endnote-uid="${uid}">${uid}</span>`
}

function replacePlaceholders(
  html: string,
  selectedEndnoteUid: string | null | undefined,
  regex: RegExp,
): string {
  regex.lastIndex = 0
  return html.replace(regex, (_match, uid: string) => toEndnoteTag(uid, selectedEndnoteUid))
}

/** View-time only: turn placeholder strings into styled endnote-tag spans. */
export function decorateEndnotePlaceholders(
  html: string,
  selectedEndnoteUid?: string | null,
): string {
  if (!html) return html
  let next = replacePlaceholders(html, selectedEndnoteUid, PLACEHOLDER_ESCAPED_RE)
  next = replacePlaceholders(next, selectedEndnoteUid, PLACEHOLDER_RAW_RE)
  return next
}