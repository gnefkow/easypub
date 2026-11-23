import path from 'path'
import * as cheerio from 'cheerio'
import {
  getManifestItems,
  getSpineItems,
  setManifestItems,
  resolveHref,
} from './opf.js'
import { mapManifestXhtmlHtml } from './html-blocks.js'

export const ensureEasypubStylesheet = (zip, opfPath, opfData) => {
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

export const linkStylesheetInContentDocs = (zip, opfPath, opfData, cssHref) => {
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

export const ensureLangAttributes = (zip, opfPath, opfData) => {
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

/** Rewrite legacy text-align: left → initial in content XHTML (SE). */
export const normalizeTextAlignLeftInHtml = (html) => {
  if (!/text-align:\s*left/i.test(html)) {
    return html
  }
  return html.replace(/text-align:\s*left/gi, 'text-align: initial')
}

export const normalizeTextAlignLeftInZip = (zip, opfPath, opfData) =>
  mapManifestXhtmlHtml(zip, opfPath, opfData, normalizeTextAlignLeftInHtml)
