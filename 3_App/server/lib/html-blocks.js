import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'
import {
  getManifestItems,
  getSpineItems,
  resolveHref,
} from './opf.js'

export const mergeHtmlBodies = (aHtml, bHtml) => {
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

// Container tags (Pandoc / EPUB3 wrappers) — recurse into children, do not create blocks.
export const containerTags = new Set(['section', 'article'])
export const blockTags = new Set([
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
  'img',
  'hr',
])

export const collectAllowedBlocks = (rootNode) => {
  const blocks = []
  const walk = (node) => {
    if (!node) return
    if (node.type === 'tag') {
      const tag = (node.name || '').toLowerCase()
      if (containerTags.has(tag)) {
        if (node.children) {
          node.children.forEach(walk)
        }
        return
      }
      if (blockTags.has(tag)) {
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

export const ensureBlockIdsInHtml = (html) => {
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

export const stripBlockIdsInHtml = (html) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const withIds = $('[data-easypub-id]')
  if (!withIds.length) {
    return html
  }
  withIds.removeAttr('data-easypub-id')
  return $.xml()
}

export const mapSpineContentHtml = (zip, opfPath, opfData, transformHtml) => {
  let anyChanged = false
  const manifestItems = getManifestItems(opfData)
  const spineItems = getSpineItems(opfData)
  const hrefById = new Map(
    manifestItems.map((item) => [item['@_id'], item['@_href']])
  )
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
    const updated = transformHtml(html)
    if (updated !== html) {
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
      anyChanged = true
    }
  })
  return anyChanged
}

export const mapManifestXhtmlHtml = (zip, opfPath, opfData, transformHtml) => {
  let anyChanged = false
  const manifestItems = getManifestItems(opfData)
  manifestItems.forEach((item) => {
    const media = String(item['@_media-type'] || '')
    if (!media.includes('html')) {
      return
    }
    const href = item['@_href']
    if (!href) {
      return
    }
    const targetPath = resolveHref(opfPath, href)
    const entry = zip.getEntry(targetPath)
    if (!entry) {
      return
    }
    const html = zip.readAsText(entry)
    const updated = transformHtml(html)
    if (updated !== html) {
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
      anyChanged = true
    }
  })
  return anyChanged
}

export const ensureBlockIdsInZip = (zip, opfPath, opfData) =>
  mapSpineContentHtml(zip, opfPath, opfData, ensureBlockIdsInHtml)

export const stripBlockIdsInZip = (zip, opfPath, opfData) =>
  mapManifestXhtmlHtml(zip, opfPath, opfData, stripBlockIdsInHtml)

export const findBlockById = ($, blockId) => {
  if (!blockId) {
    return null
  }
  const element = $(`[data-easypub-id="${blockId}"]`).first()
  return element.length ? element : null
}

export const findBlockIndexById = ($, blockId) => {
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

export const findBlockByIndex = ($, index) => {
  if (typeof index !== 'number') {
    return null
  }
  const body = $('body').get(0) || $.root().get(0)
  const blocks = collectAllowedBlocks(body)
  const node = blocks[index]
  return node ? $(node) : null
}

export const changeElementTag = (html, selector, newTag) => {
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

export const changeElementTagByIndex = (html, blockIndex, newTag) => {
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

export const changeElementTagById = (html, blockId, newTag) => {
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

// SE: use text-align: initial (not left) so reading systems can still justify.
export const cssTextAlignValue = (justify) =>
  justify === 'left' ? 'initial' : justify

export const setElementTextAlign = (element, justify) => {
  const align = cssTextAlignValue(justify)
  const existing = element.attr('style') || ''
  const cleaned = existing.replace(/text-align:\s*[^;]+;?/g, '').trim()
  const newStyle = cleaned
    ? `${cleaned}; text-align: ${align};`
    : `text-align: ${align};`
  element.attr('style', newStyle)
}

export const changeElementJustifyById = (html, blockId, justify) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = findBlockById($, blockId)
  if (!element || !element.length) return html
  setElementTextAlign(element, justify)
  return $.xml()
}

export const changeElementJustifyByIndex = (html, blockIndex, justify) => {
  const $ = cheerio.load(html, { xmlMode: true })
  const element = findBlockByIndex($, blockIndex)
  if (!element || !element.length) return html
  setElementTextAlign(element, justify)
  return $.xml()
}


export const updateHtmlTitle = (html, title) => {
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

export const updateElementTextByIndex = (html, blockIndex, text) => {
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

export const updateElementTextById = (html, blockId, text) => {
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

export const ALLOWED_INLINE_TAGS = new Set(['strong', 'em', 'br', 'sup', 'sub'])

export const sanitizeInlineHtml = (fragmentHtml) => {
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

export const updateElementHtmlById = (docHtml, blockId, fragmentHtml) => {
  const $ = cheerio.load(docHtml, { xmlMode: true })
  const element = findBlockById($, blockId)
  if (!element || !element.length) return docHtml
  element.html(sanitizeInlineHtml(fragmentHtml))
  return $.xml()
}

export const updateElementHtmlByIndex = (docHtml, blockIndex, fragmentHtml) => {
  const $ = cheerio.load(docHtml, { xmlMode: true })
  const element = findBlockByIndex($, blockIndex)
  if (!element || !element.length) return docHtml
  element.html(sanitizeInlineHtml(fragmentHtml))
  return $.xml()
}

export const splitHtmlByIndex = (html, splitIndex, newTitle) => {
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
