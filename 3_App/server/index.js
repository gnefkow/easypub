import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import AdmZip from 'adm-zip'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'
import nspell from 'nspell'
import dictionary from 'dictionary-en'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const workingDir = path.join(rootDir, 'workingFiles')
const historyRoot = path.join(workingDir, '.history')

await fs.mkdir(workingDir, { recursive: true })
await fs.mkdir(historyRoot, { recursive: true })

const spellchecker = nspell(dictionary.aff, dictionary.dic)

const WORD_RE = /[\p{L}\p{M}]+/gu

function spellcheckBlockHtml(html, customDictionary) {
  const customSet = new Set(customDictionary.map((w) => w.toLowerCase()))
  const $ = cheerio.load(html, null, false)

  function walkTextNodes(node) {
    const children = $(node).contents()
    children.each((_i, child) => {
      if (child.type === 'text') {
        const text = $(child).text()
        const parts = []
        let lastIndex = 0
        for (const match of text.matchAll(WORD_RE)) {
          const word = match[0]
          const idx = match.index
          if (idx > lastIndex) {
            parts.push(text.slice(lastIndex, idx))
          }
          if (word.length <= 1 || /^\d+$/.test(word)) {
            parts.push(word)
          } else if (customSet.has(word.toLowerCase())) {
            parts.push(
              `<span class="spell-dictionary" data-word="${word}">${word}</span>`
            )
          } else if (spellchecker.correct(word)) {
            parts.push(word)
          } else {
            parts.push(
              `<span class="spell-unknown" data-word="${word}">${word}</span>`
            )
          }
          lastIndex = idx + word.length
        }
        if (lastIndex < text.length) {
          parts.push(text.slice(lastIndex))
        }
        if (parts.length > 0) {
          $(child).replaceWith(parts.join(''))
        }
      } else if (child.type === 'tag') {
        walkTextNodes(child)
      }
    })
  }

  walkTextNodes($.root())
  return $.html()
}

function spellcheckBlocks(blocks, customDictionary) {
  return blocks.map((block) => {
    const tag = (block.tag || '').toLowerCase()
    if (tag === 'img') return block
    return {
      ...block,
      spellcheckHtml: spellcheckBlockHtml(block.html, customDictionary),
    }
  })
}

async function readDictionary(filename) {
  const dictPath = path.join(workingDir, `${filename}.dictionary.json`)
  try {
    const data = await fs.readFile(dictPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeDictionary(filename, words) {
  const dictPath = path.join(workingDir, `${filename}.dictionary.json`)
  await fs.writeFile(dictPath, JSON.stringify(words, null, 2), 'utf-8')
}

const storage = multer.diskStorage({
  destination: workingDir,
  filename: async (_req, file, callback) => {
    const original = file.originalname
    const ext = path.extname(original)
    const baseName = path.basename(original, ext)
    let candidate = `${baseName}${ext}`
    let counter = 1
    while (true) {
      try {
        await fs.access(path.join(workingDir, candidate))
        candidate = `${baseName}-${counter}${ext}`
        counter += 1
      } catch {
        break
      }
    }
    callback(null, candidate)
  },
})

const upload = multer({ storage })
const app = express()
const port = process.env.WORKING_FILES_PORT || 5174

app.use('/api', (req, _res, next) => {
  if (req.method !== 'GET' || !req.path.endsWith('/working-files')) {
    console.log(`[api] ${req.method} ${req.originalUrl}`)
  }
  next()
})

const xmlParser = new XMLParser({ ignoreAttributes: false })
const xmlBuilder = new XMLBuilder({ ignoreAttributes: false })

const ensureSafeFilename = (filename) => {
  if (!filename || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename.')
  }
  return filename
}

const historyDirFor = async (filename) => {
  const safe = ensureSafeFilename(filename)
  const dir = path.join(historyRoot, safe)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

const historyLogPathFor = async (filename) => {
  const dir = await historyDirFor(filename)
  return path.join(dir, 'history.json')
}

const readHistory = async (filename) => {
  try {
    const logPath = await historyLogPathFor(filename)
    const raw = await fs.readFile(logPath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

const writeHistory = async (filename, history) => {
  const logPath = await historyLogPathFor(filename)
  await fs.writeFile(logPath, JSON.stringify(history, null, 2), 'utf-8')
}

const appendHistory = async (filename, entry) => {
  const history = await readHistory(filename)
  history.push(entry)
  await writeHistory(filename, history)
  return history
}

const createBackup = async (filename) => {
  const safe = ensureSafeFilename(filename)
  const source = path.join(workingDir, safe)
  const historyDir = await historyDirFor(safe)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupName = `${stamp}.epub`
  const backupPath = path.join(historyDir, backupName)
  await fs.copyFile(source, backupPath)
  return backupName
}

const getContainerOpfPath = (zip) => {
  const containerEntry = zip.getEntry('META-INF/container.xml')
  if (!containerEntry) {
    throw new Error('container.xml not found in EPUB.')
  }
  const xml = zip.readAsText(containerEntry)
  const parsed = xmlParser.parse(xml)
  const rootfiles =
    parsed?.container?.rootfiles?.rootfile ||
    parsed?.container?.rootfiles?.['rootfile']
  const rootfile = Array.isArray(rootfiles) ? rootfiles[0] : rootfiles
  const fullPath = rootfile?.['@_full-path']
  if (!fullPath) {
    throw new Error('OPF path not found in container.xml.')
  }
  return fullPath
}

const parseOpf = (zip, opfPath) => {
  const entry = zip.getEntry(opfPath)
  if (!entry) {
    throw new Error('OPF file not found in EPUB.')
  }
  const xml = zip.readAsText(entry)
  return { xml, data: xmlParser.parse(xml) }
}

const writeOpf = (zip, opfPath, data) => {
  const updatedXml = xmlBuilder.build(data)
  zip.updateFile(opfPath, Buffer.from(updatedXml, 'utf-8'))
}

const PLACEHOLDER_REGEX = /&lt;a&gt;placeholder-([a-z0-9]+)&lt;\/a&gt;/g
const PLACEHOLDER_REGEX_RAW = /<a>placeholder-([a-z0-9]+)<\/a>/g
const NOTEREF_REGEX = /<a[^>]*href="[^"]*endnotes\.xhtml#note-(\d+)"[^>]*>\d+<\/a>/g

const writeEndnotes = (zip, opfPath, opfData, endnotes) => {
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

const escapeXml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const collectTocEntries = (zip, opfPath, opfData) => {
  const manifestItems = getManifestItems(opfData)
  const spineItems = getSpineItems(opfData)
  const hrefById = new Map(manifestItems.map((item) => [item['@_id'], item['@_href']]))

  const entries = []
  const seenHrefs = new Set()

  for (const spineItem of spineItems) {
    const href = hrefById.get(spineItem['@_idref'])
    if (!href) continue
    if (href.endsWith('toc.xhtml') || href.endsWith('toc.ncx')) continue
    if (seenHrefs.has(href)) continue
    seenHrefs.add(href)

    const fullPath = resolveHref(opfPath, href)
    const entry = zip.getEntry(fullPath)
    if (!entry) continue

    let title = ''
    try {
      const xhtml = entry.getData().toString('utf-8')
      const $ = cheerio.load(xhtml, { xmlMode: true })
      title = $('title').text().trim()
      if (!title) {
        title = $('h1, h2, h3, h4, h5, h6').first().text().trim()
      }
    } catch {
      // fall through to filename fallback
    }
    if (!title) {
      title = path.posix.basename(href, '.xhtml')
    }

    entries.push({ href, title })
  }

  const endnotesItem = manifestItems.find(
    (item) => item['@_href'] && item['@_href'].endsWith('endnotes.xhtml')
  )
  if (endnotesItem && !seenHrefs.has(endnotesItem['@_href'])) {
    entries.push({ href: endnotesItem['@_href'], title: 'Endnotes' })
  }

  return entries
}

const writeToc = (zip, opfPath, opfData) => {
  const entries = collectTocEntries(zip, opfPath, opfData)

  const tocXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
\t<title>Table of Contents</title>
</head>
<body epub:type="frontmatter">
\t<nav epub:type="toc">
\t\t<h1>Table of Contents</h1>
\t\t<ol>
${entries.map((e) => `\t\t\t<li><a href="${e.href}">${escapeXml(e.title)}</a></li>`).join('\n')}
\t\t</ol>
\t</nav>
</body>
</html>
`

  const opfDir = path.posix.dirname(opfPath)
  const tocXhtmlPath = path.posix.normalize(path.posix.join(opfDir, 'toc.xhtml'))
  const existingXhtml = zip.getEntry(tocXhtmlPath)
  if (existingXhtml) {
    zip.updateFile(tocXhtmlPath, Buffer.from(tocXhtml, 'utf-8'))
  } else {
    zip.addFile(tocXhtmlPath, Buffer.from(tocXhtml, 'utf-8'))
  }

  const metadata = opfData?.package?.metadata || {}
  const getText = (val) => {
    if (!val) return ''
    if (typeof val === 'string') return val.trim()
    return (val['#text'] ?? val['_'] ?? '').trim() || ''
  }
  const uid = getText(metadata['dc:identifier']) || getText(metadata['dc\\:identifier']) || 'urn:uuid:unknown'
  const bookTitle = getText(metadata['dc:title']) || getText(metadata['dc\\:title']) || 'Unknown Title'

  const tocNcx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
\t<meta name="dtb:uid" content="${escapeXml(uid)}"/>
</head>
<docTitle><text>${escapeXml(bookTitle)}</text></docTitle>
<navMap>
${entries.map((e, i) => `\t<navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
\t\t<navLabel><text>${escapeXml(e.title)}</text></navLabel>
\t\t<content src="${e.href}"/>
\t</navPoint>`).join('\n')}
</navMap>
</ncx>
`

  const tocNcxPath = path.posix.normalize(path.posix.join(opfDir, 'toc.ncx'))
  const existingNcx = zip.getEntry(tocNcxPath)
  if (existingNcx) {
    zip.updateFile(tocNcxPath, Buffer.from(tocNcx, 'utf-8'))
  } else {
    zip.addFile(tocNcxPath, Buffer.from(tocNcx, 'utf-8'))
  }

  const manifestItems = getManifestItems(opfData)

  for (const item of manifestItems) {
    if (item['@_properties'] && item['@_properties'].includes('nav')) {
      item['@_properties'] = item['@_properties'].replace(/\bnav\b/g, '').trim() || undefined
    }
  }

  const existingTocXhtmlItem = manifestItems.find(
    (item) => item['@_href'] && item['@_href'].endsWith('toc.xhtml')
  )
  if (existingTocXhtmlItem) {
    existingTocXhtmlItem['@_id'] = 'toc.xhtml'
    existingTocXhtmlItem['@_href'] = 'toc.xhtml'
    existingTocXhtmlItem['@_media-type'] = 'application/xhtml+xml'
    existingTocXhtmlItem['@_properties'] = 'nav'
  } else {
    manifestItems.push({
      '@_id': 'toc.xhtml',
      '@_href': 'toc.xhtml',
      '@_media-type': 'application/xhtml+xml',
      '@_properties': 'nav',
    })
  }

  let ncxItemId = 'ncx'
  const existingNcxItem = manifestItems.find(
    (item) => item['@_media-type'] === 'application/x-dtbncx+xml'
  )
  if (existingNcxItem) {
    existingNcxItem['@_href'] = 'toc.ncx'
    ncxItemId = existingNcxItem['@_id']
  } else {
    manifestItems.push({
      '@_id': 'ncx',
      '@_href': 'toc.ncx',
      '@_media-type': 'application/x-dtbncx+xml',
    })
  }

  setManifestItems(opfData, manifestItems)

  if (!opfData.package.spine) {
    opfData.package.spine = {}
  }
  opfData.package.spine['@_toc'] = ncxItemId
}

const resolveHref = (opfPath, href) => {
  const opfDir = path.posix.dirname(opfPath)
  return path.posix.normalize(path.posix.join(opfDir, href))
}

const getManifestItems = (opfData) => {
  const manifest = opfData?.package?.manifest
  if (!manifest) {
    return []
  }
  const items = manifest.item || []
  return Array.isArray(items) ? items : [items]
}

const setManifestItems = (opfData, items) => {
  if (!opfData.package.manifest) {
    opfData.package.manifest = {}
  }
  opfData.package.manifest.item = items
}

const getSpineItems = (opfData) => {
  const spine = opfData?.package?.spine
  if (!spine) {
    return []
  }
  const itemrefs = spine.itemref || []
  return Array.isArray(itemrefs) ? itemrefs : [itemrefs]
}

const setSpineItems = (opfData, items) => {
  if (!opfData.package.spine) {
    opfData.package.spine = {}
  }
  opfData.package.spine.itemref = items
}

const mergeHtmlBodies = (aHtml, bHtml) => {
  const $a = cheerio.load(aHtml, { xmlMode: true })
  const $b = cheerio.load(bHtml, { xmlMode: true })
  const aBody = $a('body')
  const bBody = $b('body')
  if (!aBody.length || !bBody.length) {
    throw new Error('Missing <body> in one of the documents.')
  }
  aBody.append(bBody.contents())
  return $a.xml()
}

const allowedTags = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'pre',
  'figure',
  'figcaption',
  'table',
  'ul',
  'ol',
  'section',
  'article',
  'img',
  'hr',
])

const collectAllowedBlocks = (rootNode) => {
  const blocks = []
  const walk = (node) => {
    if (!node) return
    if (node.type === 'tag') {
      const tag = (node.name || '').toLowerCase()
      if (allowedTags.has(tag)) {
        blocks.push(node)
        return
      }
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(rootNode)
  return blocks
}

const ensureBlockIdsInHtml = (html) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const body = $('body').get(0) || $.root().get(0)
  const blocks = collectAllowedBlocks(body)
  let changed = false
  blocks.forEach((node) => {
    const element = $(node)
    if (!element.attr('data-easypub-id')) {
      element.attr('data-easypub-id', randomUUID())
      changed = true
    }
  })
  return changed ? $.xml() : html
}

const findBlockById = ($, blockId) => {
  if (!blockId) {
    return null
  }
  const element = $(`[data-easypub-id="${blockId}"]`).first()
  return element.length ? element : null
}

const findBlockIndexById = ($, blockId) => {
  if (!blockId) {
    return -1
  }
  const body = $('body').get(0) || $.root().get(0)
  const blocks = collectAllowedBlocks(body)
  return blocks.findIndex((node) => {
    const element = $(node)
    return element.attr('data-easypub-id') === blockId
  })
}

const findBlockByIndex = ($, index) => {
  if (typeof index !== 'number') {
    return null
  }
  const body = $('body').get(0) || $.root().get(0)
  const blocks = collectAllowedBlocks(body)
  const node = blocks[index]
  return node ? $(node) : null
}

const changeElementTag = (html, selector, newTag) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = $(selector).first()
  if (!element.length) {
    return html
  }
  const attrs = element.attr()
  const contents = element.contents()
  const replacement = $(`<${newTag}></${newTag}>`)
  if (attrs) {
    replacement.attr(attrs)
  }
  replacement.append(contents)
  element.replaceWith(replacement)
  return $.xml()
}

const changeElementTagByIndex = (html, blockIndex, newTag) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = findBlockByIndex($, blockIndex)
  if (!element || !element.length) {
    return html
  }
  const attrs = element.attr()
  const contents = element.contents()
  const replacement = $(`<${newTag}></${newTag}>`)
  if (attrs) {
    replacement.attr(attrs)
  }
  replacement.append(contents)
  element.replaceWith(replacement)
  return $.xml()
}

const changeElementTagById = (html, blockId, newTag) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = findBlockById($, blockId)
  if (!element || !element.length) {
    return html
  }
  const attrs = element.attr()
  const contents = element.contents()
  const replacement = $(`<${newTag}></${newTag}>`)
  if (attrs) {
    replacement.attr(attrs)
  }
  replacement.append(contents)
  element.replaceWith(replacement)
  return $.xml()
}

const changeElementJustifyById = (html, blockId, justify) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = findBlockById($, blockId)
  if (!element || !element.length) return html
  const existing = element.attr('style') || ''
  const cleaned = existing.replace(/text-align:\s*[^;]+;?/g, '').trim()
  const newStyle = cleaned
    ? `${cleaned}; text-align: ${justify};`
    : `text-align: ${justify};`
  element.attr('style', newStyle)
  return $.xml()
}

const changeElementJustifyByIndex = (html, blockIndex, justify) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = findBlockByIndex($, blockIndex)
  if (!element || !element.length) return html
  const existing = element.attr('style') || ''
  const cleaned = existing.replace(/text-align:\s*[^;]+;?/g, '').trim()
  const newStyle = cleaned
    ? `${cleaned}; text-align: ${justify};`
    : `text-align: ${justify};`
  element.attr('style', newStyle)
  return $.xml()
}

const updateHtmlTitle = (html, title) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const head = $('head')
  const titleElement = $('title')
  if (head.length) {
    if (titleElement.length) {
      titleElement.text(title)
    } else {
      head.prepend(`<title>${title}</title>`)
    }
    return $.xml()
  }
  // Fallback for malformed or namespaced heads
  const titleTag = `<title>${title}</title>`
  const hasTitle = /<title[^>]*>[\s\S]*?<\/title>/i.test(html)
  if (hasTitle) {
    return html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, titleTag)
  }
  const hasHead = /<head[^>]*>/i.test(html)
  if (hasHead) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${titleTag}`)
  }
  return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${titleTag}</head>`)
}

const updateElementTextByIndex = (html, blockIndex, text) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = findBlockByIndex($, blockIndex)
  if (!element || !element.length) {
    return html
  }
  const rootNode = element.get(0)
  if (!rootNode) {
    return html
  }
  const textNodes = []
  const walk = (node) => {
    if (!node) return
    if (node.type === 'text') {
      textNodes.push(node)
      return
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(rootNode)
  if (!textNodes.length) {
    element.prepend(text)
  } else {
    textNodes.forEach((node, idx) => {
      node.data = idx === 0 ? text : ''
    })
  }
  return $.xml()
}

const updateElementTextById = (html, blockId, text) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = findBlockById($, blockId)
  if (!element || !element.length) {
    return html
  }
  const rootNode = element.get(0)
  if (!rootNode) {
    return html
  }
  const textNodes = []
  const walk = (node) => {
    if (!node) return
    if (node.type === 'text') {
      textNodes.push(node)
      return
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(rootNode)
  if (!textNodes.length) {
    element.prepend(text)
  } else {
    textNodes.forEach((node, idx) => {
      node.data = idx === 0 ? text : ''
    })
  }
  return $.xml()
}

const ALLOWED_INLINE_TAGS = new Set(['strong', 'em', 'br', 'sup', 'sub'])

const sanitizeInlineHtml = (fragmentHtml) => {
  const $ = cheerio.load(fragmentHtml, { xmlMode: true, decodeEntities: false })
  const walk = (node) => {
    if (!node) return
    if (node.type === 'tag') {
      const tag = (node.name || '').toLowerCase()
      if (!ALLOWED_INLINE_TAGS.has(tag)) {
        const el = $(node)
        el.replaceWith(el.contents())
        return
      }
      const el = $(node)
      const attrs = el.attr()
      if (attrs) {
        Object.keys(attrs).forEach((attr) => el.removeAttr(attr))
      }
    }
    if (node.children) {
      ;[...node.children].forEach(walk)
    }
  }
  walk($.root().get(0))
  return $.html()
}

const updateElementHtmlById = (docHtml, blockId, fragmentHtml) => {
  const $ = cheerio.load(docHtml, { xmlMode: true })
  const element = findBlockById($, blockId)
  if (!element || !element.length) return docHtml
  element.html(sanitizeInlineHtml(fragmentHtml))
  return $.xml()
}

const updateElementHtmlByIndex = (docHtml, blockIndex, fragmentHtml) => {
  const $ = cheerio.load(docHtml, { xmlMode: true })
  const element = findBlockByIndex($, blockIndex)
  if (!element || !element.length) return docHtml
  element.html(sanitizeInlineHtml(fragmentHtml))
  return $.xml()
}

const splitHtmlByIndex = (html, splitIndex, newTitle) => {
  const $before = cheerio.load(html, { xmlMode: true })
  const body = $before('body').get(0) || $before.root().get(0)
  const blocks = collectAllowedBlocks(body)
  if (!blocks.length || splitIndex >= blocks.length - 1) {
    return null
  }
  const beforeHtml = blocks
    .slice(0, splitIndex + 1)
    .map((node) => $before.html(node))
    .join('')
  const afterHtml = blocks
    .slice(splitIndex + 1)
    .map((node) => $before.html(node))
    .join('')

  $before('body').html(beforeHtml)

  const $after = cheerio.load(html, { xmlMode: true })
  $after('body').html(afterHtml)
  const updatedAfter = updateHtmlTitle($after.xml(), newTitle)

  return { before: $before.xml(), after: updatedAfter }
}

const ensureEasypubStylesheet = (zip, opfPath, opfData) => {
  const manifestItems = getManifestItems(opfData)
  const existingCss = manifestItems.find(
    (item) => item['@_href'] === 'easypub-styles.css'
  )
  const opfDir = path.posix.dirname(opfPath)
  const cssZipPath = path.posix.normalize(
    path.posix.join(opfDir, 'easypub-styles.css')
  )
  const cssContent = `body {
  hyphens: auto;
  -webkit-hyphens: auto;
}

p {
  margin: 0;
  text-indent: 1em;
}

hr {
  border: none;
  border-top: 1px solid;
  height: 0;
  margin: 1.5em auto;
  width: 25%;
}

h1 + p,
h2 + p,
h3 + p,
h4 + p,
h5 + p,
h6 + p,
hr + p,
p:first-child {
  text-indent: 0;
}
`

  if (existingCss) {
    zip.updateFile(cssZipPath, Buffer.from(cssContent, 'utf-8'))
  } else {
    zip.addFile(cssZipPath, Buffer.from(cssContent, 'utf-8'))
    manifestItems.push({
      '@_id': 'easypub-styles',
      '@_href': 'easypub-styles.css',
      '@_media-type': 'text/css',
    })
    setManifestItems(opfData, manifestItems)
  }

  return 'easypub-styles.css'
}

const linkStylesheetInContentDocs = (zip, opfPath, opfData, cssHref) => {
  const manifestItems = getManifestItems(opfData)
  const spineItems = getSpineItems(opfData)
  const hrefById = new Map(
    manifestItems.map((item) => [item['@_id'], item['@_href']])
  )

  for (const spineItem of spineItems) {
    const itemHref = hrefById.get(spineItem['@_idref'])
    if (!itemHref) continue
    const targetPath = resolveHref(opfPath, itemHref)
    const entry = zip.getEntry(targetPath)
    if (!entry) continue

    const html = zip.readAsText(entry)
    const $ = cheerio.load(html, { xmlMode: true })

    const itemDir = path.posix.dirname(itemHref)
    const relativeCss = path.posix.relative(itemDir, cssHref) || cssHref

    const alreadyLinked = $(`link[href="${relativeCss}"]`).length > 0 ||
      $(`link[href="${cssHref}"]`).length > 0
    if (alreadyLinked) continue

    let head = $('head')
    if (!head.length) {
      $('html').prepend('<head></head>')
      head = $('head')
    }
    head.append(
      `<link rel="stylesheet" type="text/css" href="${relativeCss}" />`
    )
    zip.updateFile(targetPath, Buffer.from($.xml(), 'utf-8'))
  }
}

const ensureLangAttributes = (zip, opfPath, opfData) => {
  const metadata = opfData?.package?.metadata || {}
  const getText = (val) => {
    if (!val) return ''
    if (typeof val === 'string') return val.trim()
    return (val['#text'] ?? val['_'] ?? '').trim() || ''
  }
  const lang =
    getText(metadata['dc:language']) ||
    getText(metadata['dc\\:language']) ||
    'en'

  const manifestItems = getManifestItems(opfData)
  const spineItems = getSpineItems(opfData)
  const hrefById = new Map(
    manifestItems.map((item) => [item['@_id'], item['@_href']])
  )

  for (const spineItem of spineItems) {
    const itemHref = hrefById.get(spineItem['@_idref'])
    if (!itemHref) continue
    const targetPath = resolveHref(opfPath, itemHref)
    const entry = zip.getEntry(targetPath)
    if (!entry) continue

    const html = zip.readAsText(entry)
    const $ = cheerio.load(html, { xmlMode: true })
    const htmlEl = $('html')
    if (!htmlEl.length) continue

    if (!htmlEl.attr('lang')) {
      htmlEl.attr('lang', lang)
    }
    if (!htmlEl.attr('xml:lang')) {
      htmlEl.attr('xml:lang', lang)
    }
    zip.updateFile(targetPath, Buffer.from($.xml(), 'utf-8'))
  }
}

app.get('/api/working-files', async (_req, res) => {
  const entries = await fs.readdir(workingDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.epub'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
  res.json({ files })
})

const extractMetadataFromOpf = (opfData) => {
  const metadata = opfData?.package?.metadata || {}
  const getText = (val) => {
    if (!val) return ''
    if (typeof val === 'string') return val.trim()
    return (val['#text'] ?? val['_'] ?? '').trim() || ''
  }
  const title = getText(metadata['dc:title']) || getText(metadata['dc\\:title'])
  const creator = getText(metadata['dc:creator']) || getText(metadata['dc\\:creator'])
  return { title, author: creator }
}

app.get('/api/working-files/index', async (_req, res) => {
  const entries = await fs.readdir(workingDir, { withFileTypes: true })
  const epubEntries = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.epub')
  )

  const books = await Promise.all(
    epubEntries.map(async (entry) => {
      const filePath = path.join(workingDir, entry.name)
      const fallbackTitle = entry.name.replace(/\.epub$/i, '')
      let title = fallbackTitle
      let author = ''
      let lastUpdated = new Date(0).toISOString()

      try {
        const stat = await fs.stat(filePath)
        lastUpdated = stat.mtime.toISOString()
      } catch {
        return { filename: entry.name, title: fallbackTitle, author: '', lastUpdated }
      }

      try {
        const zip = new AdmZip(filePath)
        const opfPath = getContainerOpfPath(zip)
        const { data: opfData } = parseOpf(zip, opfPath)
        const { title: t, author: a } = extractMetadataFromOpf(opfData)
        if (t) title = t
        if (a) author = a
      } catch {
        // use fallback title and empty author
      }

      return { filename: entry.name, title, author, lastUpdated }
    })
  )

  books.sort(
    (a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  )

  res.json({ books })
})

app.post('/api/working-files', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' })
    return
  }
  res.json({ filename: req.file.filename })
})

app.get('/api/working-files/:filename', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const filePath = path.join(workingDir, requested)
  try {
    await fs.access(filePath)
    res.sendFile(filePath)
  } catch {
    res.status(404).json({ error: 'File not found.' })
  }
})

app.get('/api/working-files/:filename/history', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const history = await readHistory(requested)
  res.json({ history })
})

app.get('/api/working-files/:filename/endnotes', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const filePath = path.join(workingDir, requested)
  try {
    await fs.access(filePath)
  } catch {
    res.status(404).json({ error: 'File not found.' })
    return
  }

  try {
    const zip = new AdmZip(filePath)
    const opfPath = getContainerOpfPath(zip)
    const { data: opfData } = parseOpf(zip, opfPath)
    const manifestItems = getManifestItems(opfData)

    const endnotesItem = manifestItems.find(
      (item) =>
        item['@_id'] === 'endnotes.xhtml' ||
        (item['@_href'] && item['@_href'].endsWith('endnotes.xhtml'))
    )
    if (!endnotesItem) {
      res.json({ endnotes: [], noterefMap: {} })
      return
    }

    const endnotesHref = endnotesItem['@_href']
    const endnotesFullPath = resolveHref(opfPath, endnotesHref)
    const entry = zip.getEntry(endnotesFullPath)
    if (!entry) {
      res.json({ endnotes: [], noterefMap: {} })
      return
    }

    const xhtml = entry.getData().toString('utf-8')
    const $ = cheerio.load(xhtml, { xmlMode: true })
    const endnotes = []
    const noterefMap = {}

    $('li[epub\\:type="endnote"], li[id^="note-"]').each((_i, el) => {
      const $el = $(el)
      const noteId = $el.attr('id') || ''
      $el.find('a[epub\\:type="backlink"]').remove()
      const innerHtml = $el.html()?.trim() || ''
      // Strip wrapping <p> if it's the only element
      const text = innerHtml.replace(/^\s*<p>([\s\S]*)<\/p>\s*$/, '$1').trim()
      if (text) {
        const uid = randomUUID().slice(0, 4)
        endnotes.push({ uid, text })
        if (noteId) {
          noterefMap[noteId] = uid
        }
      }
    })

    res.json({ endnotes, noterefMap })
  } catch (err) {
    console.error('[Endnotes] parse error:', err)
    res.json({ endnotes: [], noterefMap: {} })
  }
})

app.use(express.json({ limit: '1mb' }))

const progressState = new Map()

app.post('/api/working-files/:filename/merge', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const { fromHref, toHref } = req.body || {}
  if (!fromHref || !toHref) {
    res.status(400).json({ error: 'fromHref and toHref are required.' })
    return
  }

  const filePath = path.join(workingDir, requested)
  await fs.access(filePath)

  const zip = new AdmZip(filePath)
  const opfPath = getContainerOpfPath(zip)
  const { data: opfData } = parseOpf(zip, opfPath)

  const manifestItems = getManifestItems(opfData)
  const toItem = manifestItems.find((item) => {
    const href = item['@_href']
    return href === toHref || decodeURI(href) === decodeURI(toHref)
  })
  if (!toItem) {
    res.status(404).json({ error: 'Target document not found in manifest.' })
    return
  }
  const toId = toItem['@_id']

  const fromPath = resolveHref(opfPath, fromHref)
  const toPath = resolveHref(opfPath, toHref)

  const fromEntry = zip.getEntry(fromPath)
  const toEntry = zip.getEntry(toPath)
  if (!fromEntry || !toEntry) {
    res.status(404).json({ error: 'Content documents not found in EPUB.' })
    return
  }

  await createBackup(requested)

  const fromHtml = zip.readAsText(fromEntry)
  const toHtml = zip.readAsText(toEntry)
  const mergedHtml = mergeHtmlBodies(fromHtml, toHtml)
  zip.updateFile(fromPath, Buffer.from(mergedHtml, 'utf-8'))
  zip.deleteFile(toPath)

  const updatedManifest = manifestItems.filter((item) => {
    const href = item['@_href']
    return !(href === toHref || decodeURI(href) === decodeURI(toHref))
  })
  setManifestItems(opfData, updatedManifest)

  const spineItems = getSpineItems(opfData)
  const updatedSpine = spineItems.filter((item) => item['@_idref'] !== toId)
  setSpineItems(opfData, updatedSpine)

  writeOpf(zip, opfPath, opfData)
  zip.writeZip(filePath)

  const history = await appendHistory(requested, {
    id: randomUUID(),
    action: 'merge',
    timestamp: new Date().toISOString(),
    details: { fromHref, toHref },
  })

  res.json({ history })
})

const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve))

app.post('/api/working-files/:filename/queue', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const actions = req.body?.actions || []
  const endnotes = req.body?.endnotes || []
  if ((!Array.isArray(actions) || !actions.length) && (!Array.isArray(endnotes) || !endnotes.length)) {
    res.status(400).json({ error: 'No actions or endnotes provided.' })
    return
  }

  const filePath = path.join(workingDir, requested)
  try {
    await fs.access(filePath)
  } catch {
    res.status(404).json({ error: 'File not found.' })
    return
  }

  progressState.set(requested, {
    phase: 'loading-queue',
    total: actions.length,
    completed: 0,
  })

  res.status(202).json({ status: 'accepted', total: actions.length })

  const processQueue = async () => {
    try {
      const zip = new AdmZip(filePath)
      const opfPath = getContainerOpfPath(zip)
      const { data: opfData } = parseOpf(zip, opfPath)

      await createBackup(requested)

      let manifestItems = getManifestItems(opfData)
      let spineItems = getSpineItems(opfData)
      const hrefById = new Map(
        manifestItems.map((item) => [item['@_id'], item['@_href']])
      )
      const spineOrderByHref = new Map()
      spineItems.forEach((item, index) => {
        const href = hrefById.get(item['@_idref'])
        if (href) {
          spineOrderByHref.set(href, index)
          spineOrderByHref.set(decodeURI(href), index)
        }
      })

      spineItems.forEach((item) => {
        const href = hrefById.get(item['@_idref'])
        if (!href) {
          return
        }
        const targetPath = resolveHref(opfPath, href)
        const entry = zip.getEntry(targetPath)
        if (!entry) {
          return
        }
        const html = zip.readAsText(entry)
        const updated = ensureBlockIdsInHtml(html)
        if (updated !== html) {
          zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
        }
      })

  const appendSources = new Set(
    actions
      .filter((action) => action.action === 'append-block')
      .map((action) =>
        `${action.fromHref || ''}::${action.fromBlockId || ''}::${String(
          typeof action.fromIndex === 'number' ? action.fromIndex : ''
        )}::${action.fromSelector || ''}`
      )
  )

  const logQueueOrdering = () => {
    const counts = actions.reduce((acc, action) => {
      acc[action.action] = (acc[action.action] || 0) + 1
      return acc
    }, {})
    console.log('[QueueOrder] start', {
      file: requested,
      total: actions.length,
      counts,
    })
  }

  const logQueueResult = (ordered, merges) => {
    const hasMerge = merges.length > 0
    console.log('[QueueOrder] ordered', {
      total: ordered.length,
      merges: merges.length,
      nonMerges: ordered.length - merges.length,
      mergeOrder: hasMerge
        ? merges.map((action) => `${action.fromHref || '?'} -> ${action.toHref || '?'}`)
        : [],
      orderedActions: ordered.map((action) => ({
        action: action.action,
        fromHref: action.fromHref,
        toHref: action.toHref,
        blockId: action.blockId,
        fromBlockId: action.fromBlockId,
        toBlockId: action.toBlockId,
        splitBlockId: action.splitBlockId,
        blockIndex: action.blockIndex,
        fromIndex: action.fromIndex,
        toIndex: action.toIndex,
        splitIndex: action.splitIndex,
      })),
    })
  }

  logQueueOrdering()

  const mergeActions = actions.filter((action) => action.action === 'merge')
  const otherActions = actions.filter((action) => action.action !== 'merge')
  const sortedMerges = mergeActions
    .map((action, order) => ({ action, order }))
    .sort((a, b) => {
      const aHref = a.action.fromHref || ''
      const bHref = b.action.fromHref || ''
      const aIndex = spineOrderByHref.has(aHref)
        ? spineOrderByHref.get(aHref)
        : Number.NEGATIVE_INFINITY
      const bIndex = spineOrderByHref.has(bHref)
        ? spineOrderByHref.get(bHref)
        : Number.NEGATIVE_INFINITY
      if (aIndex === bIndex) {
        return a.order - b.order
      }
      return bIndex - aIndex
    })
    .map((entry) => entry.action)
  const orderedActions = [...otherActions, ...sortedMerges]
  logQueueResult(orderedActions, sortedMerges)

  for (const [index, action] of orderedActions.entries()) {
    if (action.action === 'merge') {
      const { fromHref, toHref } = action
      if (!fromHref || !toHref) {
        continue
      }

      const toItem = manifestItems.find((item) => {
        const href = item['@_href']
        return href === toHref || decodeURI(href) === decodeURI(toHref)
      })
      if (!toItem) {
        continue
      }
      const toId = toItem['@_id']

      const fromPath = resolveHref(opfPath, fromHref)
      const toPath = resolveHref(opfPath, toHref)

      const fromEntry = zip.getEntry(fromPath)
      const toEntry = zip.getEntry(toPath)
      if (!fromEntry || !toEntry) {
        continue
      }

      const fromHtml = zip.readAsText(fromEntry)
      const toHtml = zip.readAsText(toEntry)
      const mergedHtml = mergeHtmlBodies(fromHtml, toHtml)
      zip.updateFile(fromPath, Buffer.from(mergedHtml, 'utf-8'))
      zip.deleteFile(toPath)

      const updatedManifest = manifestItems.filter((item) => {
        const href = item['@_href']
        return !(href === toHref || decodeURI(href) === decodeURI(toHref))
      })
      setManifestItems(opfData, updatedManifest)
      manifestItems = updatedManifest

      const updatedSpine = spineItems.filter((item) => item['@_idref'] !== toId)
      setSpineItems(opfData, updatedSpine)
      spineItems = updatedSpine
    }

    if (action.action === 'change-tag') {
      const { fromHref, selector, toTag, blockIndex, blockId } = action
      if (!fromHref || !toTag) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      let updated = html
      if (blockId) {
        updated = changeElementTagById(html, blockId, toTag)
      } else if (typeof blockIndex === 'number') {
        updated = changeElementTagByIndex(html, blockIndex, toTag)
      } else if (selector) {
        updated = changeElementTag(html, selector, toTag)
      }
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'change-justify') {
      const { fromHref, toJustify, blockIndex, blockId } = action
      if (!fromHref || !toJustify) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      let updated = html
      if (blockId) {
        updated = changeElementJustifyById(html, blockId, toJustify)
      } else if (typeof blockIndex === 'number') {
        updated = changeElementJustifyByIndex(html, blockIndex, toJustify)
      }
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'add-block') {
      const {
        fromHref,
        afterBlockId,
        afterSelector,
        afterIndex,
        insertedText,
        insertPosition,
      } = action
      if (!fromHref) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      const $ = cheerio.load(html, { xmlMode: true })
      let target = null
      if (afterBlockId) {
        target = findBlockById($, afterBlockId)
      }
      if ((!target || !target.length) && afterSelector) {
        target = $(afterSelector).first()
      }
      if ((!target || !target.length) && typeof afterIndex === 'number') {
        target = findBlockByIndex($, afterIndex)
      }
      if (!target || !target.length) {
        continue
      }

      const targetTag = (target.get(0)?.name || '').toLowerCase()
      const parentTag = (target.parent()?.get(0)?.name || '').toLowerCase()
      const nextTag =
        targetTag === 'li' || parentTag === 'ul' || parentTag === 'ol' ? 'li' : 'p'

      const nextText =
        typeof insertedText === 'string' && insertedText.length
          ? insertedText
          : 'New Text Block'
      const nextElement = $(`<${nextTag}></${nextTag}>`)
      nextElement.attr('data-easypub-id', randomUUID())
      nextElement.text(nextText)
      const position = insertPosition === 'before' ? 'before' : 'after'
      if (position === 'before') {
        target.before(nextElement)
      } else {
        target.after(nextElement)
      }

      zip.updateFile(targetPath, Buffer.from($.xml(), 'utf-8'))
    }

    if (action.action === 'add-space-break') {
      const {
        fromHref,
        afterBlockId,
        afterSelector,
        afterIndex,
        insertPosition,
      } = action
      if (!fromHref) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      const $ = cheerio.load(html, { xmlMode: true })
      let target = null
      if (afterBlockId) {
        target = findBlockById($, afterBlockId)
      }
      if ((!target || !target.length) && afterSelector) {
        target = $(afterSelector).first()
      }
      if ((!target || !target.length) && typeof afterIndex === 'number') {
        target = findBlockByIndex($, afterIndex)
      }
      if (!target || !target.length) {
        continue
      }

      const hrElement = $('<hr/>')
      hrElement.attr('data-easypub-id', randomUUID())
      const position = insertPosition === 'before' ? 'before' : 'after'
      if (position === 'before') {
        target.before(hrElement)
      } else {
        target.after(hrElement)
      }

      zip.updateFile(targetPath, Buffer.from($.xml(), 'utf-8'))
    }

    if (action.action === 'delete-block') {
      const { fromHref, selector, blockIndex, blockId } = action
      if (!fromHref) {
        continue
      }
      const deleteKey = `${fromHref}::${String(
        typeof blockIndex === 'number' ? blockIndex : ''
      )}::${selector || ''}::${blockId || ''}`
      if (appendSources.has(deleteKey)) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      const $ = cheerio.load(html, { xmlMode: true })
      let element = null
      if (blockId) {
        element = findBlockById($, blockId)
      } else if (typeof blockIndex === 'number') {
        element = findBlockByIndex($, blockIndex)
      } else if (selector) {
        element = $(selector).first()
      }
      if (!element || !element.length) {
        continue
      }
      element.remove()
      zip.updateFile(targetPath, Buffer.from($.xml(), 'utf-8'))
    }

    if (action.action === 'append-block') {
      const {
        fromHref,
        toHref,
        fromSelector,
        toSelector,
        fromIndex,
        toIndex,
        direction,
        fromBlockId,
        toBlockId,
      } = action
      if (!fromHref || !toHref) {
        if (
          !fromHref ||
          !toHref ||
          typeof fromIndex !== 'number' ||
          typeof toIndex !== 'number'
        ) {
          continue
        }
      }

      const fromPath = resolveHref(opfPath, fromHref)
      const toPath = resolveHref(opfPath, toHref)
      const fromEntry = zip.getEntry(fromPath)
      const toEntry = zip.getEntry(toPath)
      if (!fromEntry || !toEntry) {
        continue
      }

      const fromHtml = zip.readAsText(fromEntry)
      const toHtml = zip.readAsText(toEntry)
      const fromDoc = cheerio.load(fromHtml, { xmlMode: true })
      const toDoc = fromPath === toPath ? fromDoc : cheerio.load(toHtml, { xmlMode: true })
      let source = null
      let target = null
      if (fromBlockId) {
        source = findBlockById(fromDoc, fromBlockId)
      } else if (typeof fromIndex === 'number') {
        source = findBlockByIndex(fromDoc, fromIndex)
      } else if (fromSelector) {
        source = fromDoc(fromSelector).first()
      }
      if (toBlockId) {
        target = findBlockById(toDoc, toBlockId)
      } else if (typeof toIndex === 'number') {
        target = findBlockByIndex(toDoc, toIndex)
      } else if (toSelector) {
        target = toDoc(toSelector).first()
      }
      if (!source || !target || !source.length || !target.length) {
        continue
      }

      const sourceHtml = source.html() || ''
      if (direction === 'previous') {
        target.append(` ${sourceHtml}`)
      } else {
        target.prepend(`${sourceHtml} `)
      }
      source.remove()

      zip.updateFile(fromPath, Buffer.from(fromDoc.xml(), 'utf-8'))
      if (fromPath !== toPath) {
        zip.updateFile(toPath, Buffer.from(toDoc.xml(), 'utf-8'))
      }
    }

    if (action.action === 'edit-text') {
      const { fromHref, blockIndex, text, blockId } = action
      if (!fromHref || typeof text !== 'string') {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      let updated = html
      if (blockId) {
        updated = updateElementTextById(html, blockId, text)
      } else if (typeof blockIndex === 'number') {
        updated = updateElementTextByIndex(html, blockIndex, text)
      }
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'edit-html') {
      const { fromHref, blockIndex, html, blockId } = action
      if (!fromHref || typeof html !== 'string') {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const docHtml = zip.readAsText(targetEntry)
      let updated = docHtml
      if (blockId) {
        updated = updateElementHtmlById(docHtml, blockId, html)
      } else if (typeof blockIndex === 'number') {
        updated = updateElementHtmlByIndex(docHtml, blockIndex, html)
      }
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'rename-section') {
      const { fromHref, title } = action
      if (!fromHref || !title) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      const updated = updateHtmlTitle(html, title)
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'split-section') {
      const { fromHref, splitIndex, newHref, title, splitBlockId } = action
      if (!fromHref || !newHref || !title) {
        continue
      }
      const fromPath = resolveHref(opfPath, fromHref)
      const newPath = resolveHref(opfPath, newHref)
      const fromEntry = zip.getEntry(fromPath)
      if (!fromEntry) {
        continue
      }
      const html = zip.readAsText(fromEntry)
      let effectiveIndex = splitIndex
      if (splitBlockId) {
        const $ = cheerio.load(html, { xmlMode: true })
        const foundIndex = findBlockIndexById($, splitBlockId)
        if (foundIndex >= 0) {
          effectiveIndex = foundIndex
        }
      }
      if (typeof effectiveIndex !== 'number') {
        continue
      }
      const result = splitHtmlByIndex(html, effectiveIndex, title)
      if (!result) {
        continue
      }
      zip.updateFile(fromPath, Buffer.from(result.before, 'utf-8'))
      zip.addFile(newPath, Buffer.from(result.after, 'utf-8'))

      const manifestItems = getManifestItems(opfData)
      const sourceItem = manifestItems.find((item) => {
        const href = item['@_href']
        return href === fromHref || decodeURI(href) === decodeURI(fromHref)
      })
      const mediaType = sourceItem?.['@_media-type'] || 'application/xhtml+xml'
      const newId = `item-${Date.now()}`
      manifestItems.push({
        '@_id': newId,
        '@_href': newHref,
        '@_media-type': mediaType,
      })
      setManifestItems(opfData, manifestItems)

      const spineItems = getSpineItems(opfData)
      const sourceIndex = spineItems.findIndex(
        (item) => item['@_idref'] === sourceItem?.['@_id']
      )
      if (sourceIndex >= 0) {
        spineItems.splice(sourceIndex + 1, 0, { '@_idref': newId })
      } else {
        spineItems.push({ '@_idref': newId })
      }
      setSpineItems(opfData, spineItems)
    }

    progressState.set(requested, {
      phase: 'applying',
      total: actions.length,
      completed: index + 1,
    })
    await yieldToEventLoop()
  }

  const hasFullJustify = actions.some(
    (a) => a.action === 'change-justify' && a.toJustify === 'justify'
  )
  if (hasFullJustify) {
    const cssHref = ensureEasypubStylesheet(zip, opfPath, opfData)
    linkStylesheetInContentDocs(zip, opfPath, opfData, cssHref)
    ensureLangAttributes(zip, opfPath, opfData)
  }

  if (endnotes.length) {
    writeEndnotes(zip, opfPath, opfData, endnotes)
  }

  writeToc(zip, opfPath, opfData)

  progressState.set(requested, {
    phase: 'writing-epub',
    total: actions.length,
    completed: actions.length,
  })

  await yieldToEventLoop()
  writeOpf(zip, opfPath, opfData)
  zip.writeZip(filePath)

  progressState.set(requested, {
    phase: 'reloading',
    total: actions.length,
    completed: actions.length,
  })

  const history = await appendHistory(requested, {
    id: randomUUID(),
    action: 'queue-execute',
    timestamp: new Date().toISOString(),
    details: { actions },
  })

  progressState.set(requested, {
    phase: 'complete',
    total: actions.length,
    completed: actions.length,
    history,
  })
    } catch (err) {
      console.error('[Queue] processing error:', err)
      progressState.set(requested, {
        phase: 'error',
        total: actions.length,
        completed: 0,
        error: err?.message || 'Unknown error during queue processing.',
      })
    }
  }

  processQueue()
})

app.get('/api/working-files/:filename/progress', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const state = progressState.get(requested)
  res.json(
    state || {
      phase: 'idle',
      total: 0,
      completed: 0,
    }
  )
})

app.post('/api/working-files/:filename/undo', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const filePath = path.join(workingDir, requested)
  await fs.access(filePath)

  const historyDir = await historyDirFor(requested)
  const entries = await fs.readdir(historyDir)
  const backups = entries.filter((entry) => entry.endsWith('.epub')).sort()
  const latest = backups[backups.length - 1]
  if (!latest) {
    res.status(400).json({ error: 'No undo history available.' })
    return
  }

  const backupPath = path.join(historyDir, latest)
  await fs.copyFile(backupPath, filePath)
  await fs.unlink(backupPath)

  const history = await appendHistory(requested, {
    id: randomUUID(),
    action: 'undo',
    timestamp: new Date().toISOString(),
    details: { restoredFrom: latest },
  })

  res.json({ history })
})

app.get('/api/working-files/:filename/dictionary', async (req, res) => {
  const requested = decodeURIComponent(req.params.filename)
  try {
    const words = await readDictionary(requested)
    res.json({ words })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/working-files/:filename/dictionary', async (req, res) => {
  const requested = decodeURIComponent(req.params.filename)
  const { words } = req.body
  if (!Array.isArray(words)) {
    res.status(400).json({ error: 'words must be an array' })
    return
  }
  try {
    await writeDictionary(requested, words)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/working-files/:filename/spellcheck-section', async (req, res) => {
  const requested = decodeURIComponent(req.params.filename)
  const { blocks, sectionIndex, href } = req.body
  const blockCount = Array.isArray(blocks) ? blocks.length : 0
  console.log(
    `[section] load: "${requested}" index=${sectionIndex ?? '?'} href="${href ?? '?'}" — ${blockCount} block(s)`
  )
  if (!Array.isArray(blocks)) {
    console.log('[section] load failed — blocks must be an array')
    res.status(400).json({ error: 'blocks must be an array' })
    return
  }
  try {
    const customDictionary = await readDictionary(requested)
    const checked = spellcheckBlocks(blocks, customDictionary)

    const misspelled = new Set()
    for (const block of checked) {
      if (!block.spellcheckHtml) continue
      const matches = block.spellcheckHtml.matchAll(/class="spell-unknown" data-word="([^"]+)"/g)
      for (const m of matches) misspelled.add(m[1])
    }
    const unknownWords = [...misspelled]
    if (unknownWords.length === 0) {
      console.log(`[spellcheck] Section complete — 0 unknown words (no misspellings)`)
    } else {
      console.log(
        `[spellcheck] Section complete — ${unknownWords.length} unknown word(s):`,
        unknownWords.slice(0, 30).join(', ')
      )
    }

    res.json({ blocks: checked, unknownWordCount: unknownWords.length })
  } catch (err) {
    console.error('[section] load error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/working-files/:filename/spellcheck-block', async (req, res) => {
  const requested = decodeURIComponent(req.params.filename)
  const { html } = req.body
  if (typeof html !== 'string') {
    res.status(400).json({ error: 'html must be a string' })
    return
  }
  try {
    const customDictionary = await readDictionary(requested)
    const spellcheckHtml = spellcheckBlockHtml(html, customDictionary)
    const unknownMatches = [...spellcheckHtml.matchAll(/class="spell-unknown" data-word="([^"]+)"/g)]
    if (unknownMatches.length === 0) {
      console.log(`[spellcheck] Block complete — 0 unknown words (no misspellings)`)
    } else {
      const words = [...new Set(unknownMatches.map((m) => m[1]))]
      console.log(
        `[spellcheck] Block complete — ${words.length} unknown word(s):`,
        words.join(', ')
      )
    }
    res.json({ spellcheckHtml })
  } catch (err) {
    console.error('[spellcheck] Block error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

const server = app.listen(port)

server.on('listening', () => {
  console.log(`[server] EasyPub API running on http://localhost:${port}`)
  console.log('[server] Section loads log as [section] load: ... in this terminal')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] ERROR: Port ${port} is already in use.`)
    console.error(`[server] Kill the old process: lsof -ti :${port} | xargs kill`)
    console.error('[server] Then restart with: npm run dev')
  } else {
    console.error('[server] Failed to start:', err.message)
  }
  process.exit(1)
})
