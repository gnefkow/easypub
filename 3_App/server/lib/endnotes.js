import path from 'path'
import * as cheerio from 'cheerio'
import {
  getManifestItems,
  getSpineItems,
  setManifestItems,
  setSpineItems,
  resolveHref,
} from './opf.js'

export const PLACEHOLDER_REGEX = /&lt;a&gt;placeholder-([a-z0-9]+)&lt;\/a&gt;/g
export const PLACEHOLDER_REGEX_RAW = /<a>placeholder-([a-z0-9]+)<\/a>/g
export const NOTEREF_REGEX = /<a[^>]*href="[^"]*endnotes\.xhtml#note-(\d+)"[^>]*>\d+<\/a>/g

const EPUB_NS = 'http://www.idpf.org/2007/ops'

/** Ensure content docs that use epub:type declare xmlns:epub (Calibre/pdftohtml often omit it). */
export const ensureEpubNamespace = (html) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const htmlEl = $('html')
  if (!htmlEl.length) {
    return html
  }
  if (htmlEl.attr('xmlns:epub') === EPUB_NS) {
    return html
  }
  htmlEl.attr('xmlns:epub', EPUB_NS)
  return $.xml()
}

export const writeEndnotes = (zip, opfPath, opfData, endnotes) => {
  if (!endnotes || !endnotes.length) return

  const endnotesByUid = new Map(endnotes.map((en) => [en.uid, en]))
  const manifestItems = getManifestItems(opfData)
  const spineItems = getSpineItems(opfData)
  const hrefById = new Map(manifestItems.map((item) => [item['@_id'], item['@_href']]))

  // Map old note numbers to UIDs (endnotes array order = last save order)
  const oldNoteNumToUid = new Map()
  endnotes.forEach((en, i) => {
    oldNoteNumToUid.set(String(i + 1), en.uid)
  })

  // Walk spine in order: convert old noterefs to placeholders, then collect all placeholders
  const orderedUids = []
  const seenUids = new Set()
  const contentDocUpdates = []

  for (const spineItem of spineItems) {
    const href = hrefById.get(spineItem['@_idref'])
    if (!href) continue
    const fullPath = resolveHref(opfPath, href)
    const entry = zip.getEntry(fullPath)
    if (!entry) continue

    let xhtml = entry.getData().toString('utf-8')

    // Convert old noteref <a> elements from prior saves into placeholder text
    xhtml = xhtml.replace(new RegExp(NOTEREF_REGEX.source, 'g'), (_match, oldNum) => {
      const uid = oldNoteNumToUid.get(oldNum)
      if (!uid) return ''
      return `&lt;a&gt;placeholder-${uid}&lt;/a&gt;`
    })

    // Now find ALL placeholders (both from edited blocks and from converted old noterefs)
    const placeholderMatches = [...xhtml.matchAll(new RegExp(PLACEHOLDER_REGEX.source, 'g')), ...xhtml.matchAll(new RegExp(PLACEHOLDER_REGEX_RAW.source, 'g'))]
    for (const match of placeholderMatches) {
      const uid = match[1]
      if (!seenUids.has(uid) && endnotesByUid.has(uid)) {
        seenUids.add(uid)
        orderedUids.push(uid)
      }
    }

    contentDocUpdates.push({ fullPath, href, xhtml })
  }

  // Add any endnotes that weren't placed in body text (append at end)
  for (const en of endnotes) {
    if (!seenUids.has(en.uid)) {
      orderedUids.push(en.uid)
    }
  }

  const uidToNumber = new Map(orderedUids.map((uid, i) => [uid, i + 1]))
  const endnotesHref = 'text/endnotes.xhtml'

  // Replace placeholders with correctly numbered <a> elements
  for (const doc of contentDocUpdates) {
    let updated = doc.xhtml

    for (const regex of [PLACEHOLDER_REGEX, PLACEHOLDER_REGEX_RAW]) {
      updated = updated.replace(new RegExp(regex.source, 'g'), (_match, uid) => {
        const num = uidToNumber.get(uid)
        if (!num) return _match
        return `<a href="${endnotesHref}#note-${num}" id="noteref-${num}" epub:type="noteref">${num}</a>`
      })
    }

    if (updated !== doc.xhtml) {
      // Noterefs use epub:type; Calibre docs often lack xmlns:epub — required for valid XHTML.
      updated = ensureEpubNamespace(updated)
      zip.updateFile(doc.fullPath, Buffer.from(updated, 'utf-8'))
    }
  }

  // Track which content doc each uid came from (for backlinks)
  const uidToHref = new Map()
  for (const spineItem of spineItems) {
    const href = hrefById.get(spineItem['@_idref'])
    if (!href) continue
    const fullPath = resolveHref(opfPath, href)
    const entry = zip.getEntry(fullPath)
    if (!entry) continue
    const content = entry.getData().toString('utf-8')
    for (const [, uid] of orderedUids.entries()) {
      if (!uidToHref.has(uid) && content.includes(`id="noteref-${uidToNumber.get(uid)}"`)) {
        uidToHref.set(uid, href)
      }
    }
  }

  // Build endnotes.xhtml with backlinks
  const listItems = orderedUids
    .map((uid, i) => {
      const num = i + 1
      const en = endnotesByUid.get(uid)
      const text = en?.text || ''
      const backHref = uidToHref.get(uid) || ''
      const backlink = backHref
        ? ` <a href="${backHref}#noteref-${num}" epub:type="backlink">↩</a>`
        : ''
      return `\t\t\t<li id="note-${num}" epub:type="endnote">\n\t\t\t\t<p>${text}${backlink}</p>\n\t\t\t</li>`
    })
    .join('\n')

  const endnotesXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
\t<title>Endnotes</title>
</head>
<body epub:type="backmatter">
\t<section id="endnotes" epub:type="endnotes">
\t\t<h2 epub:type="title">Endnotes</h2>
\t\t<ol>
${listItems}
\t\t</ol>
\t</section>
</body>
</html>
`

  const opfDir = path.posix.dirname(opfPath)
  const endnotesFullPath = path.posix.normalize(path.posix.join(opfDir, endnotesHref))
  const existing = zip.getEntry(endnotesFullPath)
  if (existing) {
    zip.updateFile(endnotesFullPath, Buffer.from(endnotesXhtml, 'utf-8'))
  } else {
    zip.addFile(endnotesFullPath, Buffer.from(endnotesXhtml, 'utf-8'))
  }

  const alreadyInManifest = manifestItems.some(
    (item) => item['@_href'] === endnotesHref
  )
  if (!alreadyInManifest) {
    manifestItems.push({
      '@_id': 'endnotes.xhtml',
      '@_href': endnotesHref,
      '@_media-type': 'application/xhtml+xml',
    })
    setManifestItems(opfData, manifestItems)
  }

  const alreadyInSpine = spineItems.some(
    (item) => item['@_idref'] === 'endnotes.xhtml'
  )
  if (!alreadyInSpine) {
    spineItems.push({ '@_idref': 'endnotes.xhtml' })
    setSpineItems(opfData, spineItems)
  }
}
